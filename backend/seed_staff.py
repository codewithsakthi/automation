import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent))

from app.core.database import AsyncSessionLocal
from app import models
from app.core import auth
from sqlalchemy import select

async def seed_staff():
    async with AsyncSessionLocal() as db:
        # 1. Get Roles
        res = await db.execute(select(models.Role).filter(models.Role.name == 'staff'))
        staff_role = res.scalars().first()
        
        # 2. Create Staff User
        username = 'staff1'
        password = 'staff123'
        hashed_pwd = auth.get_password_hash(password)
        
        res = await db.execute(select(models.User).filter(models.User.username == username))
        user = res.scalars().first()
        
        if not user:
            user = models.User(
                username=username,
                password_hash=hashed_pwd,
                role_id=staff_role.id,
                is_initial_password=False
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"Created staff user: {username} / {password}")
        else:
            print(f"Staff user {username} already exists.")

        # 3. Create Staff profile
        res = await db.execute(select(models.Staff).filter(models.Staff.id == user.id))
        staff_profile = res.scalars().first()
        
        if not staff_profile:
            staff_profile = models.Staff(
                id=user.id,
                name='Dr. Arul Kumaran',
                department='MCA'
            )
            db.add(staff_profile)
            await db.commit()
            await db.refresh(staff_profile)
            print("Created staff profile.")

        # 4. Assign Subjects (ID 10 from previous check)
        res = await db.execute(select(models.Subject).limit(5))
        subjects = res.scalars().all()
        
        for s in subjects:
            # Check if assignment already exists
            res = await db.execute(select(models.FacultySubjectAssignment).filter(
                models.FacultySubjectAssignment.faculty_id == staff_profile.id,
                models.FacultySubjectAssignment.subject_id == s.id
            ))
            if not res.scalars().first():
                assignment = models.FacultySubjectAssignment(
                    faculty_id=staff_profile.id,
                    subject_id=s.id,
                    section='A'
                )
                db.add(assignment)
                print(f"Assigned subject {s.name} to {staff_profile.name}")
        
        # 5. Seed TimeTable
        timetable_data = [
            # Day 0 (Monday)
            (0, 1, subjects[0].id, 'A', subjects[0].semester),
            (0, 2, subjects[1].id, 'A', subjects[1].semester),
            # Day 1 (Tuesday)
            (1, 4, subjects[0].id, 'A', subjects[0].semester),
            # Day 2 (Wednesday)
            (2, 1, subjects[2].id, 'A', subjects[2].semester),
            # Day 3 (Thursday)
            (3, 5, subjects[1].id, 'A', subjects[1].semester),
        ]
        
        for day, hr, sub_id, sec, sem in timetable_data:
            res = await db.execute(select(models.TimeTable).filter(
                models.TimeTable.faculty_id == staff_profile.id,
                models.TimeTable.day_of_week == day,
                models.TimeTable.hour == hr
            ))
            if not res.scalars().first():
                entry = models.TimeTable(
                    faculty_id=staff_profile.id,
                    day_of_week=day,
                    hour=hr,
                    subject_id=sub_id,
                    section=sec,
                    semester=sem,
                    academic_year='2025-26'
                )
                db.add(entry)
                print(f"Added timetable entry: Day {day}, Hour {hr}, Subject {sub_id}")
        
        await db.commit()
        print("Staff seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_staff())
