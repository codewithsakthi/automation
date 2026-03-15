import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

import ssl

async def migrate():
    database_url = "postgresql+asyncpg://avnadmin:AVNS_Po7l5FxNwlEiEMRM-ha@pg-22fd1f-spark-db.b.aivencloud.com:24087/defaultdb"
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    engine = create_async_engine(
        database_url,
        connect_args={"ssl": ssl_context}
    )
    
    async with engine.begin() as conn:
        print("Adding semester column to attendance table...")
        await conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS semester INTEGER;"))
        print("Success!")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
