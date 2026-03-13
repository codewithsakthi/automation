from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload

from .. import models, schemas
from .student_service import StudentService
from .admin_service import AdminService
from ..core.constants import CURRICULUM_CREDITS

class UserService:
    @staticmethod
    async def get_staff_record(user: models.User, db: AsyncSession):
        result = await db.execute(
            select(models.Staff).filter(models.Staff.id == user.id)
        )
        return result.scalars().first()

    @classmethod
    async def build_current_user_response(cls, user: models.User, db: AsyncSession) -> schemas.CurrentUser:
        student = await StudentService.get_student_record(user, db)
        staff = None if student else await cls.get_staff_record(user, db)
        
        rank = None
        if student:
            credits_values = ", ".join(f"('{code}', {credit})" for code, credit in CURRICULUM_CREDITS.items())
            ranking_query = text(f'''
                with rankings as (
                    select roll_no, 
                           rank() over (order by average_grade_points desc) as rank
                    from (
                        {AdminService._admin_directory_query_text(credits_values)}
                    ) as directory
                )
                select rank from rankings where roll_no = :roll_no
            ''')
            result = await db.execute(ranking_query, {'roll_no': student.roll_no})
            rank_row = result.mappings().first()
            if rank_row:
                rank = rank_row['rank']

        return schemas.CurrentUser(
            id=user.id,
            username=user.username,
            role_id=user.role_id,
            is_initial_password=user.is_initial_password,
            created_at=user.created_at,
            role=user.role.name if user.role else "student",
            name=student.name if student else (staff.name if staff else None),
            email=student.email if student else (staff.email if staff else None),
            roll_no=student.roll_no if student else None,
            reg_no=student.reg_no if student else None,
            batch=student.batch if student else None,
            current_semester=student.current_semester if student else None,
            program_name=student.program.name if student and student.program else None,
            rank=rank,
        )
