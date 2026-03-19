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

router = APIRouter(tags=["Staff"])

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
    for a in assignments:
        # Count students in this subject/section
        # For now, we assume students are linked to programs/semesters
        # And assignments are also linked to subjects (which have programs/semesters)
        # We can count students in that program/semester
        student_count_res = await db.execute(
            select(func.count(models.Student.id))
            .filter(models.Student.program_id == a.subject.program_id)
            .filter(models.Student.current_semester == a.subject.semester)
        )
        count = student_count_res.scalar() or 0
        total_students += count
        
        subjects.append(schemas.StaffSubject(
            id=a.id,
            subject_id=a.subject_id,
            subject_name=a.subject.name,
            course_code=a.subject.course_code,
            semester=a.subject.semester,
            section=a.section,
            academic_year=a.academic_year,
            student_count=count
        ))

    return schemas.StaffDashboardResponse(
        staff_id=staff.id,
        name=staff.name,
        department=staff.department,
        subjects=subjects,
        total_students_handled=total_students,
        recent_marks_updates=[] # TODO: Implement tracking of recent updates
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
