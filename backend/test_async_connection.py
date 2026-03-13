import asyncio
from app.database import engine, get_db
from sqlalchemy import text

async def test_connection():
    try:
        print("Testing database connection...")
        async for session in get_db():
            result = await session.execute(text("SELECT version();"))
            row = result.fetchone()
            print(f"Connection successful! Database version: {row[0]}")
            break
    except Exception as e:
        print(f"Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
