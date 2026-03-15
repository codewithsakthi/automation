from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession

from ...core import auth
from ...core.database import get_db
from ...models import base as models
from ...schemas import base as schemas
from ...services.student_service import StudentService

# Common responses for students router
STUDENT_RESPONSES = {
    401: {"description": "Unauthorized - Missing or invalid token", "model": schemas.MessageResponse},
    404: {"description": "Student not found", "model": schemas.MessageResponse},
}

router = APIRouter(tags=["Students"], responses=STUDENT_RESPONSES)

@router.get(
    "/performance/{roll_no}", 
    response_model=schemas.StudentPerformance,
    summary="Get Student Performance",
    description="Retrieve comprehensive academic performance record for a specific student including SGPA trends and subject-wise grades."
)
async def get_student_performance(
    roll_no: str = Path(..., description="Student roll number"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get detailed academic performance record for a specific student.
    """
    return await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)

@router.get(
    "/analytics/{roll_no}", 
    response_model=schemas.AnalyticsSummary,
    summary="Get Student Analytics",
    description="Retrieve processed academic insights, percentile rankings, and skill domain mapping for a student."
)
async def get_student_analytics(
    roll_no: str = Path(..., description="Student roll number"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get consolidated academic analytics for a student.
    """
    student = await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)
    return await StudentService.calculate_analytics(student, db)

@router.get(
    "/command-center/{roll_no}", 
    response_model=schemas.StudentCommandCenterResponse,
    summary="Get Student Command Center",
    description="Retrieve a high-level executive dashboard for a student, including core metrics, risk indicators, and peer benchmarks."
)
async def get_student_command_center(
    roll_no: str = Path(..., description="Student roll number"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get a high-level overview of a student's standing, metrics, and risk status.
    """
    student = await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)
    return await StudentService.build_student_command_center(student, db)
@router.get(
    "/attendance/{roll_no}", 
    response_model=schemas.PaginatedAttendance,
    summary="Get Detailed Attendance",
    description="Retrieve paginated daily attendance records for a student, with optional semester filtering."
)
async def get_student_attendance(
    roll_no: str = Path(..., description="Student roll number"),
    semester: int | None = Query(None, description="Filter by semester"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Records per page"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get detailed paginated attendance for a student.
    """
    student = await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)
    return await StudentService.get_detailed_attendance(student.id, semester, page, size, db)
