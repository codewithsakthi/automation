import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.endpoints import auth, students, admin
from .core.database import engine, Base
from .core.database import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.routing import APIRoute

def custom_generate_unique_id(route: APIRoute):
    tag = route.tags[0] if route.tags else "api"
    return f"{tag}-{route.name}"

app = FastAPI(
    title="SPARK Production API",
    description="Scalable Production-Grade Analytics for Academic Records & Knowledge",
    version="2.0.0",
    generate_unique_id_function=custom_generate_unique_id,
    servers=[
        {"url": "https://spark-backend-production-6bfd.up.railway.app/", "description": "Production server"},
        {"url": "/", "description": "Local development server"},
    ],
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.4:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # covers all Vercel preview + prod URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth")
app.include_router(students.router, prefix="/api/students")
app.include_router(admin.router, prefix="/api/admin")

from fastapi.responses import RedirectResponse

@app.get("/api/admin/subject-bottlenecks", include_in_schema=False)
def redirect_bottlenecks():
    return RedirectResponse("/api/admin/bottlenecks", status_code=301)

@app.get("/api/admin/faculty-impact", include_in_schema=False)
def redirect_faculty_impact():
    return RedirectResponse("/api/admin/impact-matrix", status_code=301)

@app.on_event("startup")
async def startup():
    db_host = settings.DATABASE_URL.split("@")[-1].split(":")[0].split("/")[0]
    logger.info(f"Application starting up... Connection target: {db_host}")
    try:
        async with engine.begin() as conn:
            pass
        logger.info("Database connection verified successfully.")
    except Exception as e:
        logger.warning(f"Startup DB ping failed (non-fatal, will retry on first request): {e}")

@app.get("/")
async def root():
    return {"message": "SPARK API is running", "version": "2.0.0"}
