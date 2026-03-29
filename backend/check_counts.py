
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("SELECT count(*) FROM students"))
        print(f"Students count: {r.scalar()}")
        
        r = await db.execute(text("SELECT count(*) FROM semester_grades"))
        print(f"Semester grades count: {r.scalar()}")
        
        # Check join
        r = await db.execute(text("""
            SELECT count(*) 
            FROM semester_grades sg
            JOIN students st ON st.roll_no = sg.roll_no
        """))
        print(f"Joined records: {r.scalar()}")
        
        # Check if some roll_no has mismatch
        r = await db.execute(text("""
            SELECT sg.roll_no 
            FROM semester_grades sg
            LEFT JOIN students st ON st.roll_no = sg.roll_no
            WHERE st.roll_no IS NULL
            LIMIT 5
        """))
        mismatched = r.all()
        print(f"Mismatched roll_no samples (in grades but not in students): {mismatched}")

if __name__ == "__main__":
    asyncio.run(check())
