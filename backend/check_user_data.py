import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app import models

async def check_user():
    async with AsyncSessionLocal() as db:
        # Check User
        stmt = select(models.User).filter(models.User.username == '258312')
        result = await db.execute(stmt)
        user = result.scalars().first()
        if not user:
            print("User 258312 not found")
            return

        print(f"User: {user.username}, Role ID: {user.role_id}")

        # Check Student
        stmt = select(models.Student).filter(models.Student.id == user.id)
        result = await db.execute(stmt)
        student = result.scalars().first()
        if not student:
            print("Student record not found")
            return

        print(f"Student: {student.name}, Program ID: {student.program_id}, Sem: {student.current_semester}")

        # Check Program
        if student.program_id:
            stmt = select(models.Program).filter(models.Program.id == student.program_id)
            result = await db.execute(stmt)
            program = result.scalars().first()
            if program:
                print(f"Program: {program.name}, Code: {program.code}")
            else:
                print("Program not found for ID")
        else:
            print("Student has no Program ID")

if __name__ == "__main__":
    asyncio.run(check_user())
