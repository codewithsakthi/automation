import asyncio
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app import models

async def count_students():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count()).select_from(models.Student))
        count = result.scalar()
        print(f"Current student count: {count}")
        
        result = await db.execute(select(func.count()).select_from(models.StudentMark))
        marks_count = result.scalar()
        print(f"Current marks count: {marks_count}")

if __name__ == "__main__":
    asyncio.run(count_students())
