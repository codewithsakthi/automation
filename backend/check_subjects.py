
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("SELECT count(*) FROM subjects"))
        print(f"Subjects count: {r.scalar()}")
        
        r = await db.execute(text("SELECT course_code FROM subjects"))
        subjects_in_table = [row[0] for row in r.all()]
        print(f"Sample subjects in table: {subjects_in_table[:10]}")
        
        r = await db.execute(text("SELECT DISTINCT subject_code FROM semester_grades"))
        subjects_in_grades = [row[0] for row in r.all()]
        print(f"First 10 subjects in grades: {subjects_in_grades[:10]}")
        
        missing = [s for s in subjects_in_grades if s not in subjects_in_table]
        print(f"Subjects in grades but NOT in subjects table ({len(missing)}): {missing[:20]}")
        
        # Check if 24MC102 is in subjects
        if "24MC102" in subjects_in_table:
            print("24MC102 IS in subjects table.")
        else:
            print("24MC102 IS NOT in subjects table!")

if __name__ == "__main__":
    asyncio.run(check())
