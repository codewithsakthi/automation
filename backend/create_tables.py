import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent))

from app.core.database import engine
from app.models.base import Base

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created/verified.")

if __name__ == "__main__":
    asyncio.run(create_tables())
