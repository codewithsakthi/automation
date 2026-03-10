import importlib.util
import json
import re
import time
from datetime import datetime
from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import auth, models

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = PROJECT_ROOT / 'script.py'
DATA_DIR = PROJECT_ROOT / 'data'


def _load_script_scraper():
    if not SCRIPT_PATH.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location('automation_script_scraper', SCRIPT_PATH)
        if not spec or not spec.loader:
            return None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return getattr(module, 'get_parent_portal_info', None)
    except Exception:
        return None


script_get_parent_portal_info = _load_script_scraper()


class PortalScraper:
    def __init__(self):
        self.snapshot_dir = DATA_DIR

    def _parse_dob(self, dob: str):
        for fmt in ('%d%m%Y', '%d/%m/%Y', '%Y-%m-%d'):
            try:
                return datetime.strptime(dob, fmt).date()
            except ValueError:
                continue
        return None

    def _normalize_dob_password(self, dob: str):
        parsed = self._parse_dob(dob)
        if parsed:
            return parsed.strftime('%d%m%Y')
        digits = re.sub(r'\D', '', dob or '')
        return digits[:8] if digits else None

    def _get_student_role(self, db: Session):
        return db.query(models.Role).filter(models.Role.name == 'student').first()

    def _normalize_grade(self, grade: str | None):
        if not grade:
            return None
        normalized = str(grade).strip().upper()
        grade_map = {
            'PASS': 'P',
            'FAIL': 'F',
            'ABSENT': 'AB',
        }
        normalized = grade_map.get(normalized, normalized)
        return normalized[:2]

    def _load_snapshot(self, roll_no: str):
        path = self.snapshot_dir / f'{roll_no}_data.json'
        if not path.exists():
            return None
        try:
            with path.open('r', encoding='utf-8') as handle:
                payload = json.load(handle)
        except Exception:
            return None

        parent = payload.get('ParentPortal', {})
        info = parent.get('Info') or {}
        marks = parent.get('Marks') or []
        detailed_attendance = parent.get('DetailedAttendance') or {}
        attendance_summary = parent.get('AttendanceSummary') or []
        cit_marks = parent.get('CITMarks') or {}
        university_marks = parent.get('UniversityMarks') or []
        coe_results = payload.get('COEResults') or []
        if not info:
            return None
        return info, marks, detailed_attendance, attendance_summary, cit_marks, university_marks, coe_results

    def _get_or_create_subject(self, subject_desc, semester, db: Session):
        course_code = subject_desc.split('-', 1)[0].strip() if '-' in subject_desc else subject_desc.strip()[:20]
        subject = db.query(models.Subject).filter(models.Subject.course_code == course_code).first()
        if not subject:
            name = subject_desc.split('-', 1)[1].strip() if '-' in subject_desc else subject_desc.strip()
            subject = models.Subject(course_code=course_code, name=name, semester=semester)
            db.add(subject)
            db.flush()
        return subject

    def _find_subject_by_name(self, subject_name, db: Session):
        normalized = re.sub(r'\s+', ' ', subject_name).strip().lower()
        subjects = db.query(models.Subject).all()
        for subject in subjects:
            if subject.name and normalized == re.sub(r'\s+', ' ', subject.name).strip().lower():
                return subject
        for subject in subjects:
            if subject.name and normalized in re.sub(r'\s+', ' ', subject.name).strip().lower():
                return subject
        return None

    def _sync_student_record(self, roll_no, dob, info, db: Session):
        student = db.query(models.Student).filter(models.Student.roll_no == roll_no).first()
        user = db.query(models.User).filter(models.User.username == roll_no).first()
        if not user:
            student_role = self._get_student_role(db)
            if not student_role:
                raise ValueError('Student role not found')
            initial_password = self._normalize_dob_password(dob)
            if not initial_password:
                raise ValueError(f'Unable to derive initial password from DOB for {roll_no}')
            user = models.User(
                username=roll_no,
                password_hash=auth.get_password_hash(initial_password),
                role_id=student_role.id,
                is_initial_password=True,
            )
            try:
                db.add(user)
                db.flush()
            except IntegrityError:
                db.rollback()
                user = db.query(models.User).filter(models.User.username == roll_no).first()
                if not user:
                    raise

        if not student:
            student = models.Student(
                id=user.id,
                roll_no=roll_no,
                name=info.get('Name', roll_no),
                reg_no=info.get('RegNo'),
                batch=info.get('Batch'),
                email=info.get('Email') or None,
                dob=self._parse_dob(dob) or datetime.utcnow().date(),
            )
            db.add(student)
            db.flush()

        if student:
            student.name = info.get('Name', student.name)
            student.reg_no = info.get('RegNo') or student.reg_no
            student.batch = info.get('Batch') or student.batch
            student.email = info.get('Email') or student.email
            parsed_dob = self._parse_dob(dob)
            if parsed_dob:
                student.dob = parsed_dob
            semester = str(info.get('Semester', '')).strip()
            if semester.isdigit():
                student.current_semester = int(semester)
            db.flush()
        return student

    def _sync_marks_to_db(self, student, marks, cit_marks, university_marks, db: Session):
        if not student:
            return

        for mark in marks:
            semester = int(mark['Sem']) if str(mark.get('Sem', '')).isdigit() else 0
            subject = self._get_or_create_subject(mark['Subject'], semester, db)
            entry = db.query(models.StudentMark).filter(
                models.StudentMark.student_id == student.id,
                models.StudentMark.subject_id == subject.id,
                models.StudentMark.semester == semester,
            ).first()
            if not entry:
                entry = models.StudentMark(student_id=student.id, subject_id=subject.id, semester=semester)
                db.add(entry)
            entry.grade = self._normalize_grade(mark.get('Grade'))

        for item in university_marks:
            semester = int(item['Semester']) if str(item.get('Semester', '')).isdigit() else 0
            subject = db.query(models.Subject).filter(models.Subject.course_code == item['PaperCode']).first()
            if not subject:
                credit = item.get('Credit', '0')
                subject = models.Subject(
                    course_code=item['PaperCode'],
                    name=item['PaperName'],
                    credits=int(float(credit)) if str(credit).replace('.', '', 1).isdigit() else 0,
                    semester=semester,
                )
                db.add(subject)
                db.flush()
            entry = db.query(models.StudentMark).filter(
                models.StudentMark.student_id == student.id,
                models.StudentMark.subject_id == subject.id,
                models.StudentMark.semester == semester,
            ).first()
            if not entry:
                entry = models.StudentMark(student_id=student.id, subject_id=subject.id, semester=semester)
                db.add(entry)
            entry.grade = self._normalize_grade(item.get('Grade')) or entry.grade

        test_field_map = {'Test_1': 'cit1_marks', 'Test_2': 'cit2_marks', 'Test_3': 'cit3_marks'}
        for semester_key, tests in cit_marks.items():
            semester_match = re.search(r'(\d+)$', semester_key)
            semester = int(semester_match.group(1)) if semester_match else 0
            for test_name, entries in tests.items():
                field_name = test_field_map.get(test_name)
                if not field_name:
                    continue
                for item in entries:
                    if 'Subject' not in item or 'Marks' not in item:
                        continue
                    subject = self._find_subject_by_name(item['Subject'], db)
                    if not subject:
                        continue
                    entry = db.query(models.StudentMark).filter(
                        models.StudentMark.student_id == student.id,
                        models.StudentMark.subject_id == subject.id,
                        models.StudentMark.semester == semester,
                    ).first()
                    if not entry:
                        entry = models.StudentMark(student_id=student.id, subject_id=subject.id, semester=semester)
                        db.add(entry)
                    try:
                        setattr(entry, field_name, float(item['Marks']))
                    except (TypeError, ValueError):
                        continue
                    values = [entry.cit1_marks, entry.cit2_marks, entry.cit3_marks]
                    numeric_values = [float(value) for value in values if value is not None]
                    if numeric_values:
                        entry.internal_marks = sum(numeric_values) / len(numeric_values)

    def _sync_attendance_to_db(self, student, detailed_attendance, db: Session):
        if not student:
            return
        for _, days in detailed_attendance.items():
            for day in days:
                try:
                    att_date = datetime.strptime(day['Date'], '%d-%m-%Y').date()
                except ValueError:
                    continue
                existing = db.query(models.Attendance).filter(
                    models.Attendance.student_id == student.id,
                    models.Attendance.date == att_date,
                ).first()
                status_array = day.get('Status', [])
                hours_per_day = int(day.get('HoursPerDay', 0)) if str(day.get('HoursPerDay', '')).isdigit() else len(status_array)
                total_present = sum(1 for status in status_array if status.upper() in {'P', 'OD'})
                total_hours = hours_per_day
                if existing:
                    existing.hours_per_day = hours_per_day
                    existing.status_array = status_array
                    existing.total_present = total_present
                    existing.total_hours = total_hours
                else:
                    db.add(models.Attendance(
                        student_id=student.id,
                        date=att_date,
                        hours_per_day=hours_per_day,
                        status_array=status_array,
                        total_present=total_present,
                        total_hours=total_hours,
                    ))

    def _flatten_cit_marks(self, cit_marks):
        return [
            {
                'semester': semester,
                'tests': [{'test_name': test_name, 'entries': entries} for test_name, entries in tests.items()]
            }
            for semester, tests in cit_marks.items()
        ]

    def _flatten_detailed_attendance(self, detailed_attendance):
        flattened = []
        for _, days in detailed_attendance.items():
            flattened.extend(days)
        return flattened

    def _build_response(self, status, message, info, marks, detailed_attendance, attendance_summary, cit_marks, university_marks, coe_results, started_at, warnings, used_cached_data):
        return {
            'status': status,
            'message': message,
            'info': info,
            'marks': marks,
            'attendance_summary': attendance_summary,
            'detailed_attendance': self._flatten_detailed_attendance(detailed_attendance),
            'cit_marks': self._flatten_cit_marks(cit_marks),
            'university_marks': university_marks,
            'coe_results': coe_results,
            'meta': {
                'attempts': 1,
                'timeouts': [],
                'duration_seconds': round(time.time() - started_at, 2),
                'warnings': warnings,
                'used_cached_data': used_cached_data,
            },
        }

    def sync_payload_to_db(self, roll_no: str, dob: str, payload: dict, db: Session):
        """
        Generic method to sync a student data payload (from script.py JSON format) to the database.
        """
        student_info = payload.get('StudentInfo', {}) or {}
        parent = payload.get('ParentPortal', {})
        info = parent.get('Info') or {}
        if student_info:
            info = {
                **info,
                'Name': info.get('Name') or student_info.get('Name'),
                'RollNo': info.get('RollNo') or student_info.get('Roll No') or roll_no,
                'Email': student_info.get('Email address'),
            }
        marks = parent.get('Marks') or []
        detailed_attendance = parent.get('DetailedAttendance') or {}
        attendance_summary = parent.get('AttendanceSummary') or []
        cit_marks = parent.get('CITMarks') or {}
        university_marks = parent.get('UniversityMarks') or []

        if not info:
            return None

        student = self._sync_student_record(roll_no, dob, info, db)
        if student:
            self._sync_marks_to_db(student, marks, cit_marks, university_marks, db)
            self._sync_attendance_to_db(student, detailed_attendance, db)
            db.commit()
            db.refresh(student)
        return student

    def import_snapshot_file(self, file_path: Path, db: Session):
        with file_path.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)

        student_info = payload.get('StudentInfo', {}) or {}
        roll_no = student_info.get('Roll No') or file_path.name.replace('_data.json', '')
        dob = student_info.get('Date Of Birth')
        if not dob:
            raise ValueError(f'DOB not found in {file_path.name}')

        student = self.sync_payload_to_db(roll_no, dob, payload, db)
        if not student:
            raise ValueError(f'Invalid payload in {file_path.name}')

        return {
            'roll_no': roll_no,
            'name': student.name,
            'username': roll_no,
            'initial_password': self._normalize_dob_password(dob),
            'file_name': file_path.name,
        }

    def import_all_snapshots(self, db: Session):
        if not self.snapshot_dir.exists():
            raise FileNotFoundError(f'Data directory not found: {self.snapshot_dir}')

        imported = []
        errors = []
        for file_path in sorted(self.snapshot_dir.glob('*_data.json')):
            try:
                imported.append(self.import_snapshot_file(file_path, db))
            except Exception as exc:
                db.rollback()
                errors.append({'file_name': file_path.name, 'error': str(exc)})

        return {
            'imported_count': len(imported),
            'error_count': len(errors),
            'imported_students': imported,
            'errors': errors,
        }

    def get_parent_portal_data(self, roll_no: str, dob: str, db: Session):
        started_at = time.time()
        warnings = []

        live_payload = None
        if script_get_parent_portal_info:
            try:
                live_payload = script_get_parent_portal_info(roll_no, dob)
            except Exception as exc:
                warnings.append(f'Live portal scrape failed: {exc}')
        else:
            warnings.append(f'Unable to load script scraper from {SCRIPT_PATH}')

        if live_payload and live_payload[0]:
            if len(live_payload) == 7:
                info, marks, detailed_attendance, attendance_summary, cit_marks, university_marks, coe_results = live_payload
            else:
                info, marks, detailed_attendance, attendance_summary, cit_marks, university_marks = live_payload
                coe_results = []
            
            # Note: live_payload matches the tuple structure returned by script.get_parent_portal_info
            student = self._sync_student_record(roll_no, dob, info, db)
            self._sync_marks_to_db(student, marks, cit_marks, university_marks, db)
            # Optionally handle coe_results here if there's a model for it. 
            # For now, coe_results might be redundant with university_marks if they overlap, 
            # but we can store them if needed.
            self._sync_attendance_to_db(student, detailed_attendance, db)
            
            # Since build_response needs coe_results (which we should add to its signature)
            return self._build_response(
                'success',
                'Portal data synced successfully.',
                info,
                marks,
                detailed_attendance,
                attendance_summary,
                cit_marks,
                university_marks,
                coe_results,
                started_at,
                warnings,
                False,
            )

        # Fallback to SNAPSHOT file (stored in data/ folder)
        snapshot_payload = self._load_snapshot(roll_no)
        if snapshot_payload:
            warnings.append(f'Live portal did not return student data. Loaded snapshot from {self.snapshot_dir}.')
            info, marks, detailed_attendance, attendance_summary, cit_marks, university_marks, coe_results = snapshot_payload
            student = self._sync_student_record(roll_no, dob, info, db)
            self._sync_marks_to_db(student, marks, cit_marks, university_marks, db)
            self._sync_attendance_to_db(student, detailed_attendance, db)
            return self._build_response(
                'cached',
                'Live portal is unavailable right now, so the latest saved snapshot was loaded.',
                info,
                marks,
                detailed_attendance,
                attendance_summary,
                cit_marks,
                university_marks,
                coe_results,
                started_at,
                warnings,
                True,
            )

        return {
            'status': 'failed',
            'message': 'The parent portal did not return student data, and no saved snapshot was available.',
            'info': None,
            'marks': [],
            'attendance_summary': [],
            'detailed_attendance': [],
            'cit_marks': [],
            'university_marks': [],
            'meta': {
                'attempts': 1,
                'timeouts': [],
                'duration_seconds': round(time.time() - started_at, 2),
                'warnings': warnings,
                'used_cached_data': False,
            },
        }
