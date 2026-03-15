import asyncio
import hashlib
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app import models

def get_simple_hash(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

async def seed_db():
    print("Seeding database (Async)...")
    async with AsyncSessionLocal() as db:
        try:
            # Seed Roles
            roles = ['admin', 'staff', 'student']
            for role_name in roles:
                result = await db.execute(select(models.Role).filter(models.Role.name == role_name))
                if not result.scalars().first():
                    db.add(models.Role(name=role_name))
            await db.commit()
            print("Roles seeded.")

            # Seed Programs
            result = await db.execute(select(models.Program).filter(models.Program.code == 'MCA'))
            mca_program = result.scalars().first()
            if not mca_program:
                mca_program = models.Program(code='MCA', name='Master of Computer Applications')
                db.add(mca_program)
                await db.commit()
                await db.refresh(mca_program)
                print("MCA Program seeded.")

            # Create Admin User
            result = await db.execute(select(models.Role).filter(models.Role.name == 'admin'))
            admin_role = result.scalars().first()
            
            result = await db.execute(select(models.User).filter(models.User.username == 'admin'))
            if not result.scalars().first():
                hashed_pwd = get_simple_hash('admin123')
                admin_user = models.User(
                    username='admin',
                    password_hash=hashed_pwd,
                    role_id=admin_role.id,
                    is_initial_password=False
                )
                db.add(admin_user)
                await db.commit()
                print("Admin user created (username: admin, password: admin123)")

            # Create Test Student
            result = await db.execute(select(models.Role).filter(models.Role.name == 'student'))
            student_role = result.scalars().first()
            
            result = await db.execute(select(models.User).filter(models.User.username == '258312'))
            if not result.scalars().first():
                hashed_pwd = get_simple_hash('29072003') # DOB as password
                stu_user = models.User(
                    username='258312',
                    password_hash=hashed_pwd,
                    role_id=student_role.id,
                    is_initial_password=True
                )
                db.add(stu_user)
                await db.commit()
                await db.refresh(stu_user)
                
                student = models.Student(
                    id=stu_user.id,
                    roll_no='258312',
                    name='SAKTHIVEL M',
                    dob='2003-07-29',
                    batch='2025-2027',
                    program_id=mca_program.id,
                    current_semester=3
                )
                db.add(student)
                await db.commit()
                print("Test Student created (username: 258312, password: DOB, program: MCA)")
            else:
                # Update existing student if missing program_id
                result = await db.execute(select(models.Student).filter(models.Student.roll_no == '258312'))
                student = result.scalars().first()
                if student and not student.program_id:
                    student.program_id = mca_program.id
                    student.current_semester = 3
                    await db.commit()
                    print("Updated existing Test Student with MCA program.")

        except Exception as e:
            print(f"Error seeding DB: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed_db())
