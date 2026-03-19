import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.database import settings
from app.services.enterprise_analytics import get_student_360

async def main():
    db_url = settings.DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        try:
            curriculum_credits = {"CS101": 3.0}
            print("Running query...")
            await get_student_360(session, curriculum_credits, roll_no="258005")
        except Exception as e:
            print("ERROR:")
            print(e)
            if hasattr(e, 'orig'):
               print("ORIGINAL EXCEPTION:")
               print(repr(e.orig))
               if hasattr(e.orig, 'position'):
                   print(f"ERROR POSITION: {e.orig.position}")
            
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
