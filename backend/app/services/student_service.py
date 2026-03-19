from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from sqlalchemy.orm import joinedload
from fastapi import HTTPException
from datetime import datetime

from .. import models, schemas
from ..core.constants import GRADE_POINTS, CURRICULUM_CREDITS

class StudentService:
    @staticmethod
    async def get_student_record(user: models.User, db: AsyncSession):
        result = await db.execute(
            select(models.Student).options(joinedload(models.Student.program)).filter(models.Student.id == user.id)
        )
        return result.scalars().first()

    @staticmethod
    async def get_accessible_student(roll_no: str, current_user_id: int, role_name: str, db: AsyncSession):
        stmt = (
            select(models.Student)
            .options(
                joinedload(models.Student.program),
                joinedload(models.Student.marks).joinedload(models.StudentMark.subject),
                joinedload(models.Student.attendance),
                joinedload(models.Student.user),
            )
        )

        if role_name == 'student':
            stmt = stmt.filter(models.Student.id == current_user_id)
            result = await db.execute(stmt)
            student = result.scalars().first()
            if not student or student.roll_no != roll_no:
                raise HTTPException(status_code=403, detail='Students can only access their own records')
            return student

        stmt = stmt.filter(models.Student.roll_no == roll_no)
        result = await db.execute(stmt)
        student = result.scalars().first()
        if not student:
            raise HTTPException(status_code=404, detail='Student not found')
        return student

    @staticmethod
    def has_internal_component(subject_code: Optional[str], subject_name: Optional[str], credits: float = 0.0) -> bool:
        code = (subject_code or '').upper()
        name = (subject_name or '').lower()
        if code.startswith('24AC') or 'audit' in name or 'value added' in name or 'non credit' in name:
            return False
        if any(token in name for token in ['lab', 'project', 'practic', 'workshop']):
            return False
        if credits == 0:
            return False
        return True

    @classmethod
    async def calculate_analytics(cls, student: models.Student, db: AsyncSession) -> schemas.AnalyticsSummary:
        marks = list(student.marks or [])
        attendance = sorted(list(student.attendance or []), key=lambda item: item.date)

        graded_marks = [mark for mark in marks if mark.grade and str(mark.grade).strip() and mark.subject and CURRICULUM_CREDITS.get(mark.subject.course_code, 0) > 0]
        total_credit_points = sum(CURRICULUM_CREDITS.get(mark.subject.course_code, 0) * GRADE_POINTS.get(mark.grade, 0) for mark in graded_marks if mark.subject)
        total_credits = sum(CURRICULUM_CREDITS.get(mark.subject.course_code, 0) for mark in graded_marks if mark.subject)
        average_grade_points = round(total_credit_points / total_credits, 2) if total_credits > 0 else 0.0

        marks_with_internal = [
            float(mark.internal_marks)
            for mark in marks
            if mark.internal_marks is not None and cls.has_internal_component(
                mark.subject.course_code if mark.subject else None,
                mark.subject.name if mark.subject else None,
                CURRICULUM_CREDITS.get(mark.subject.course_code, 0) if mark.subject else 0,
            )
        ]
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
            sem_graded_marks = [mark for mark in semester_marks if mark.grade and str(mark.grade).strip() and mark.subject and CURRICULUM_CREDITS.get(mark.subject.course_code, 0) > 0]
            sem_credit_points = sum(CURRICULUM_CREDITS.get(mark.subject.course_code, 0) * GRADE_POINTS.get(mark.grade, 0) for mark in sem_graded_marks if mark.subject)
            sem_credits = sum(CURRICULUM_CREDITS.get(mark.subject.course_code, 0) for mark in sem_graded_marks if mark.subject)
            sem_sgpa = round(sem_credit_points / sem_credits, 2) if sem_credits > 0 else 0.0

            semester_internals = [
                float(mark.internal_marks)
                for mark in semester_marks
                if mark.internal_marks is not None and cls.has_internal_component(
                    mark.subject.course_code if mark.subject else None,
                    mark.subject.name if mark.subject else None,
                    CURRICULUM_CREDITS.get(mark.subject.course_code, 0) if mark.subject else 0,
                )
            ]
            semester_performance.append(
                schemas.SemesterPerformanceItem(
                    semester=semester,
                    subject_count=len(semester_marks),
                    average_internal=round(sum(semester_internals) / len(semester_internals), 2) if semester_internals else 0.0,
                    average_grade_points=sem_sgpa,
                    backlog_count=sum(1 for mark in semester_marks if (mark.grade or '').upper() in {'U', 'FAIL', 'W', 'I'}),
                )
            )

        risk_subjects = []
        for mark in marks:
            grade_value = GRADE_POINTS.get(mark.grade, 0)
            internal_value = float(mark.internal_marks) if mark.internal_marks is not None else 0.0
            applicable_internal = cls.has_internal_component(
                mark.subject.course_code if mark.subject else None,
                mark.subject.name if mark.subject else None,
                CURRICULUM_CREDITS.get(mark.subject.course_code, 0) if mark.subject else 0,
            )
            if grade_value <= 5 or (applicable_internal and mark.internal_marks is not None and internal_value < 60):
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
            score = GRADE_POINTS.get(mark.grade, 0) * 10
            if cls.has_internal_component(mark.subject.course_code, mark.subject.name, CURRICULUM_CREDITS.get(mark.subject.course_code, 0)):
                score += float(mark.internal_marks) if mark.internal_marks is not None else 0.0
            elif mark.total_marks is not None:
                score += float(mark.total_marks)
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

    @classmethod
    async def calculate_student_risk(cls, student: models.Student, db: AsyncSession) -> schemas.StudentRiskScore:
        analytics = await cls.calculate_analytics(student, db)
        
        risk_score = 0.0
        alerts = []
        
        att_percentage = analytics.attendance.percentage
        att_risk = max(0, (75 - att_percentage) / 75 * 100) if att_percentage < 75 else 0
        risk_score += att_risk * 0.3
        if att_percentage < 75:
            alerts.append(f"Low Attendance: {att_percentage}%")
            
        internal_avg = analytics.average_internal
        internal_marks_available = any(
            mark.internal_marks is not None and cls.has_internal_component(
                mark.subject.course_code if mark.subject else None,
                mark.subject.name if mark.subject else None,
                CURRICULUM_CREDITS.get(mark.subject.course_code, 0) if mark.subject else 0,
            )
            for mark in (student.marks or [])
        )
        if internal_marks_available:
            internal_risk = max(0, (60 - internal_avg) / 60 * 100) if internal_avg < 60 else 0
            risk_score += internal_risk * 0.3
            if internal_avg < 60:
                alerts.append(f"Low Internals: {internal_avg}%")
            
        gpa_drop = 0.0
        if len(analytics.semester_performance) >= 2:
            perf = sorted(analytics.semester_performance, key=lambda x: x.semester)
            current_gpa = perf[-1].average_grade_points
            prev_gpa = perf[-2].average_grade_points
            gpa_drop = max(0, prev_gpa - current_gpa)
            velocity_risk = min(100, gpa_drop * 50)
            risk_score += velocity_risk * 0.4
            if gpa_drop > 0.5:
                alerts.append(f"Significant GPA Drop: -{round(gpa_drop, 2)}")

        risk_level = "Low"
        if risk_score > 70: risk_level = "Critical"
        elif risk_score > 50: risk_level = "High"
        elif risk_score > 30: risk_level = "Moderate"

        return schemas.StudentRiskScore(
            roll_no=student.roll_no,
            name=student.name,
            risk_score=round(risk_score, 2),
            attendance_factor=round(att_percentage, 2),
            internal_marks_factor=round(internal_avg, 2),
            gpa_drop_factor=round(gpa_drop, 2),
            is_at_risk=risk_score > 50,
            risk_level=risk_level,
            alerts=alerts
        )

    @classmethod
    async def build_student_command_center(cls, student: models.Student, db: AsyncSession) -> schemas.StudentCommandCenterResponse:
        analytics = await cls.calculate_analytics(student, db)
        risk = await cls.calculate_student_risk(student, db)
        
        # This will be fully implemented when AdminService is ready to provide rankings efficiently.
        # For now, placeholder for metrics
        gpa_trend = 0.0
        placement_readiness = 80.0 # Placeholder
        
        metrics = [
            schemas.StudentMetricCard(
                label="GPA Proxy", 
                value=analytics.average_grade_points, 
                trend=gpa_trend,
                icon="TrendingUp",
                hint="Based on current semester internals and historic grades"
            ),
            schemas.StudentMetricCard(
                label="Attendance", 
                value=analytics.attendance.percentage, 
                unit="%",
                icon="Calendar",
                hint=f"{analytics.attendance.absent_days} absences recorded this semester"
            ),
            schemas.StudentMetricCard(
                label="Placement Readiness", 
                value=placement_readiness, 
                unit="%",
                icon="Target",
                hint="Score based on CGPA, Backlogs, and Skill Domain performance"
            ),
            schemas.StudentMetricCard(
                label="Active Backlogs", 
                value=float(analytics.total_backlogs),
                icon="AlertTriangle",
                hint="Clear existing backlogs to improve placement eligibility"
            ),
        ]

        recommended_actions = []
        if analytics.attendance.percentage < 75:
            recommended_actions.append(schemas.StudentActionItem(
                title="Improve Attendance",
                detail=f"Your attendance is {analytics.attendance.percentage}%. You need 75% to be eligible for exams.",
                tone="critical"
            ))
        
        if analytics.total_backlogs > 0:
            recommended_actions.append(schemas.StudentActionItem(
                title="Clear Backlogs",
                detail=f"You have {analytics.total_backlogs} active backlogs. Focus on clearing them in the next attempt.",
                tone="warning"
            ))

        if analytics.average_grade_points < 6.0:
            recommended_actions.append(schemas.StudentActionItem(
                title="Academic Support",
                detail="Your current GPA proxy is below 6.0. Consider reaching out to your counselor for guidance.",
                tone="warning"
            ))

        if not recommended_actions:
            recommended_actions.append(schemas.StudentActionItem(
                title="Maintain Momentum",
                detail="Your academic profile looks strong! Keep up the consistent performance.",
                tone="positive"
            ))
        # Clamp risk score to [0, 100]
        risk_score = max(0, min(100, risk.risk_score))

        return schemas.StudentCommandCenterResponse(
            roll_no=student.roll_no,
            student_name=student.name,
            batch=student.batch,
            current_semester=student.current_semester,
            analytics=analytics,
            risk=risk,
            metrics=metrics,
            recommended_actions=recommended_actions,
            semester_focus=[],
            recent_results=[],
        )

    @staticmethod
    def build_record_health(contact_info, family_details, previous_academics, extra_curricular, counselor_diary, semester_grades, internal_marks):
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
        
        return schemas.StudentRecordHealth(
            completion_percentage=completion_percentage,
            available_sections=available_sections,
            missing_sections=missing_sections,
        )
    @staticmethod
    async def get_detailed_attendance(
        student_id: int, 
        semester: Optional[int], 
        page: int, 
        size: int, 
        db: AsyncSession
    ) -> schemas.PaginatedAttendance:
        base_stmt = select(models.Attendance).filter(models.Attendance.student_id == student_id)
        
        if semester:
            base_stmt = base_stmt.filter(models.Attendance.semester == semester)
            
        # Get total count for pagination
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = await db.scalar(count_stmt) or 0
        
        # Calculate summary for the filtered data
        summary_stmt = select(
            func.sum(models.Attendance.total_present).label("total_present"),
            func.sum(models.Attendance.total_hours).label("total_hours"),
            func.count().label("total_days")
        ).filter(models.Attendance.student_id == student_id)
        
        if semester:
            summary_stmt = summary_stmt.filter(models.Attendance.semester == semester)
            
        summary_result = await db.execute(summary_stmt)
        summary_row = summary_result.first()
        
        summary = None
        if summary_row and summary_row.total_hours:
            absent_days_stmt = select(func.count()).filter(
                models.Attendance.student_id == student_id,
                models.Attendance.total_present < models.Attendance.total_hours
            )
            if semester:
                absent_days_stmt = absent_days_stmt.filter(models.Attendance.semester == semester)
            
            absent_days = await db.scalar(absent_days_stmt) or 0
            
            summary = schemas.AttendanceInsight(
                total_present=int(summary_row.total_present or 0),
                total_hours=int(summary_row.total_hours or 0),
                percentage=round((summary_row.total_present / summary_row.total_hours) * 100, 2),
                recent_streak_days=0, # Streak calculation is complex for filtered views
                absent_days=absent_days
            )
            
        # Apply sorting and pagination for items
        stmt = base_stmt.order_by(models.Attendance.date.desc()).offset((page - 1) * size).limit(size)
        result = await db.execute(stmt)
        items = result.scalars().all()
        
        pages = (total + size - 1) // size if size > 0 else 0
        
        return schemas.PaginatedAttendance(
            items=[schemas.AttendanceResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            size=size,
            pages=pages,
            summary=summary
        )
