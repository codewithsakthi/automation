import asyncio
from sqlalchemy import text
from app.core.database import engine

async def clear_alembic_version():
    async with engine.connect() as conn:
        print("Clearing alembic_version table...")
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.commit()
        print("Success!")

if __name__ == "__main__":
    asyncio.run(clear_alembic_version())
