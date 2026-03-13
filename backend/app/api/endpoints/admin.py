from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core import auth
from ...core.database import get_db, settings
from ...core.constants import CURRICULUM_CREDITS
from ...models import base as models
from ...schemas import base as schemas
from ...services.admin_service import AdminService
from ...services import enterprise_analytics

router = APIRouter(tags=["Admin"])

def require_admin(user: models.User):
    if not user.role or user.role.name != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")

@router.get("/overview", response_model=schemas.AdminOverview)
async def get_admin_overview(
    current_user: models.User = Depends(auth.get_current_user), 
    db: AsyncSession = Depends(get_db),
    batch: Optional[str] = Query(default=None)
):
    require_admin(current_user)
    credits_values = ", ".join(f"('{code}', {credit})" for code, credit in CURRICULUM_CREDITS.items())
    directory = await AdminService.build_admin_directory(db, credits_values)
    if batch and batch.upper() != 'ALL':
        directory = [d for d in directory if (d.batch or '').upper() == batch.upper()]
    
    return schemas.AdminOverview(
        total_students=len(directory),
        total_staff=0,
        total_admins=1,
    )

@router.get("/command-center", response_model=schemas.AdminCommandCenterResponse)
async def get_command_center(
    spotlight: str = "",
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_command_center(db, CURRICULUM_CREDITS, spotlight=spotlight)

@router.get("/student-360/{roll_no}", response_model=schemas.Student360Profile)
async def get_student_360(
    roll_no: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_student_360(db, CURRICULUM_CREDITS, roll_no=roll_no)

@router.get("/subject-leaderboard", response_model=schemas.SubjectLeaderboardResponse)
async def get_subject_leaderboard(
    subject_code: str,
    limit: int = 10,
    offset: int = 0,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_subject_leaderboard(db, CURRICULUM_CREDITS, subject_code=subject_code, limit=limit, offset=offset)

@router.get("/subject-catalog", response_model=list[schemas.SubjectCatalogItem])
async def get_subject_catalog(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_subject_catalog(db)

@router.get("/subject-bottlenecks", response_model=schemas.SubjectBottleneckResponse)
async def get_subject_bottlenecks(
    subject_code: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    sort_by: str = "failure_rate",
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_subject_bottlenecks(db, CURRICULUM_CREDITS, subject_code=subject_code, limit=limit, offset=offset, sort_by=sort_by)

@router.get("/faculty-impact", response_model=schemas.FacultyImpactMatrixResponse)
async def get_faculty_impact(
    subject_code: Optional[str] = None,
    faculty_id: Optional[int] = None,
    limit: int = 10,
    offset: int = 0,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_faculty_impact_matrix(db, CURRICULUM_CREDITS, subject_code=subject_code, faculty_id=faculty_id, limit=limit, offset=offset)

@router.get("/placement-readiness", response_model=schemas.PlacementReadinessResponse)
async def get_placement_readiness(
    cgpa_threshold: float = 6.5,
    limit: int = 10,
    offset: int = 0,
    sort_by: str = "cgpa",
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_placement_readiness(db, CURRICULUM_CREDITS, cgpa_threshold=cgpa_threshold, limit=limit, offset=offset, sort_by=sort_by)

@router.get("/risk-registry", response_model=schemas.RiskRegistryResponse)
async def get_risk_registry(
    risk_level: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    sort_by: str = "risk_score",
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_risk_registry(db, CURRICULUM_CREDITS, risk_level=risk_level, limit=limit, offset=offset, sort_by=sort_by)

@router.get("/export/batch-summary")
async def export_batch_summary(
    cgpa_threshold: float = 6.5,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.export_batch_summary_xlsx(db, CURRICULUM_CREDITS, cgpa_threshold=cgpa_threshold)

@router.get("/export/grade-sheet/{roll_no}")
async def export_grade_sheet(
    roll_no: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.export_student_grade_sheet_pdf(db, CURRICULUM_CREDITS, roll_no=roll_no)

@router.get("/students", response_model=list[schemas.AdminDirectoryStudent])
async def get_admin_students(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
    search: str = '',
    city: str = '',
    batch: str = '',
    semester: Optional[int] = Query(default=None),
    risk_only: bool = False,
    sort_by: str = Query(default='roll_no'),
    sort_dir: str = Query(default='desc'),
    limit: int = 200,
):
    require_admin(current_user)
    credits_values = ", ".join(f"('{code}', {credit})" for code, credit in CURRICULUM_CREDITS.items())
    directory = await AdminService.build_admin_directory(db, credits_values)
    return AdminService.filter_admin_directory(directory, search, city, batch, semester, risk_only, sort_by, sort_dir, limit)

@router.get("/students/paginated", response_model=schemas.AdminDirectoryPage)
async def get_admin_students_paginated(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
    search: str = '',
    city: str = '',
    batch: str = '',
    semester: Optional[int] = Query(default=None),
    risk_only: bool = False,
    sort_by: str = Query(default='roll_no'),
    sort_dir: str = Query(default='desc'),
    limit: int = 20,
    offset: int = 0,
):
    require_admin(current_user)
    credits_values = ", ".join(f"('{code}', {credit})" for code, credit in CURRICULUM_CREDITS.items())
    directory = await AdminService.build_admin_directory(db, credits_values)
    filtered = AdminService.filter_admin_directory(directory, search, city, batch, semester, risk_only, sort_by, sort_dir, 1000)
    items = filtered[offset : offset + limit]
    return schemas.AdminDirectoryPage(
        items=items,
        pagination=schemas.PaginationMeta(total=len(filtered), limit=limit, offset=offset)
    )

@router.get("/spotlight-search", response_model=schemas.SpotlightSearchResponse)
async def get_spotlight_search(
    q: str = Query(..., min_length=2),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.spotlight_search(db, query=q)

@router.get("/student-record/{roll_no}", response_model=schemas.FullStudentRecord)
async def get_student_record(
    roll_no: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    # Placeholder for now, returning empty record skeleton
    # Ideally should call a service method to build this
    return schemas.FullStudentRecord(roll_no=roll_no)
