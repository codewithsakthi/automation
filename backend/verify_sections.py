import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app import models

async def verify():
    async with AsyncSessionLocal() as db:
        # Get count per section
        print("Student counts per section:")
        result = await db.execute(select(models.Student.section))
        sections = result.scalars().all()
        from collections import Counter
        print(Counter(sections))

        # Show first 5 and last 5 in sorted RegNo order
        print("\nChecking RegNo sorting and sectioning:")
        result = await db.execute(select(models.Student.reg_no, models.Student.section).order_by(models.Student.reg_no))
        rows = result.all()
        
        print("First 5 (Section A expected):")
        for r in rows[:5]:
            print(f"RegNo: {r.reg_no}, Section: {r.section}")
            
        print("\nMiddle transition:")
        mid = len(rows) // 2
        for r in rows[mid-2:mid+2]:
             print(f"RegNo: {r.reg_no}, Section: {r.section}")

        print("\nLast 5 (Section B expected):")
        for r in rows[-5:]:
            print(f"RegNo: {r.reg_no}, Section: {r.section}")

if __name__ == "__main__":
    asyncio.run(verify())
