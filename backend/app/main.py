import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.endpoints import auth, students, admin
from .core.database import engine, Base
from .core.database import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SPARK Production API",
    description="Scalable Production-Grade Analytics for Academic Records & Knowledge",
    version="2.0.0",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth")
app.include_router(students.router, prefix="/api/students")
app.include_router(admin.router, prefix="/api/admin")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        # Tables should be created by Alembic in production, but keeping for dev parity
        # await conn.run_sync(Base.metadata.create_all)
        pass

@app.get("/")
async def root():
    return {"message": "SPARK API is running", "version": "2.0.0"}
