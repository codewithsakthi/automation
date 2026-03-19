import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

async def test_conn():
    url = os.environ.get("DATABASE_URL")
    print(f"Testing connection to: {url[:20]}...")
    if not url:
        print("DATABASE_URL not found")
        return
    
    if "postgres://" in url:
        url = url.replace("postgres://", "postgresql+asyncpg://")
    
    try:
        engine = create_async_engine(url)
        async with engine.connect() as conn:
            print("Successfully connected!")
        await engine.dispose()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
