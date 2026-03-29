from enum import Enum
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, Response, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...core import auth
from ...core.database import get_db, settings
from ...core.constants import CURRICULUM_CREDITS
from ...models import base as models
from ...schemas import base as schemas
from ...services.admin_service import AdminService
from ...core.limiter import limiter
from ...services import enterprise_analytics
from sqlalchemy import select, update, delete, func

# Enum Definitions for API Constraints
class RiskLevel(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MODERATE = "Moderate"
    LOW = "Low"

class BottleneckSortBy(str, Enum):
    FAILURE_RATE = "failure_rate"
    AVG_GRADE = "avg_grade"
    STUDENT_COUNT = "student_count"

class FacultySortBy(str, Enum):
    FAILURE_RATE = "failure_rate"
    AVERAGE_MARKS = "average_marks"
    STUDENT_COUNT = "student_count"

class ReadinessSortBy(str, Enum):
    CGPA = "cgpa"
    ATTENDANCE = "attendance"
    CODING_SCORE = "coding_score"

class RiskSortBy(str, Enum):
    RISK_SCORE = "risk_score"
    GPA_DROP = "gpa_drop"
    ATTENDANCE = "attendance"

class StudentSortBy(str, Enum):
    ROLL_NO = "roll_no"
    NAME = "name"
    GPA = "gpa"
    ATTENDANCE = "attendance"
    RANK = "rank"

class SortDir(str, Enum):
    ASC = "asc"
    DESC = "desc"

# Common responses for Admin router
ADMIN_RESPONSES = {
    401: {"description": "Unauthorized - Missing or invalid token", "model": schemas.MessageResponse},
    403: {"description": "Forbidden - Admin access required", "model": schemas.MessageResponse},
    404: {"description": "Resource not found", "model": schemas.MessageResponse},
}

router = APIRouter(tags=["Admin"], responses=ADMIN_RESPONSES)

def require_admin(user: models.User):
    if not user.role or user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

@router.get(
    "/overview", 
    response_model=schemas.AdminOverview,
    summary="Get Administrative Overview",
    description="Retrieve high-level statistics for the admin dashboard, including student, staff, and admin counts."
)
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
    
    staff_count_res = await db.execute(select(func.count(models.Staff.id)))
    staff_count = staff_count_res.scalar() or 0

    return schemas.AdminOverview(
        total_students=len(directory),
        total_staff=staff_count,
        total_admins=1,
    )

@router.get(
    "/command-center", 
    response_model=schemas.AdminCommandCenterResponse,
    summary="Get Admin Command Center",
    description="Retrieve an executive real-time dashboard for the entire institution, featuring department health, risk summaries, and spotlight insights."
)
async def get_command_center(
    spotlight: str = "",
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_command_center(db, CURRICULUM_CREDITS, spotlight=spotlight)

@router.get(
    "/student-360/{roll_no}", 
    response_model=schemas.Student360Profile,
    summary="Get Student 360 View",
    description="Retrieve a complete holistic profile of a specific student, including academic history, risk factors, and behavioral insights."
)
async def get_student_360(
    roll_no: str = Path(..., description="Student roll number"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_student_360(db, CURRICULUM_CREDITS, roll_no=roll_no)

@router.get(
    "/bottlenecks", 
    response_model=schemas.SubjectBottleneckResponse,
    summary="Get Academic Bottlenecks",
    description="Identify subjects with high failure rates or significant performance anomalies across the batch."
)
async def get_subject_bottlenecks(
    sort_by: BottleneckSortBy = Query(default=BottleneckSortBy.AVG_GRADE, description="Field to sort by"),
    sort_dir: SortDir = Query(default=SortDir.ASC, description="Sort direction (asc/desc)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Identify subjects with high failure rates or low average grades.
    """
    require_admin(current_user)
    return await enterprise_analytics.get_subject_bottlenecks(db, CURRICULUM_CREDITS, subject_code=None, limit=limit, offset=offset, sort_by=sort_by.value)

@router.get("/subject-catalog", response_model=list[schemas.SubjectCatalogItem])
async def get_subject_catalog(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_subject_catalog(db)

# Original /subject-bottlenecks endpoint removed as per instruction to replace with /bottlenecks
# @router.get("/subject-bottlenecks", response_model=schemas.SubjectBottleneckResponse)
# async def get_subject_bottlenecks(
#     subject_code: Optional[str] = None,
#     limit: int = 10,
#     offset: int = 0,
#     sort_by: BottleneckSortBy = BottleneckSortBy.FAILURE_RATE,
#     current_user: models.User = Depends(auth.get_current_user),
#     db: AsyncSession = Depends(get_db)
# ):
#     require_admin(current_user)
#     return await enterprise_analytics.get_subject_bottlenecks(db, CURRICULUM_CREDITS, subject_code=subject_code, limit=limit, offset=offset, sort_by=sort_by.value)

@router.get(
    "/impact-matrix", 
    response_model=schemas.FacultyImpactMatrixResponse,
    summary="Get Faculty Impact Matrix",
    description="Analyze faculty effectiveness across different subjects based on student pass rates and average performance."
)
async def get_impact_matrix(
    sort_by: FacultySortBy = Query(default=FacultySortBy.FAILURE_RATE, description="Field to sort by"),
    sort_dir: SortDir = Query(default=SortDir.DESC, description="Sort direction (asc/desc)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get faculty impact matrix analyzing performance across subjects.
    """
    require_admin(current_user)
    return await enterprise_analytics.get_faculty_impact_matrix(db, CURRICULUM_CREDITS, subject_code=None, faculty_id=None, limit=limit, offset=offset)

@router.get("/placement-readiness", response_model=schemas.PlacementReadinessResponse)
async def get_placement_readiness(
    sort_by: ReadinessSortBy = Query(default=ReadinessSortBy.CGPA, description="Field to sort by"),
    sort_dir: SortDir = Query(default=SortDir.DESC, description="Sort direction (asc/desc)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get students ranked by their placement readiness and technical scores.
    """
    require_admin(current_user)
    cgpa_threshold: float = 6.5 
    return await enterprise_analytics.get_placement_readiness(db, CURRICULUM_CREDITS, cgpa_threshold=cgpa_threshold, limit=limit, offset=offset, sort_by=sort_by.value)

@router.get(
    "/risk/registry", 
    response_model=schemas.RiskRegistryResponse,
    summary="Get Batch Risk Registry",
    description="Identify and rank students at high academic risk across the entire institution for proactive intervention."
)
async def get_risk_registry(
    risk_level: Optional[RiskLevel] = Query(default=None, description="Filter by risk level"),
    sort_by: RiskSortBy = Query(default=RiskSortBy.RISK_SCORE, description="Field to sort by"),
    sort_dir: SortDir = Query(default=SortDir.DESC, description="Sort direction (asc/desc)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a list of at-risk students based on attendance and performance.
    """
    require_admin(current_user)
    return await enterprise_analytics.get_risk_registry(db, CURRICULUM_CREDITS, risk_level=risk_level.value if risk_level else None, limit=limit, offset=offset, sort_by=sort_by.value)

@router.get(
    "/staff",
    response_model=list[schemas.StaffProfile],
    summary="List Staff",
    description="Get all staff profiles with usernames and departments.",
)
async def list_staff(
    search: str = Query(default="", description="Optional search across name, username, email"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)
    stmt = (
        select(models.Staff, models.User)
        .join(models.User, models.Staff.id == models.User.id)
        .order_by(models.Staff.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    profiles: list[schemas.StaffProfile] = []
    for staff, user in rows:
        blob = {
            "id": staff.id,
            "username": user.username,
            "name": staff.name,
            "email": staff.email,
            "department": staff.department,
            "created_at": staff.created_at,
        }
        if search:
            s = search.lower()
            if s not in (staff.name or "").lower() and s not in (user.username or "").lower() and s not in (staff.email or "").lower():
                continue
        profiles.append(schemas.StaffProfile(**blob))
    return profiles


@router.post(
    "/staff",
    response_model=schemas.StaffProfile,
    summary="Create Staff User",
    description="Add a new staff user with login credentials and profile details.",
)
async def create_staff(
    payload: schemas.StaffCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    # Validate username uniqueness
    existing_user = await db.execute(select(models.User).filter(models.User.username == payload.username))
    if existing_user.scalars().first():
        raise HTTPException(status_code=400, detail="Username already exists")

    # Resolve staff role
    role_res = await db.execute(select(models.Role).filter(models.Role.name == "staff"))
    staff_role = role_res.scalars().first()
    if not staff_role:
        raise HTTPException(status_code=400, detail="Staff role not configured")

    hashed_pwd = auth.get_password_hash(payload.password)

    user = models.User(
        username=payload.username,
        password_hash=hashed_pwd,
        role_id=staff_role.id,
        is_initial_password=True,
    )
    db.add(user)
    await db.flush()

    staff = models.Staff(
        id=user.id,
        name=payload.name,
        email=payload.email,
        department=payload.department,
    )
    db.add(staff)
    await db.commit()
    await db.refresh(user)
    await db.refresh(staff)

    return schemas.StaffProfile(
        id=staff.id,
        username=user.username,
        name=staff.name,
        email=staff.email,
        department=staff.department,
        created_at=staff.created_at,
    )


@router.patch(
    "/staff/{staff_id}",
    response_model=schemas.StaffProfile,
    summary="Update Staff User",
    description="Edit staff profile or reset password.",
)
async def update_staff(
    staff_id: int = Path(..., ge=1),
    payload: schemas.StaffUpdate = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)
    if payload is None:
        raise HTTPException(status_code=400, detail="No update data provided")

    staff_res = await db.execute(
        select(models.Staff, models.User).join(models.User, models.Staff.id == models.User.id).filter(models.Staff.id == staff_id)
    )
    row = staff_res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff, user = row

    # Update basic fields
    if payload.name is not None:
        staff.name = payload.name
    if payload.email is not None:
        staff.email = payload.email
    if payload.department is not None:
        staff.department = payload.department
    if payload.password:
        user.password_hash = auth.get_password_hash(payload.password)
        user.is_initial_password = True

    await db.commit()
    await db.refresh(staff)
    await db.refresh(user)

    return schemas.StaffProfile(
        id=staff.id,
        username=user.username,
        name=staff.name,
        email=staff.email,
        department=staff.department,
        created_at=staff.created_at,
    )

@router.delete(
    "/staff/{staff_id}",
    status_code=204,
    summary="Delete Staff User",
    description="Remove a staff account and related timetable/assignment links.",
)
async def delete_staff(
    staff_id: int = Path(..., ge=1),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    # Ensure the staff exists and load matching user
    staff_res = await db.execute(
        select(models.Staff, models.User)
        .join(models.User, models.Staff.id == models.User.id)
        .filter(models.Staff.id == staff_id)
    )
    row = staff_res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Remove dependent records first (no ON DELETE CASCADE defined)
    await db.execute(delete(models.TimeTable).where(models.TimeTable.faculty_id == staff_id))
    await db.execute(delete(models.FacultySubjectAssignment).where(models.FacultySubjectAssignment.faculty_id == staff_id))
    await db.execute(delete(models.RefreshToken).where(models.RefreshToken.user_id == staff_id))

    # Remove staff and linked user
    await db.execute(delete(models.Staff).where(models.Staff.id == staff_id))
    await db.execute(delete(models.User).where(models.User.id == staff_id))

    await db.commit()
    return Response(status_code=204)

@router.get(
    "/export/batch-summary",
    summary="Export Batch Summary (Excel)",
    description="Generates an Excel summary of student performance for the entire batch.",
    responses={
        200: {
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {"schema": {"type": "string", "format": "binary"}}},
            "description": "Excel spreadsheet file"
        }
    }
)
@limiter.limit("5/minute")
async def export_batch_summary(
    request: Request,
    cgpa_threshold: float = Query(default=6.5, description="CGPA threshold for placement readiness"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    # The service returns bytes or a file object
    content = await enterprise_analytics.export_batch_summary_xlsx(db, CURRICULUM_CREDITS, cgpa_threshold=cgpa_threshold)
    return Response(
        content=content, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=batch_summary.xlsx"}
    )

@router.get(
    "/export/grade-sheet/{roll_no}",
    summary="Export Student Grade Sheet (PDF)",
    description="Generates a formal PDF grade sheet for a specific student.",
    responses={
        200: {
            "content": {"application/pdf": {"schema": {"type": "string", "format": "binary"}}},
            "description": "PDF grade sheet file"
        }
    }
)
@limiter.limit("10/minute")
async def export_grade_sheet(
    request: Request,
    roll_no: str = Path(..., description="Student roll number"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    content = await enterprise_analytics.export_student_grade_sheet_pdf(db, CURRICULUM_CREDITS, roll_no=roll_no)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=grade_sheet_{roll_no}.pdf"}
    )

@router.get("/students", response_model=list[schemas.AdminDirectoryStudent])
async def get_admin_students(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
    search: str = '',
    city: str = '',
    batch: str = '',
    semester: Optional[int] = Query(default=None, description="Filter by semester"),
    section: str = '',
    risk_only: bool = Query(default=False, description="Show only at-risk students"),
    sort_by: StudentSortBy = Query(default=StudentSortBy.ROLL_NO, description="Field to sort by"),
    sort_dir: SortDir = Query(default=SortDir.DESC, description="Sort direction (asc/desc)"),
    limit: int = Query(default=100, ge=1, le=100, description="Limit records (max 100)"),
):
    """
    Get a list of all students with basic filters. 
    Limited to 100 records for performance. Use /paginated for full access.
    """
    require_admin(current_user)
    credits_values = ", ".join(f"('{code}', {credit})" for code, credit in CURRICULUM_CREDITS.items())
    directory = await AdminService.build_admin_directory(db, credits_values)
    return AdminService.filter_admin_directory(directory, search, city, batch, semester, section, risk_only, sort_by.value, sort_dir, limit)

@router.get("/students/paginated", response_model=schemas.AdminDirectoryPage)
async def get_admin_students_paginated(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
    search: str = '',
    city: str = '',
    batch: str = '',
    semester: Optional[int] = Query(default=None, description="Filter by semester"),
    section: str = '',
    risk_only: bool = Query(default=False, description="Show only at-risk students"),
    sort_by: StudentSortBy = Query(default=StudentSortBy.ROLL_NO, description="Field to sort by"),
    sort_dir: SortDir = Query(default=SortDir.DESC, description="Sort direction (asc/desc)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
):
    """
    Paginated list of students with detailed filtering and sorting.
    """
    require_admin(current_user)
    credits_values = ", ".join(f"('{code}', {credit})" for code, credit in CURRICULUM_CREDITS.items())
    directory = await AdminService.build_admin_directory(db, credits_values)
    filtered = AdminService.filter_admin_directory(directory, search, city, batch, semester, section, risk_only, sort_by.value, sort_dir, 1000)
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

@router.get(
    "/subject-leaderboard/{subject_code}", 
    response_model=schemas.SubjectLeaderboardResponse,
    summary="Get Subject Leaderboard",
    description="Retrieve top and bottom student performers for a specific subject, including rankings and percentile scores."
)
async def get_subject_leaderboard(
    subject_code: str = Path(..., description="Unique subject code"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return await enterprise_analytics.get_subject_leaderboard(
        db, 
        CURRICULUM_CREDITS, 
        subject_code=subject_code, 
        limit=limit, 
        offset=offset
    )

@router.get("/student-record/{roll_no}", response_model=schemas.FullStudentRecord)
async def get_student_record(
    roll_no: str = Path(..., description="Student roll number"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    return schemas.FullStudentRecord(roll_no=roll_no)
@router.post("/assign-sections", response_model=schemas.MessageResponse)
async def assign_student_sections(
    batch: str = Query(..., description="Batch to process"),
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_admin(current_user)
    count = await AdminService.assign_sections(db, batch)
    return schemas.MessageResponse(message=f"Successfully assigned sections for {count} students in batch {batch}")
