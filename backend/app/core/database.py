from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Update to use asyncpg driver - changed default to placeholder to detect fallback
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db_not_set:5432/spark"
    SECRET_KEY: str = "maybedemo"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Diagnostic Logging
import logging
import os
logger = logging.getLogger(__name__)

# Check direct OS environment variables
os_db_url = os.environ.get("DATABASE_URL")
if os_db_url:
    masked_url = os_db_url.split("@")[-1] if "@" in os_db_url else "HIDDEN"
    print(f"OS_ENV_CHECK: DATABASE_URL is set in environment: ...@{masked_url}")
else:
    print("OS_ENV_CHECK: DATABASE_URL is NOT set in OS environment")

db_host = settings.DATABASE_URL.split("@")[-1].split(":")[0].split("/")[0]
print(f"DATABASE_SETTINGS: Final host in settings is '{db_host}'")
logger.info(f"Database settings initialized. Target host: {db_host}")

# Create a custom SSL context that doesn't verify certificates
import ssl
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Determine if SSL is required
use_ssl = "sslmode=require" in settings.DATABASE_URL
db_url = settings.DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")

# Create async engine
connect_args = {"ssl": ssl_context} if use_ssl else {}
engine = create_async_engine(
    db_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    echo=False,
    connect_args=connect_args
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
