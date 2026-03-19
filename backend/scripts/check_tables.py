import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check_tables():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
        tables = sorted([row[0] for row in result])
        print(f"Found {len(tables)} tables: {tables}")

if __name__ == "__main__":
    asyncio.run(check_tables())
