from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...core import auth
from ...core.database import get_db
from ...models import base as models
from ...schemas import base as schemas
from ...services.student_service import StudentService

router = APIRouter(tags=["Students"])

@router.get("/performance/{roll_no}", response_model=schemas.StudentPerformance)
async def get_student_performance(roll_no: str, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)

@router.get("/analytics/{roll_no}", response_model=schemas.AnalyticsSummary)
async def get_student_analytics(roll_no: str, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    student = await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)
    return await StudentService.calculate_analytics(student, db)

@router.get("/command-center/{roll_no}", response_model=schemas.StudentCommandCenterResponse)
async def get_student_command_center(roll_no: str, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    student = await StudentService.get_accessible_student(roll_no, current_user.id, current_user.role.name if current_user.role else "student", db)
    return await StudentService.build_student_command_center(student, db)
