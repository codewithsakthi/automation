import asyncio
from app.db.session import SessionLocal
from sqlalchemy import text

async def run():
    async with SessionLocal() as db:
        rs = await db.execute(text('SELECT DISTINCT batch FROM students'))
        for r in rs.all():
            print(f"BATCH: '{r[0]}'")

asyncio.run(run())
