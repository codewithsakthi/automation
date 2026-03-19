import asyncio
import sys
from pathlib import Path
from sqlalchemy import inspect

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent))

from app.core.database import engine

async def check_tables():
    async with engine.connect() as conn:
        tables = await conn.run_sync(lambda sync_conn: inspect(sync_conn).get_table_names())
        print(f"Tables in DB: {tables}")

if __name__ == "__main__":
    asyncio.run(check_tables())
