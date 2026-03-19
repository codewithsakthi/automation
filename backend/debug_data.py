import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        print("\nChecking semester_grades for sample students...")
        # Get a few students from the students table
        students = (await db.execute(text("SELECT roll_no, name FROM students LIMIT 5"))).mappings().all()
        for s in students:
            print(f"\nStudent: {s['name']} ({s['roll_no']})")
            grades = (await db.execute(text("SELECT * FROM semester_grades WHERE roll_no = :r"), {"r": s["roll_no"]})).mappings().all()
            print(f"  Grades found: {len(grades)}")
            
        print("\nChecking existing tables in the database...")
        tables = (await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))).scalars().all()
        print(f"Tables: {tables}")

        print("\nChecking row counts for key tables...")
        for table in ['students', 'semester_grades', 'internal_marks', 'student_marks', 'attendance', 'subjects', 'users']:
            if table in tables:
                count = (await db.execute(text(f"SELECT COUNT(*) FROM {table}"))).scalar()
                print(f"  {table}: {count}")
                if count > 0:
                    sample = (await db.execute(text(f"SELECT * FROM {table} LIMIT 1"))).mappings().all()
                    print(f"    Sample: {sample[0]}")

if __name__ == "__main__":
    asyncio.run(check())
