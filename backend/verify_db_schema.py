import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def verify_schema():
    async with AsyncSessionLocal() as session:
        # Check students table
        res = await session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'students'"))
        columns = [r[0] for r in res.fetchall()]
        print(f"Columns in 'students' table: {columns}")
        
        # Check if reg_no and section exist
        has_reg_no = 'reg_no' in columns
        has_section = 'section' in columns
        print(f"Has reg_no: {has_reg_no}")
        print(f"Has section: {has_section}")

if __name__ == "__main__":
    asyncio.run(verify_schema())
