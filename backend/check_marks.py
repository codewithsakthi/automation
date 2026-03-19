
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check_marks():
    async with AsyncSessionLocal() as db:
        tables = ["student_marks", "semester_grades", "internal_marks", "attendance"]
        for table in tables:
            query = text(f"SELECT COUNT(*) FROM {table}")
            try:
                result = await db.execute(query)
                count = result.scalar()
                print(f"Total records in {table}: {count}")
            except Exception as e:
                print(f"Error checking {table}: {e}")

if __name__ == "__main__":
    asyncio.run(check_marks())
