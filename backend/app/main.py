import json
import re
from collections import Counter
from datetime import timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from . import auth, models, schemas, scraper
from .database import Base, engine, get_db, settings

GRADE_POINTS = {
    'O': 10,
    'S': 10,
    'A+': 9,
    'A': 8,
    'B+': 7,
    'B': 6,
    'C': 5,
    'D': 4,
    'E': 3,
    'PASS': 5,
    'P': 5,
    'FAIL': 0,
    'F': 0,
    'U': 0,
    'W': 0,
    'I': 0,
    'AB': 0,
}

DIRECTORY_SORT_KEYS = {
    'roll_no': lambda item: item.roll_no or '',
    'name': lambda item: (item.name or '').lower(),
    'city': lambda item: (item.city or '').lower(),
    'batch': lambda item: (item.batch or '').lower(),
    'semester': lambda item: item.current_semester or 0,
    'gpa': lambda item: item.average_grade_points or 0,
    'internal': lambda item: item.average_internal_percentage or 0,
}

Base.metadata.create_all(bind=engine)

app = FastAPI(title='Student Performance Analysis API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def log_requests(request, call_next):
    print(f'Request: {request.method} {request.url}')
    response = await call_next(request)
    print(f'Response status: {response.status_code}')
    return response


def get_role_name(user: models.User) -> str:
    return user.role.name if user.role else ''


def require_admin(user: models.User):
    if get_role_name(user) != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')


def get_student_record(user: models.User, db: Session):
    return db.query(models.Student).options(joinedload(models.Student.program)).filter(models.Student.id == user.id).first()


def get_staff_record(user: models.User, db: Session):
    return db.query(models.Staff).filter(models.Staff.id == user.id).first()


def build_current_user_response(user: models.User, db: Session) -> schemas.CurrentUser:
    student = get_student_record(user, db)
    staff = None if student else get_staff_record(user, db)
    return schemas.CurrentUser(
        id=user.id,
        username=user.username,
        role_id=user.role_id,
        is_initial_password=user.is_initial_password,
        created_at=user.created_at,
        role=get_role_name(user),
        name=student.name if student else (staff.name if staff else None),
        email=student.email if student else (staff.email if staff else None),
        roll_no=student.roll_no if student else None,
        reg_no=student.reg_no if student else None,
        batch=student.batch if student else None,
        current_semester=student.current_semester if student else None,
        program_name=student.program.name if student and student.program else None,
    )


def get_accessible_student(roll_no: str, current_user: models.User, db: Session):
    role_name = get_role_name(current_user)
    query = db.query(models.Student).options(
        joinedload(models.Student.program),
        joinedload(models.Student.marks).joinedload(models.StudentMark.subject),
        joinedload(models.Student.attendance),
        joinedload(models.Student.user),
    )

    if role_name == 'student':
        student = query.filter(models.Student.id == current_user.id).first()
        if not student or student.roll_no != roll_no:
            raise HTTPException(status_code=403, detail='Students can only access their own records')
        return student

    student = query.filter(models.Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail='Student not found')
    return student


def validate_dob(dob: str) -> str:
    dob = dob.strip()
    if re.fullmatch(r'\d{8}', dob):
        return dob
    if re.fullmatch(r'\d{2}/\d{2}/\d{4}', dob):
        return dob
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', dob):
        return dob
    raise HTTPException(status_code=422, detail='DOB must be in DDMMYYYY, DD/MM/YYYY, or YYYY-MM-DD format')


def calculate_analytics(student: models.Student) -> schemas.AnalyticsSummary:
    marks = list(student.marks or [])
    attendance = sorted(list(student.attendance or []), key=lambda item: item.date)

    graded_marks = [mark for mark in marks if mark.grade]
    average_grade_points = round(sum(GRADE_POINTS.get(mark.grade, 0) for mark in graded_marks) / len(graded_marks), 2) if graded_marks else 0.0
    marks_with_internal = [float(mark.internal_marks) for mark in marks if mark.internal_marks is not None]
    average_internal = round(sum(marks_with_internal) / len(marks_with_internal), 2) if marks_with_internal else 0.0
    total_backlogs = sum(1 for mark in marks if (mark.grade or '').upper() in {'U', 'FAIL', 'W', 'I'})

    grade_counts = {}
    for mark in graded_marks:
        grade = mark.grade or 'Unknown'
        grade_counts[grade] = grade_counts.get(grade, 0) + 1
    grade_distribution = [schemas.GradeDistributionItem(grade=grade, count=count) for grade, count in sorted(grade_counts.items())]

    semester_buckets = {}
    for mark in marks:
        semester_buckets.setdefault(mark.semester, []).append(mark)
    semester_performance = []
    for semester, semester_marks in sorted(semester_buckets.items()):
        semester_grades = [GRADE_POINTS.get(mark.grade, 0) for mark in semester_marks if mark.grade]
        semester_internals = [float(mark.internal_marks) for mark in semester_marks if mark.internal_marks is not None]
        semester_performance.append(
            schemas.SemesterPerformanceItem(
                semester=semester,
                subject_count=len(semester_marks),
                average_internal=round(sum(semester_internals) / len(semester_internals), 2) if semester_internals else 0.0,
                average_grade_points=round(sum(semester_grades) / len(semester_grades), 2) if semester_grades else 0.0,
                backlog_count=sum(1 for mark in semester_marks if (mark.grade or '').upper() in {'U', 'FAIL', 'W', 'I'}),
            )
        )

    risk_subjects = []
    for mark in marks:
        grade_value = GRADE_POINTS.get(mark.grade, 0)
        internal_value = float(mark.internal_marks) if mark.internal_marks is not None else 0.0
        if grade_value <= 5 or (mark.internal_marks is not None and internal_value < 60):
            risk_subjects.append(
                schemas.RiskSubjectItem(
                    subject=mark.subject.name if mark.subject else 'Unknown Subject',
                    course_code=mark.subject.course_code if mark.subject else '-',
                    semester=mark.semester,
                    grade=mark.grade or '-',
                    internal_marks=round(internal_value, 2),
                    risk_reason='Low grade performance' if grade_value <= 5 else 'Internal marks need improvement',
                )
            )
    risk_subjects = risk_subjects[:5]

    strength_subjects = []
    for mark in marks:
        if not mark.subject:
            continue
        score = GRADE_POINTS.get(mark.grade, 0) * 10 + (float(mark.internal_marks) if mark.internal_marks is not None else 0.0)
        strength_subjects.append(
            schemas.StrengthSubjectItem(
                subject=mark.subject.name,
                course_code=mark.subject.course_code,
                semester=mark.semester,
                grade=mark.grade or '-',
                score=round(score, 2),
            )
        )
    strength_subjects.sort(key=lambda item: item.score, reverse=True)
    strength_subjects = strength_subjects[:5]

    total_present = sum(int(item.total_present or 0) for item in attendance)
    total_hours = sum(int(item.total_hours or 0) for item in attendance)
    absent_days = sum(1 for item in attendance if (item.total_present or 0) < (item.total_hours or item.hours_per_day or 0))
    recent_streak_days = 0
    for item in reversed(attendance):
        total_for_day = item.total_hours or item.hours_per_day or 0
        if total_for_day and (item.total_present or 0) >= total_for_day:
            recent_streak_days += 1
        else:
            break

    return schemas.AnalyticsSummary(
        average_grade_points=average_grade_points,
        average_internal=average_internal,
        total_backlogs=total_backlogs,
        total_subjects=len(marks),
        grade_distribution=grade_distribution,
        semester_performance=semester_performance,
        risk_subjects=risk_subjects,
        strength_subjects=strength_subjects,
        attendance=schemas.AttendanceInsight(
            total_present=total_present,
            total_hours=total_hours,
            percentage=round((total_present / total_hours) * 100, 2) if total_hours else 0.0,
            recent_streak_days=recent_streak_days,
            absent_days=absent_days,
        ),
    )


def build_admin_student_snapshot(student: models.Student) -> schemas.AdminStudentSnapshot:
    analytics = calculate_analytics(student)
    return schemas.AdminStudentSnapshot(
        roll_no=student.roll_no,
        name=student.name,
        batch=student.batch,
        program_name=student.program.name if student.program else None,
        current_semester=student.current_semester,
        average_grade_points=analytics.average_grade_points,
        attendance_percentage=analytics.attendance.percentage,
        backlogs=analytics.total_backlogs,
        is_initial_password=student.user.is_initial_password if student.user else False,
    )


def _admin_directory_query():
    return text('''
        with rollups as (
            select distinct roll_no from students
            union select distinct roll_no from contact_info
            union select distinct roll_no from family_details
            union select distinct roll_no from previous_academics
            union select distinct roll_no from semester_grades
            union select distinct roll_no from internal_marks
            union select distinct roll_no from counselor_diary
            union select distinct roll_no from extra_curricular
        ), grade_agg as (
            select roll_no,
                   count(*) as marks_count,
                   avg(coalesce(grade_point, 0)) as average_grade_points,
                   avg(coalesce(internal_marks, 0)) as average_internal_percentage,
                   sum(case when upper(coalesce(grade, '')) in ('U', 'FAIL', 'F', 'W', 'I', 'AB') then 1 else 0 end) as backlogs
            from semester_grades
            group by roll_no
        ), attendance_agg as (
            select s.roll_no,
                   count(a.*) as attendance_count,
                   case when sum(coalesce(a.total_hours, 0)) > 0
                        then (sum(coalesce(a.total_present, 0))::numeric / sum(coalesce(a.total_hours, 0))::numeric) * 100
                        else 0 end as attendance_percentage
            from students s
            left join attendance a on a.student_id = s.id
            group by s.roll_no
        )
        select r.roll_no,
               coalesce(s.name, ci.email, fd.parent_guardian_name, 'Unknown Student') as name,
               ci.city,
               coalesce(ci.email, s.email) as email,
               ci.phone_primary,
               s.batch,
               s.current_semester,
               coalesce(ga.marks_count, 0) as marks_count,
               coalesce(aa.attendance_count, 0) as attendance_count,
               coalesce(aa.attendance_percentage, 0) as attendance_percentage,
               coalesce(ga.average_grade_points, 0) as average_grade_points,
               coalesce(ga.average_internal_percentage, 0) as average_internal_percentage,
               coalesce(ga.backlogs, 0) as backlogs
        from rollups r
        left join students s on s.roll_no = r.roll_no
        left join contact_info ci on ci.roll_no = r.roll_no
        left join family_details fd on fd.roll_no = r.roll_no
        left join grade_agg ga on ga.roll_no = r.roll_no
        left join attendance_agg aa on aa.roll_no = r.roll_no
    ''')


def build_admin_overview(db: Session) -> schemas.AdminOverview:
    directory = build_admin_directory(db)
    users = db.query(models.User).options(joinedload(models.User.role)).all()
    snapshots = [
        schemas.AdminStudentSnapshot(
            roll_no=item.roll_no,
            name=item.name,
            batch=item.batch,
            program_name=None,
            current_semester=item.current_semester,
            average_grade_points=item.average_grade_points,
            attendance_percentage=item.attendance_percentage,
            backlogs=item.backlogs,
            is_initial_password=False,
        )
        for item in directory
    ]
    average_attendance = round(sum(item.attendance_percentage for item in snapshots) / len(snapshots), 2) if snapshots else 0.0
    average_grade_points = round(sum(item.average_grade_points for item in snapshots) / len(snapshots), 2) if snapshots else 0.0
    attention_required = [item for item in snapshots if item.backlogs > 0 or item.attendance_percentage < 75]
    top_performers = sorted(snapshots, key=lambda item: (item.average_grade_points, item.attendance_percentage), reverse=True)[:5]
    recent_students = sorted(snapshots, key=lambda item: (item.current_semester or 0, item.roll_no), reverse=True)[:8]

    return schemas.AdminOverview(
        total_students=len(directory),
        total_staff=sum(1 for user in users if get_role_name(user) == 'staff'),
        total_admins=sum(1 for user in users if get_role_name(user) == 'admin'),
        students_needing_attention=len(attention_required),
        average_attendance=average_attendance,
        average_grade_points=average_grade_points,
        recent_students=recent_students,
        top_performers=top_performers,
        attention_required=attention_required[:8],
    )


def build_admin_directory(db: Session):
    query = text(f'''
        {_admin_directory_query().text}
        order by r.roll_no desc
    ''')
    rows = db.execute(query).mappings().all()
    return [schemas.AdminDirectoryStudent(**dict(row)) for row in rows]


def build_admin_directory_student(roll_no: str, db: Session):
    query = text(f'''
        {_admin_directory_query().text}
        where r.roll_no = :roll_no
        limit 1
    ''')
    row = db.execute(query, {'roll_no': roll_no}).mappings().first()
    return schemas.AdminDirectoryStudent(**dict(row)) if row else None


def filter_admin_directory(
    directory: list[schemas.AdminDirectoryStudent],
    search: str = '',
    city: str = '',
    batch: str = '',
    semester: Optional[int] = None,
    risk_only: bool = False,
    sort_by: str = 'roll_no',
    sort_dir: str = 'desc',
    limit: int = 200,
):
    results = directory
    search_term = search.strip().lower()
    if search_term:
        results = [
            item for item in results
            if search_term in ' '.join([
                item.roll_no or '',
                item.name or '',
                item.email or '',
                item.city or '',
            ]).lower()
        ]
    if city:
        results = [item for item in results if (item.city or '').lower() == city.strip().lower()]
    if batch:
        results = [item for item in results if (item.batch or '').lower() == batch.strip().lower()]
    if semester is not None:
        results = [item for item in results if item.current_semester == semester]
    if risk_only:
        results = [
            item for item in results
            if item.backlogs > 0
            or item.average_grade_points < 6
            or item.average_internal_percentage < 60
            or item.attendance_percentage < 75
            or item.attendance_count == 0
        ]

    key_fn = DIRECTORY_SORT_KEYS.get(sort_by, DIRECTORY_SORT_KEYS['roll_no'])
    reverse = sort_dir.lower() != 'asc'
    results = sorted(results, key=key_fn, reverse=reverse)
    return results[:max(1, min(limit, 500))]


def build_directory_insights(directory: list[schemas.AdminDirectoryStudent]) -> schemas.AdminDirectoryInsights:
    def make_counter(values):
        counter = Counter([value for value in values if value])
        return [schemas.AdminDirectoryInsightItem(label=label, count=count) for label, count in counter.most_common(6)]

    return schemas.AdminDirectoryInsights(
        total_records=len(directory),
        risk_students=sum(
            1 for item in directory
            if item.backlogs > 0
            or item.average_grade_points < 6
            or item.average_internal_percentage < 60
            or item.attendance_percentage < 75
            or item.attendance_count == 0
        ),
        cities=make_counter(item.city for item in directory),
        batches=make_counter(item.batch for item in directory),
        semesters=make_counter(str(item.current_semester) for item in directory if item.current_semester is not None),
        missing_email_count=sum(1 for item in directory if not item.email),
        missing_phone_count=sum(1 for item in directory if not item.phone_primary),
        missing_batch_count=sum(1 for item in directory if not item.batch),
    )


def build_record_health(
    contact_info,
    family_details,
    previous_academics,
    extra_curricular,
    counselor_diary,
    semester_grades,
    internal_marks,
):
    sections = {
        'contact': bool(contact_info),
        'family': bool(family_details),
        'previous_academics': bool(previous_academics),
        'activities': bool(extra_curricular),
        'counselor_notes': bool(counselor_diary),
        'semester_grades': bool(semester_grades),
        'internal_marks': bool(internal_marks),
    }
    available_sections = [label for label, present in sections.items() if present]
    missing_sections = [label for label, present in sections.items() if not present]
    completion_percentage = round((len(available_sections) / len(sections)) * 100, 2) if sections else 0.0
    last_counselor_update = counselor_diary[0]['meeting_date'] if counselor_diary and counselor_diary[0].get('meeting_date') else None
    latest_activity_year = next((item.get('year') for item in extra_curricular if item.get('year')), None)

    return schemas.StudentRecordHealth(
        completion_percentage=completion_percentage,
        available_sections=available_sections,
        missing_sections=missing_sections,
        last_counselor_update=last_counselor_update,
        latest_activity_year=latest_activity_year,
    )


def build_academic_snapshot(semester_grades, internal_marks, previous_academics):
    best_grade = None
    best_grade_point = -1
    for item in semester_grades:
        current_grade = (item.get('grade') or '').upper()
        point = GRADE_POINTS.get(current_grade, -1)
        if point > best_grade_point:
            best_grade_point = point
            best_grade = item.get('grade')

    cgpa_proxy_values = [float(item.get('grade_point')) for item in semester_grades if item.get('grade_point') is not None]
    cgpa_proxy = round(sum(cgpa_proxy_values) / len(cgpa_proxy_values), 2) if cgpa_proxy_values else 0.0
    semesters_tracked = len({item.get('semester') for item in semester_grades if item.get('semester') is not None})
    needs_attention = any((item.get('grade') or '').upper() in {'U', 'FAIL', 'W', 'I'} for item in semester_grades)
    if not needs_attention:
        needs_attention = any((item.get('percentage') or 0) < 60 for item in internal_marks if item.get('percentage') is not None)

    return schemas.StudentAcademicSnapshot(
        semesters_tracked=semesters_tracked,
        grade_entries=len(semester_grades),
        internal_tests=len(internal_marks),
        previous_qualifications=len(previous_academics),
        cgpa_proxy=cgpa_proxy,
        best_grade=best_grade,
        needs_attention=needs_attention,
    )


def build_full_student_record(roll_no: str, db: Session) -> schemas.FullStudentRecord:
    core = build_admin_directory_student(roll_no, db)
    if not core:
        raise HTTPException(status_code=404, detail='Student record not found in database')

    def fetch_one(sql):
        row = db.execute(text(sql), {'roll_no': roll_no}).mappings().first()
        return dict(row) if row else None

    def fetch_many(sql):
        return [dict(row) for row in db.execute(text(sql), {'roll_no': roll_no}).mappings().all()]

    contact_info = fetch_one('''
        select address, pincode, phone_primary, phone_secondary, phone_tertiary, email, city
        from contact_info where roll_no = :roll_no limit 1
    ''')
    family_details = fetch_one('''
        select parent_guardian_name, occupation, parent_phone, emergency_name, emergency_address, emergency_phone,
               emergency_email, father_name, mother_name, parent_occupation, parent_address, parent_email,
               emergency_contact_name, emergency_contact_phone, emergency_contact_relation, emergency_contact_address,
               emergency_contact_email
        from family_details where roll_no = :roll_no limit 1
    ''')
    previous_academics = fetch_many('''
        select qualification, school_name, passing_year, percentage::float as percentage, level, institution, year_passing, board_university
        from previous_academics where roll_no = :roll_no order by id
    ''')
    extra_curricular = fetch_many('''
        select category, description, year, activity_type
        from extra_curricular where roll_no = :roll_no order by activity_id
    ''')
    counselor_diary = fetch_many('''
        select semester::int as semester, meeting_date, remark_category, remarks, action_planned, follow_up_date, counselor_name, created_at
        from counselor_diary where roll_no = :roll_no order by meeting_date desc nulls last, created_at desc nulls last
    ''')
    semester_grades = fetch_many('''
        select semester::int as semester, subject_code, subject_title, grade,
               marks::float as marks, internal_marks::float as internal_marks, attempt, remarks,
               grade_point::float as grade_point
        from semester_grades where roll_no = :roll_no order by semester, subject_code
    ''')
    internal_marks = fetch_many('''
        select semester::int as semester, test_number::int as test_number,
               percentage::float as percentage, subject_code, subject_title
        from internal_marks where roll_no = :roll_no order by semester, test_number, subject_code nulls last
    ''')

    return schemas.FullStudentRecord(
        roll_no=roll_no,
        core_profile=core,
        contact_info=schemas.ContactInfoRecord(**contact_info) if contact_info else None,
        family_details=schemas.FamilyDetailsRecord(**family_details) if family_details else None,
        previous_academics=[schemas.PreviousAcademicRecord(**row) for row in previous_academics],
        extra_curricular=[schemas.ExtraCurricularRecord(**row) for row in extra_curricular],
        counselor_diary=[schemas.CounselorDiaryRecord(**row) for row in counselor_diary],
        semester_grades=[schemas.SemesterGradeRecord(**row) for row in semester_grades],
        internal_marks=[schemas.InternalMarkRecord(**row) for row in internal_marks],
        record_health=build_record_health(contact_info, family_details, previous_academics, extra_curricular, counselor_diary, semester_grades, internal_marks),
        academic_snapshot=build_academic_snapshot(semester_grades, internal_marks, previous_academics),
    )


def build_admin_student_credential(roll_no: str, db: Session) -> schemas.AdminStudentCredential:
    student = db.query(models.Student).options(joinedload(models.Student.user)).filter(models.Student.roll_no == roll_no).first()
    if not student or not student.user:
        raise HTTPException(status_code=404, detail='Student credentials not found')

    dob_masked = student.dob.strftime('%d/%m/%Y') if student.dob else None
    initial_password_hint = student.dob.strftime('%d%m%Y') if student.dob and student.user.is_initial_password else None
    return schemas.AdminStudentCredential(
        roll_no=student.roll_no,
        username=student.user.username,
        is_initial_password=student.user.is_initial_password,
        initial_password_hint=initial_password_hint,
        dob_masked=dob_masked,
    )


@app.get('/')
async def root():
    return {
        'status': 'online',
        'message': 'Student Performance Analysis API',
        'endpoints': {
            'docs': '/docs',
            'login': '/token',
            'me': '/me',
            'profile_update': '/me',
            'password_change': '/me/password',
            'performance': '/student/performance/{roll_no}',
            'analytics': '/student/analytics/{roll_no}',
            'admin_overview': '/admin/overview',
            'admin_directory': '/admin/students',
            'admin_directory_insights': '/admin/directory-insights',
            'admin_full_record': '/admin/student-record/{roll_no}',
            'admin_student_credentials': '/admin/student-credentials/{roll_no}',
            'admin_import_snapshots': '/admin/import-snapshots',
            'scrape': '/scrape/{roll_no}',
        },
    }


@app.get('/health')
async def health():
    return {'status': 'healthy'}


@app.post('/token', response_model=schemas.Token)
async def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect username or password',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={'sub': user.username, 'role': get_role_name(user)}, expires_delta=access_token_expires
    )
    return {'access_token': access_token, 'token_type': 'bearer'}


@app.get('/me', response_model=schemas.CurrentUser)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return build_current_user_response(current_user, db)


@app.patch('/me', response_model=schemas.CurrentUser)
async def update_my_profile(payload: schemas.ProfileUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail='Name is required')

    student = get_student_record(current_user, db)
    if student:
        student.name = payload.name.strip()
        student.email = payload.email
        student.batch = payload.batch.strip() if payload.batch else None
        db.commit()
        db.refresh(student)
        return build_current_user_response(current_user, db)

    staff = get_staff_record(current_user, db)
    if staff:
        staff.name = payload.name.strip()
        staff.email = payload.email
        db.commit()
        db.refresh(staff)
        return build_current_user_response(current_user, db)

    raise HTTPException(status_code=404, detail='Profile record not found')


@app.post('/me/password', response_model=schemas.MessageResponse)
async def change_password(payload: schemas.PasswordChangeRequest, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not auth.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail='Current password is incorrect')
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=422, detail='New password must be at least 6 characters long')
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=422, detail='New password must be different from the current password')

    current_user.password_hash = auth.get_password_hash(payload.new_password)
    current_user.is_initial_password = False
    db.commit()
    return schemas.MessageResponse(message='Password updated successfully')


@app.get('/student/performance/{roll_no}', response_model=schemas.StudentPerformance)
async def get_student_performance(roll_no: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return get_accessible_student(roll_no, current_user, db)


@app.get('/student/analytics/{roll_no}', response_model=schemas.AnalyticsSummary)
async def get_student_analytics(roll_no: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    student = get_accessible_student(roll_no, current_user, db)
    return calculate_analytics(student)


@app.get('/admin/overview', response_model=schemas.AdminOverview)
async def get_admin_overview(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return build_admin_overview(db)


@app.get('/admin/directory-insights', response_model=schemas.AdminDirectoryInsights)
async def get_admin_directory_insights(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    directory = build_admin_directory(db)
    return build_directory_insights(directory)


@app.get('/admin/students', response_model=list[schemas.AdminDirectoryStudent])
async def get_admin_students(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    search: str = '',
    city: str = '',
    batch: str = '',
    semester: Optional[int] = Query(default=None),
    risk_only: bool = False,
    sort_by: str = Query(default='roll_no', pattern='^(roll_no|name|city|batch|semester|gpa|internal)$'),
    sort_dir: str = Query(default='desc', pattern='^(asc|desc)$'),
    limit: int = Query(default=200, ge=1, le=500),
):
    require_admin(current_user)
    directory = build_admin_directory(db)
    return filter_admin_directory(directory, search, city, batch, semester, risk_only, sort_by, sort_dir, limit)


@app.get('/admin/student-record/{roll_no}', response_model=schemas.FullStudentRecord)
async def get_admin_student_record(roll_no: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return build_full_student_record(roll_no, db)


@app.get('/admin/student-credentials/{roll_no}', response_model=schemas.AdminStudentCredential)
async def get_admin_student_credentials(roll_no: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    return build_admin_student_credential(roll_no, db)


@app.post('/admin/import-snapshots', response_model=schemas.BulkImportResponse)
async def import_snapshots(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    require_admin(current_user)
    result = scraper.PortalScraper().import_all_snapshots(db)
    return schemas.BulkImportResponse(
        message=f"Imported {result['imported_count']} students from snapshot files.",
        imported_count=result['imported_count'],
        error_count=result['error_count'],
        imported_students=[schemas.BulkImportStudentResult(**row) for row in result['imported_students']],
        errors=[schemas.BulkImportError(**row) for row in result['errors']],
    )


@app.post('/scrape/{roll_no}', response_model=schemas.ScrapeResponse)
async def trigger_scrape(roll_no: str, dob: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    get_accessible_student(roll_no, current_user, db)
    result = scraper.PortalScraper().get_parent_portal_data(roll_no, validate_dob(dob), db)
    if result['status'] == 'failed':
        raise HTTPException(status_code=504, detail=result['message'])
    return result


@app.post('/api/sync/student/{roll_no}', response_model=schemas.MessageResponse)
async def sync_student_data(roll_no: str, payload: dict, dob: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_admin(current_user)

    if not dob:
        dob = payload.get('StudentInfo', {}).get('Date Of Birth')

    if not dob:
        raise HTTPException(status_code=422, detail='Date of Birth is required for sync (either as query param or in StudentInfo)')

    dob_validated = validate_dob(dob)
    student = scraper.PortalScraper().sync_payload_to_db(roll_no, dob_validated, payload, db)

    if not student:
        raise HTTPException(status_code=400, detail='Failed to sync student data. Invalid payload format.')

    return schemas.MessageResponse(message=f'Successfully synced data for student {roll_no}')


@app.post('/api/sync/all', response_model=schemas.MessageResponse)
async def sync_all_students(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_admin(current_user)

    data_dir = scraper.DATA_DIR
    if not data_dir.exists():
        raise HTTPException(status_code=404, detail='Data directory not found')

    sync_count = 0
    errors = []
    portal_scraper = scraper.PortalScraper()

    for file_path in data_dir.glob('*_data.json'):
        roll_no = file_path.name.replace('_data.json', '')
        try:
            with open(file_path, 'r', encoding='utf-8') as file_handle:
                payload = json.load(file_handle)

            dob = payload.get('StudentInfo', {}).get('Date Of Birth')
            if not dob:
                errors.append(f'No DOB found for {roll_no}')
                continue

            dob_validated = validate_dob(dob)
            student = portal_scraper.sync_payload_to_db(roll_no, dob_validated, payload, db)
            if student:
                sync_count += 1
                print(f"Synced {roll_no} ({sync_count})")
            else:
                errors.append(f'Sync failed for {roll_no}: Invalid payload or record structure')
        except Exception as exc:
            import traceback
            error_detail = f'Error syncing {roll_no}: {str(exc)}'
            print(error_detail)
            traceback.print_exc()
            errors.append(error_detail)

    message = f'Successfully synced {sync_count} students.'
    if errors:
        message += f' Encountered {len(errors)} issues.'

    return schemas.MessageResponse(message=message)


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=8000)
