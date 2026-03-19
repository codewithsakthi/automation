import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent))

from app.core.database import AsyncSessionLocal
from app import models
from sqlalchemy import select

async def check_subjects():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(models.Subject).limit(10))
        subjects = res.scalars().all()
        if not subjects:
            print("No subjects found.")
            return
        for s in subjects:
            print(f"ID: {s.id}, Name: {s.name}, Code: {s.course_code}")

if __name__ == "__main__":
    asyncio.run(check_subjects())
