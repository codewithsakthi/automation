
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check_raw():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text('SELECT * FROM semester_grades LIMIT 5'))
        rows = [dict(r) for r in res.mappings().all()]
        for r in rows:
            print(r)

if __name__ == "__main__":
    asyncio.run(check_raw())
