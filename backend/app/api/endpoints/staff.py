from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import joinedload

from ...core import auth
from ...core.database import get_db
from ...models import base as models
from ...schemas import base as schemas
from ...core.limiter import limiter
from ...services.timetable_service import get_faculty_timetable

router = APIRouter(tags=["Staff"])


@router.get(
    "/schedule",
    response_model=List[schemas.StaffTimeTableEntry],
    summary="Get Staff Timetable",
    description="Return weekly timetable entries for the logged-in faculty. Falls back to the latest MCA II semester timetable if no DB rows exist.",
)
async def get_staff_schedule(
    section: Optional[str] = Query(None, description="Section filter, e.g., A or B"),
    semester: Optional[int] = Query(None, description="Semester filter"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.role.name != "staff":
        raise HTTPException(status_code=403, detail="Access forbidden: Staff only")

    timetable = await get_faculty_timetable(
        db=db,
        faculty_id=current_user.id,
        section=section,
        semester=semester,
    )
    return timetable

@router.get(
    "/me",
    response_model=schemas.StaffDashboardResponse,
    summary="Get Staff Dashboard Data",
    description="Retrieve dashboard data for the currently authenticated staff member, including assigned subjects."
)
@limiter.limit("20/minute")
async def get_staff_dashboard(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role.name != "staff":
        raise HTTPException(status_code=403, detail="Access forbidden: Staff only")

    # Fetch staff details
    result = await db.execute(select(models.Staff).filter(models.Staff.id == current_user.id))
    staff = result.scalars().first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    # Fetch assigned subjects
    result = await db.execute(
        select(models.FacultySubjectAssignment)
        .options(joinedload(models.FacultySubjectAssignment.subject))
        .filter(models.FacultySubjectAssignment.faculty_id == staff.id)
    )
    assignments = result.scalars().all()

    subjects = []
    total_students = 0
    total_pending_marks = 0
    total_performance_acc = 0.0
    performance_count = 0
    recent_updates = []

    for a in assignments:
        students_res = await db.execute(
            select(models.Student)
            .filter(models.Student.program_id == a.subject.program_id)
            .filter(models.Student.current_semester == a.subject.semester)
        )
        students = students_res.scalars().all()
        count = len(students)
        total_students += count
        
        student_ids = [s.id for s in students]
        if not student_ids:
            subjects.append(schemas.StaffSubject(
                id=a.id,
                subject_id=a.subject_id,
                subject_name=a.subject.name,
                course_code=a.subject.course_code,
                semester=a.subject.semester,
                section=a.section,
                academic_year=a.academic_year,
                student_count=0,
                average_marks=0.0,
                pass_percentage=0.0
            ))
            continue

        marks_res = await db.execute(
            select(models.StudentMark)
            .filter(models.StudentMark.subject_id == a.subject_id)
            .filter(models.StudentMark.student_id.in_(student_ids))
        )
        marks = marks_res.scalars().all()

        passed = 0
        total_m = 0.0
        
        for m in marks:
            if m.result_status == 'Pass':
                passed += 1
            if m.total_marks is not None:
                total_m += float(m.total_marks)
                total_performance_acc += float(m.total_marks)
                performance_count += 1
            
            if m.semester_exam_marks is None:
                total_pending_marks += 1
            
            if m.updated_at:
                stu_name = next((s.name for s in students if s.id == m.student_id), "Unknown")
                stu_roll = next((s.roll_no for s in students if s.id == m.student_id), "Unknown")
                recent_updates.append(schemas.RecentMarkUpdate(
                    subject_name=a.subject.name,
                    student_name=stu_name,
                    roll_no=stu_roll,
                    action="Updated assessment record",
                    updated_at=m.updated_at
                ))

        total_pending_marks += (count - len(marks))
        pass_percentage = (passed / len(marks) * 100) if marks else 0.0
        average_marks = (total_m / len(marks)) if marks else 0.0

        att_res = await db.execute(
            select(models.Attendance)
            .filter(models.Attendance.subject_id == a.subject_id)
        )
        attendance_records = att_res.scalars().all()
        
        total_p = 0
        total_a = 0
        for att in attendance_records:
            total_p += att.total_present
            total_a += len(att.absentee_roll_nos) if att.absentee_roll_nos else 0
            
        avg_attendance = (total_p / (total_p + total_a) * 100) if (total_p + total_a) > 0 else 0.0

        subjects.append(schemas.StaffSubject(
            id=a.id,
            subject_id=a.subject_id,
            subject_name=a.subject.name,
            course_code=a.subject.course_code,
            semester=a.subject.semester,
            section=a.section,
            academic_year=a.academic_year,
            student_count=count,
            average_marks=round(average_marks, 2),
            pass_percentage=round(pass_percentage, 2),
            average_attendance=round(avg_attendance, 2)
        ))

    overall_avg = (total_performance_acc / performance_count) if performance_count > 0 else 0.0
    recent_updates.sort(key=lambda x: x.updated_at, reverse=True)
    top_5_updates = recent_updates[:5]

    return schemas.StaffDashboardResponse(
        staff_id=staff.id,
        name=staff.name,
        department=staff.department,
        subjects=subjects,
        total_students_handled=total_students,
        recent_marks_updates=top_5_updates,
        average_performance=round(overall_avg, 2),
        pending_marks_count=total_pending_marks
    )

@router.get(
    "/subjects/{subject_id}/students",
    response_model=List[schemas.AdminDirectoryStudent],
    summary="Get Students for Subject",
    description="List all students enrolled in a specific subject/section assigned to the staff."
)
async def get_subject_students(
    subject_id: int = Path(...),
    section: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role.name != "staff":
        raise HTTPException(status_code=403, detail="Access forbidden: Staff only")

    # Verify assignment
    result = await db.execute(
        select(models.FacultySubjectAssignment)
        .filter(models.FacultySubjectAssignment.faculty_id == current_user.id)
        .filter(models.FacultySubjectAssignment.subject_id == subject_id)
    )
    assignment = result.scalars().first()
    if not assignment:
        raise HTTPException(status_code=403, detail="Not assigned to this subject")

    # Fetch subject to get program/semester
    result = await db.execute(select(models.Subject).filter(models.Subject.id == subject_id))
    subject = result.scalars().first()

    # Fetch students
    # Simplified: match program and semester. If section is used in students table, filter by that too.
    # Checking if models.Student has section... (it doesn't seem to have it in the snippet above, but let's check base.py again)
    query = select(models.Student).filter(
        models.Student.program_id == subject.program_id,
        models.Student.current_semester == subject.semester
    )
    
    # If section filtering is needed, we'd need a section column in students table.
    # For now, we'll return all students in that program/semester.
    
    result = await db.execute(query)
    students = result.scalars().all()

    # Return as AdminDirectoryStudent (reusing existing schema)
    # We might need to fetch marks/attendance too if the schema requires it
    # AdminDirectoryStudent has many fields, many are optional.
    
    res = []
    for s in students:
        res.append(schemas.AdminDirectoryStudent(
            roll_no=s.roll_no,
            name=s.name,
            batch=s.batch,
            current_semester=s.current_semester,
            # Placeholder/Empty values for complex fields for now
            marks_count=0,
            attendance_count=0,
            attendance_percentage=0.0,
            average_grade_points=0.0,
            backlogs=0
        ))
    
    return res

@router.patch(
    "/marks",
    response_model=schemas.MessageResponse,
    summary="Update Student Marks",
    description="Batch update marks for multiple students in a subject."
)
async def update_marks(
    updates: List[schemas.StaffStudentMarkUpdate] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role.name != "staff":
        raise HTTPException(status_code=403, detail="Access forbidden: Staff only")

    for update_item in updates:
        # Verify assignment for each subject requested
        result = await db.execute(
            select(models.FacultySubjectAssignment)
            .filter(models.FacultySubjectAssignment.faculty_id == current_user.id)
            .filter(models.FacultySubjectAssignment.subject_id == update_item.subject_id)
        )
        if not result.scalars().first():
            raise HTTPException(status_code=403, detail=f"Not assigned to subject ID {update_item.subject_id}")

        # Check if record exists
        result = await db.execute(
            select(models.StudentMark)
            .filter(models.StudentMark.student_id == update_item.student_id)
            .filter(models.StudentMark.subject_id == update_item.subject_id)
            .filter(models.StudentMark.semester == update_item.semester)
        )
        mark_record = result.scalars().first()

        if mark_record:
            # Update
            update_data = update_item.model_dump(exclude_unset=True, exclude={'student_id', 'subject_id', 'semester'})
            if update_data:
                await db.execute(
                    update(models.StudentMark)
                    .where(models.StudentMark.id == mark_record.id)
                    .values(**update_data)
                )
        else:
            # Create
            new_mark = models.StudentMark(
                student_id=update_item.student_id,
                subject_id=update_item.subject_id,
                semester=update_item.semester,
                cit1_marks=update_item.cit1_marks,
                cit2_marks=update_item.cit2_marks,
                cit3_marks=update_item.cit3_marks,
                semester_exam_marks=update_item.semester_exam_marks
            )
            db.add(new_mark)

    await db.commit()
    return schemas.MessageResponse(message="Marks updated successfully")

@router.post(
    "/attendance",
    response_model=schemas.MessageResponse,
    summary="Submit Attendance",
    description="Mark attendance for a specific subject and hour. Students not in the absentees list will be marked present."
)
async def submit_attendance(
    attendance_data: schemas.StaffAttendanceCreate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role.name != "staff":
        raise HTTPException(status_code=403, detail="Access forbidden: Staff only")

    # Verify assignment
    assignment_res = await db.execute(
        select(models.FacultySubjectAssignment)
        .filter(models.FacultySubjectAssignment.faculty_id == current_user.id)
        .filter(models.FacultySubjectAssignment.subject_id == attendance_data.subject_id)
    )
    if not assignment_res.scalars().first():
        raise HTTPException(status_code=403, detail=f"Not assigned to subject ID {attendance_data.subject_id}")

    # Fetch subject to get program
    subject_res = await db.execute(select(models.Subject).filter(models.Subject.id == attendance_data.subject_id))
    subject = subject_res.scalars().first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Fetch all students in this program/semester
    students_res = await db.execute(
        select(models.Student)
        .filter(models.Student.program_id == subject.program_id)
        .filter(models.Student.current_semester == attendance_data.semester)
    )
    students = students_res.scalars().all()

    if not students:
        raise HTTPException(status_code=400, detail="No students found for this subject criteria.")

    absentees_set = {roll.strip().upper() for roll in attendance_data.absentees if roll.strip()}

    for student in students:
        record_res = await db.execute(
            select(models.Attendance)
            .filter(models.Attendance.student_id == student.id)
            .filter(models.Attendance.date == attendance_data.date)
        )
        record = record_res.scalars().first()

        is_absent = student.roll_no.strip().upper() in absentees_set

        if record:
            status_array = list(record.status_array)
            while len(status_array) < 7:
                status_array.append('P')
                
            status_array[attendance_data.hour - 1] = 'A' if is_absent else 'P'
            total_present = sum(1 for status in status_array if status == 'P')
            
            await db.execute(
                update(models.Attendance)
                .where(models.Attendance.id == record.id)
                .values(
                    status_array=status_array,
                    total_present=total_present
                )
            )
        else:
            status_array = ['P' for _ in range(7)]
            status_array[attendance_data.hour - 1] = 'A' if is_absent else 'P'
            total_present = sum(1 for status in status_array if status == 'P')
            
            new_record = models.Attendance(
                student_id=student.id,
                date=attendance_data.date,
                hours_per_day=7,
                status_array=status_array,
                total_present=total_present,
                total_hours=7,
                semester=attendance_data.semester
            )
            db.add(new_record)

    await db.commit()
    return schemas.MessageResponse(message="Attendance submitted successfully")
