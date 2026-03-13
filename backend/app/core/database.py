from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from pydantic_settings import BaseSettings

import ssl

# Create a custom SSL context that doesn't verify certificates
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

class Settings(BaseSettings):
    # Update to use asyncpg driver
    DATABASE_URL: str = "postgresql+asyncpg://avnadmin:AVNS_Po7l5FxNwlEiEMRM-ha@pg-22fd1f-spark-db.b.aivencloud.com:24087/defaultdb?sslmode=require"
    SECRET_KEY: str = "maybedemo"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    class Config:
        env_file = ".env"

settings = Settings()

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL.replace("?sslmode=require", ""),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    echo=False,
    connect_args={"ssl": ssl_context}
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
