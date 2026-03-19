from __future__ import annotations

from io import BytesIO
from typing import Iterable, Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas


AVG_MARKS_CASE = """
CASE upper(coalesce({grade_col}, ''))
    WHEN 'O' THEN 95
    WHEN 'S' THEN 95
    WHEN 'A+' THEN 85
    WHEN 'A' THEN 75
    WHEN 'B+' THEN 65
    WHEN 'B' THEN 55
    WHEN 'C' THEN 48
    WHEN 'D' THEN 43
    WHEN 'E' THEN 38
    WHEN 'PASS' THEN 50
    WHEN 'P' THEN 50
    ELSE 0
END
"""

GRADE_POINT_CASE = """
CASE upper(coalesce({grade_col}, ''))
    WHEN 'O' THEN 10
    WHEN 'S' THEN 10
    WHEN 'A+' THEN 9
    WHEN 'A' THEN 8
    WHEN 'B+' THEN 7
    WHEN 'B' THEN 6
    WHEN 'C' THEN 5
    WHEN 'D' THEN 4
    WHEN 'E' THEN 3
    WHEN 'PASS' THEN 5
    WHEN 'P' THEN 5
    ELSE 0
END
"""

CODING_PATTERNS = ["python", "program", "java", "data structure", "algorithm", "web", "database"]
THEORY_PATTERNS = ["math", "discrete", "theory", "analysis", "architecture", "compiler"]
LAB_PATTERNS = ["lab", "project", "practic", "workshop"]
AUDIT_PATTERNS = ["audit", "value added", "mandatory", "non credit"]


def _credits_values(curriculum_credits: dict) -> str:
    """Helper to format credits dictionary for SQL VALUES clause safely."""
    vals = []
    if not curriculum_credits:
         return "('', 0)"
    
    for code, credit in curriculum_credits.items():
        if isinstance(credit, dict):
            # Try to find the first numeric value in the nested dictionary
            found_val = 0
            for v in credit.values():
                if isinstance(v, (int, float)):
                    found_val = v
                    break
            vals.append(f"('{code}', {found_val})")
        else:
            # Assume it's a numeric value
            vals.append(f"('{code}', {credit if isinstance(credit, (int, float)) else 0})")
    
    if not vals:
        return "('', 0)"
    return ", ".join(vals)


def _risk_level(score: float) -> str:
    if score >= 70:
        return "Critical"
    if score >= 55:
        return "High"
    if score >= 35:
        return "Moderate"
    return "Low"


def _cast_text_param(name: str) -> str:
    return f"CAST(:{name} AS TEXT)"


def _cast_int_param(name: str) -> str:
    return f"CAST(:{name} AS INTEGER)"


def _attendance_band(attendance_percentage: float) -> str:
    if attendance_percentage >= 90:
        return "Exemplary"
    if attendance_percentage >= 80:
        return "Stable"
    if attendance_percentage >= 75:
        return "Watchlist"
    return "Critical"


def _placement_signal(overall_gpa: float, active_arrears: int, attendance_percentage: float) -> str:
    if overall_gpa >= 7 and active_arrears == 0 and attendance_percentage >= 80:
        return "Placement Ready"
    if overall_gpa >= 6 and active_arrears <= 1:
        return "Needs Finishing Push"
    return "Intervention Required"


def _tone_from_metric(value: float, warning_cutoff: float, critical_cutoff: float, *, reverse: bool = False) -> str:
    if reverse:
        if value <= critical_cutoff:
            return "critical"
        if value <= warning_cutoff:
            return "warning"
        return "positive"
    if value >= critical_cutoff:
        return "critical"
    if value >= warning_cutoff:
        return "warning"
    return "positive"


def _base_ctes(curriculum_credits: dict[str, float]) -> str:
    credits_values = _credits_values(curriculum_credits)
    return f"""
    WITH curriculum_credits_map AS (
        SELECT * FROM (VALUES {credits_values}) AS t(course_code, credit)
    ),
    subject_catalog AS (
        SELECT
            s.id,
            s.course_code,
            s.name,
            s.semester,
            COALESCE(NULLIF(s.credits, 0), ccm.credit, 0) AS credit,
            CASE
                WHEN lower(s.name) SIMILAR TO '%({'|'.join(CODING_PATTERNS)})%' THEN 'Programming'
                WHEN lower(s.name) SIMILAR TO '%({'|'.join(LAB_PATTERNS)})%' THEN 'Lab'
                WHEN lower(s.name) SIMILAR TO '%({'|'.join(THEORY_PATTERNS)})%' THEN 'Theory'
                ELSE 'Core'
            END AS skill_domain,
            CASE
                WHEN lower(s.name) SIMILAR TO '%({'|'.join(LAB_PATTERNS + AUDIT_PATTERNS)})%' THEN FALSE
                WHEN COALESCE(NULLIF(s.credits, 0), ccm.credit, 0) = 0 THEN FALSE
                WHEN s.course_code ILIKE '%AC%' THEN FALSE
                ELSE TRUE
            END AS has_internal_component
        FROM subjects s
        LEFT JOIN curriculum_credits_map ccm ON ccm.course_code = s.course_code
    ),
    marks_enriched AS (
        SELECT
            st.id AS student_id,
            st.roll_no,
            st.reg_no,
            st.section,
            st.name AS student_name,
            st.batch,
            st.current_semester,
            st.email,
            sg.semester,
            sg.subject_code,
            COALESCE(sg.subject_title, sc.name, sg.subject_code) AS subject_name,
            sg.grade,
            sc.skill_domain,
            COALESCE(sc.has_internal_component, TRUE) AS has_internal_component,
            COALESCE(sc.credit, 0) AS credit,
            COALESCE(sg.internal_marks, 0) AS internal_marks,
            CASE
                WHEN COALESCE(sc.has_internal_component, TRUE) THEN COALESCE(sg.internal_marks, 0)
                ELSE NULL
            END AS effective_internal_marks,
            {GRADE_POINT_CASE.format(grade_col='sg.grade')} AS grade_point,
            COALESCE(
                sg.marks, 
                CASE 
                    WHEN sg.grade IS NOT NULL AND upper(sg.grade) NOT IN ('U', 'FAIL', 'F', 'AB', 'W', 'I') 
                    THEN {AVG_MARKS_CASE.format(grade_col='sg.grade')}
                    ELSE NULL 
                END,
                sg.internal_marks,
                0
            ) AS total_marks,
            CASE WHEN upper(coalesce(sg.grade, '')) IN ('U', 'FAIL', 'F', 'AB', 'W', 'I') THEN 1 ELSE 0 END AS failed
        FROM semester_grades sg
        JOIN students st ON st.roll_no = sg.roll_no
        LEFT JOIN subject_catalog sc ON sc.course_code = sg.subject_code
    ),
    attendance_rollup AS (
        SELECT
            st.id AS student_id,
            ci.city,
            ROUND(COALESCE(100.0 * SUM(COALESCE(a.total_present, 0)) / NULLIF(SUM(COALESCE(a.total_hours, 0)), 0), 0)::numeric, 2) AS attendance_percentage
        FROM students st
        LEFT JOIN contact_info ci ON ci.roll_no = st.roll_no
        LEFT JOIN attendance a ON a.student_id = st.id
        GROUP BY st.id, ci.city
    ),
    semester_gpa AS (
        SELECT
            me.student_id,
            me.roll_no,
            me.student_name,
            me.batch,
            me.semester,
            ROUND(
                CASE
                    WHEN SUM(me.credit) FILTER (WHERE me.credit > 0) > 0
                    THEN (SUM(me.grade_point * me.credit) / SUM(me.credit) FILTER (WHERE me.credit > 0))
                    ELSE 0
                END::numeric, 2
            ) AS sgpa,
            COALESCE(ROUND(AVG(me.effective_internal_marks)::numeric, 2), 0) AS internal_avg,
            COALESCE(ROUND(AVG(me.total_marks)::numeric, 2), 0) AS marks_avg
        FROM marks_enriched me
        GROUP BY me.student_id, me.roll_no, me.student_name, me.batch, me.semester
    ),
    velocity AS (
        SELECT
            sg.*,
            LAG(sg.sgpa) OVER (PARTITION BY sg.student_id ORDER BY sg.semester) AS previous_sgpa,
            ROUND((sg.sgpa - LAG(sg.sgpa) OVER (PARTITION BY sg.student_id ORDER BY sg.semester))::numeric, 2) AS gpa_velocity
        FROM semester_gpa sg
    ),
    student_current AS (
        SELECT DISTINCT ON (st.id)
            st.id AS student_id,
            st.roll_no,
            st.reg_no,
            st.section,
            st.name AS student_name,
            st.batch,
            st.current_semester,
            st.email,
            ar.city,
            COALESCE(ar.attendance_percentage, 0) AS attendance_percentage,
            COALESCE(v.sgpa, 0) AS cgpa_proxy,
            v.internal_avg AS internal_avg,
            COALESCE(v.gpa_velocity, 0) AS gpa_velocity,
            COALESCE(v.previous_sgpa, v.sgpa, 0) AS previous_sgpa,
            COALESCE((
                SELECT COUNT(*) FROM marks_enriched m2
                WHERE m2.student_id = st.id AND m2.failed = 1
            ), 0) AS active_arrears,
            u.is_initial_password
        FROM students st
        JOIN users u ON u.id = st.id
        LEFT JOIN attendance_rollup ar ON ar.student_id = st.id
        LEFT JOIN velocity v ON v.student_id = st.id AND v.semester = st.current_semester
        ORDER BY st.id, st.current_semester DESC
    ),
    risk_scores AS (
        SELECT
            sc.*,
            ROUND(LEAST(
                100,
                GREATEST(0, (75 - sc.attendance_percentage) / 75.0 * 100) * 0.30 +
                CASE
                    WHEN sc.internal_avg IS NULL THEN 0
                    ELSE GREATEST(0, (60 - sc.internal_avg) / 60.0 * 100) * 0.30
                END +
                GREATEST(0, (COALESCE(sc.previous_sgpa, sc.cgpa_proxy) - sc.cgpa_proxy) * 20) * 0.40
            )::numeric, 2) AS risk_score
        FROM student_current sc
    )
    """


async def get_subject_leaderboard(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    subject_code: str,
    limit: int,
    offset: int,
) -> schemas.SubjectLeaderboardResponse:
    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        ,
        ranked_subject AS (
            SELECT
                me.roll_no,
                me.student_name,
                me.batch,
                me.current_semester,
                me.subject_code,
                me.subject_name,
                me.total_marks,
                me.internal_marks,
                me.grade,
                RANK() OVER (
                    PARTITION BY me.subject_code, me.batch, me.current_semester
                    ORDER BY me.total_marks DESC, COALESCE(me.effective_internal_marks, me.total_marks) DESC
                ) AS class_rank,
                RANK() OVER (
                    PARTITION BY me.subject_code, me.batch
                    ORDER BY me.total_marks DESC, COALESCE(me.effective_internal_marks, me.total_marks) DESC
                ) AS batch_rank,
                ROUND((PERCENT_RANK() OVER (PARTITION BY me.subject_code ORDER BY me.total_marks) * 100)::numeric, 2) AS percentile,
                COUNT(*) OVER () AS total_count
            FROM marks_enriched me
            WHERE lower(me.subject_code) = lower(:subject_code)
        )
        SELECT * FROM ranked_subject
        ORDER BY class_rank ASC, batch_rank ASC, total_marks DESC
        OFFSET :offset LIMIT :limit
        """
    )
    rows = (await db.execute(query, {"subject_code": subject_code, "limit": limit, "offset": offset})).mappings().all()
    if not rows:
        meta_query = text(
            """
            SELECT
                COALESCE(s.course_code, sg.subject_code) AS subject_code,
                COALESCE(s.name, MAX(sg.subject_title), COALESCE(s.course_code, sg.subject_code)) AS subject_name
            FROM subjects s
            FULL OUTER JOIN semester_grades sg ON sg.subject_code = s.course_code
            WHERE lower(COALESCE(s.course_code, sg.subject_code)) = lower(:subject_code)
            GROUP BY COALESCE(s.course_code, sg.subject_code), s.name
            LIMIT 1
            """
        )
        meta = (await db.execute(meta_query, {"subject_code": subject_code})).mappings().first()
        if not meta:
            raise HTTPException(status_code=404, detail="Subject leaderboard not found")
        return schemas.SubjectLeaderboardResponse(
            subject_code=meta["subject_code"],
            subject_name=meta["subject_name"],
            top_leaderboard=[],
            bottom_leaderboard=[],
            pagination=schemas.PaginationMeta(total=0, limit=limit, offset=offset),
        )

    entries = [schemas.LeaderboardEntry(**{k: v for k, v in dict(row).items() if k != "total_count"}) for row in rows]
    subject_name = entries[0].subject_name
    total = int(rows[0]["total_count"])
    bottom_query = text(
        _base_ctes(curriculum_credits)
        + """
        SELECT
            me.roll_no,
            me.student_name,
            me.batch,
            me.current_semester,
            me.subject_code,
            me.subject_name,
            me.total_marks,
            me.internal_marks,
            me.grade,
            RANK() OVER (
                PARTITION BY me.subject_code, me.batch, me.current_semester
                ORDER BY me.total_marks ASC, COALESCE(me.effective_internal_marks, me.total_marks) ASC
            ) AS class_rank,
            RANK() OVER (
                PARTITION BY me.subject_code, me.batch
                ORDER BY me.total_marks ASC, COALESCE(me.effective_internal_marks, me.total_marks) ASC
            ) AS batch_rank,
            ROUND((PERCENT_RANK() OVER (PARTITION BY me.subject_code ORDER BY me.total_marks) * 100)::numeric, 2) AS percentile
        FROM marks_enriched me
        WHERE lower(me.subject_code) = lower(:subject_code)
        ORDER BY class_rank ASC, batch_rank ASC, total_marks ASC
        LIMIT :limit
        """
    )
    bottom_rows = (await db.execute(bottom_query, {"subject_code": subject_code, "limit": limit})).mappings().all()

    return schemas.SubjectLeaderboardResponse(
        subject_code=subject_code,
        subject_name=subject_name,
        top_leaderboard=entries,
        bottom_leaderboard=[schemas.LeaderboardEntry(**dict(row)) for row in bottom_rows],
        pagination=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


async def get_subject_catalog(db: AsyncSession) -> list[schemas.SubjectCatalogItem]:
    query = text(
        """
        SELECT
            s.course_code AS subject_code,
            s.name AS subject_name,
            s.semester,
            COUNT(sg.id) AS records
        FROM subjects s
        LEFT JOIN semester_grades sg ON sg.subject_code = s.course_code
        GROUP BY s.course_code, s.name, s.semester
        ORDER BY COUNT(sg.id) DESC, s.course_code
        """
    )
    rows = (await db.execute(query)).mappings().all()
    return [schemas.SubjectCatalogItem(**dict(row)) for row in rows]


async def get_student_360(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    roll_no: str,
) -> schemas.Student360Profile:
    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        ,
        domain_scores AS (
            SELECT
                COALESCE(me.skill_domain, 'Core') AS domain,
                ROUND(
                    AVG(
                        CASE
                            WHEN me.effective_internal_marks IS NULL THEN COALESCE(NULLIF(me.total_marks, 0), me.grade_point * 10)
                            WHEN me.grade_point > 0 THEN me.grade_point * 10
                            ELSE me.effective_internal_marks
                        END
                    )::numeric,
                    2
                ) AS score
            FROM marks_enriched me
            WHERE me.roll_no = :roll_no
            GROUP BY COALESCE(me.skill_domain, 'Core')
        ),
        student_series AS (
            SELECT
                v.semester,
                v.sgpa,
                v.previous_sgpa,
                v.gpa_velocity AS velocity,
                COALESCE(ar.attendance_percentage, 0) AS attendance_pct,
                v.internal_avg
            FROM velocity v
            LEFT JOIN attendance_rollup ar ON ar.student_id = v.student_id
            WHERE v.roll_no = :roll_no
            ORDER BY v.semester
        ),
        student_profile AS (
            SELECT
                rs.roll_no,
                rs.reg_no,
                rs.student_name,
                rs.batch,
                rs.current_semester,
                rs.cgpa_proxy AS overall_gpa,
                rs.attendance_percentage,
                rs.gpa_velocity,
                rs.active_arrears,
                ROUND(COALESCE((
                    SELECT corr(ss.attendance_pct::float, ss.internal_avg::float)
                    FROM student_series ss
                ), 0)::numeric, 2) AS attendance_marks_correlation,
                rs.risk_score
            FROM risk_scores rs
            WHERE rs.roll_no = :roll_no
        ),
        peer_benchmark AS (
            SELECT
                COUNT(*) OVER () AS cohort_size,
                RANK() OVER (ORDER BY sc.cgpa_proxy DESC, sc.attendance_percentage DESC) AS class_rank,
                ROUND((PERCENT_RANK() OVER (ORDER BY sc.cgpa_proxy) * 100)::numeric, 2) AS percentile,
                ROUND(AVG(sc.cgpa_proxy) OVER ()::numeric, 2) AS cohort_avg_gpa,
                ROUND((sc.cgpa_proxy - AVG(sc.cgpa_proxy) OVER ())::numeric, 2) AS gap_from_cohort,
                sc.roll_no
            FROM student_current sc
            WHERE sc.current_semester = (SELECT current_semester FROM student_profile)
        ),
        subject_strengths AS (
            SELECT
                me.subject_code,
                me.subject_name,
                me.semester,
                me.grade,
                me.total_marks,
                me.internal_marks,
                ROUND(
                    CASE
                        WHEN me.effective_internal_marks IS NULL THEN COALESCE(NULLIF(me.total_marks, 0), me.grade_point * 10)
                        ELSE me.grade_point * 10 + me.effective_internal_marks
                    END::numeric,
                    2
                ) AS score,
                'Strong academic signal' AS note
            FROM marks_enriched me
            WHERE me.roll_no = :roll_no
            ORDER BY score DESC, me.total_marks DESC
            LIMIT 4
        ),
        subject_support AS (
            SELECT
                me.subject_code,
                me.subject_name,
                me.semester,
                me.grade,
                me.total_marks,
                me.internal_marks,
                ROUND(
                    CASE
                        WHEN me.effective_internal_marks IS NULL THEN COALESCE(NULLIF(me.total_marks, 0), me.grade_point * 10)
                        ELSE me.grade_point * 10 + me.effective_internal_marks
                    END::numeric,
                    2
                ) AS score,
                CASE
                    WHEN me.failed = 1 THEN 'Active backlog pressure'
                    WHEN me.effective_internal_marks IS NOT NULL AND me.effective_internal_marks < 60 THEN 'Internal recovery needed'
                    ELSE 'Performance volatility'
                END AS note
            FROM marks_enriched me
            WHERE me.roll_no = :roll_no
            ORDER BY me.failed DESC, COALESCE(me.effective_internal_marks, me.total_marks) ASC, me.total_marks ASC
            LIMIT 4
        )
        SELECT json_build_object(
            'profile', (SELECT row_to_json(sp) FROM student_profile sp),
            'domains', COALESCE((SELECT json_agg(ds) FROM domain_scores ds), '[]'::json),
            'series', COALESCE((SELECT json_agg(ss) FROM student_series ss), '[]'::json),
            'peer', (SELECT row_to_json(pb) FROM peer_benchmark pb WHERE pb.roll_no = :roll_no LIMIT 1),
            'strengths', COALESCE((SELECT json_agg(st) FROM subject_strengths st), '[]'::json),
            'support', COALESCE((SELECT json_agg(su) FROM subject_support su), '[]'::json)
        ) AS payload
        """
    )
    payload = (await db.execute(query, {"roll_no": roll_no})).scalar_one()
    profile = payload["profile"]
    if not profile:
        raise HTTPException(status_code=404, detail="Student 360 profile not found")

    gpa_velocity = float(profile["gpa_velocity"] or 0)
    gpa_trend = "Stable"
    if gpa_velocity > 0.15:
        gpa_trend = "Rising"
    elif gpa_velocity < -0.15:
        gpa_trend = "Falling"

    attendance_percentage = float(profile["attendance_percentage"])
    overall_gpa = float(profile["overall_gpa"])
    active_arrears = int(profile["active_arrears"])
    attendance_band = _attendance_band(attendance_percentage)
    placement_signal = _placement_signal(overall_gpa, active_arrears, attendance_percentage)
    raw_peer = payload.get("peer") or {
        "cohort_size": 1,
        "class_rank": 1,
        "percentile": 100.0,
        "cohort_avg_gpa": overall_gpa,
        "gap_from_cohort": 0.0,
    }
    peer = {key: value for key, value in raw_peer.items() if key != "roll_no"}
    risk_drivers = [
        schemas.StudentRiskDriver(
            label="Attendance",
            value=attendance_percentage,
            status=_tone_from_metric(attendance_percentage, 80, 75, reverse=True),
        ),
        schemas.StudentRiskDriver(
            label="Internals",
            value=float(profile["attendance_marks_correlation"] * 50 + 50 if profile["attendance_marks_correlation"] else 50),
            status="neutral" if float(profile["attendance_marks_correlation"]) >= 0 else "warning",
        ),
        schemas.StudentRiskDriver(
            label="GPA Velocity",
            value=round(max(min((gpa_velocity + 2) * 25, 100), 0), 2),
            status="positive" if gpa_velocity > 0.15 else "critical" if gpa_velocity < -0.25 else "warning" if gpa_velocity < 0 else "neutral",
        ),
        schemas.StudentRiskDriver(
            label="Backlog Load",
            value=float(active_arrears),
            status="critical" if active_arrears >= 2 else "warning" if active_arrears == 1 else "positive",
        ),
    ]
    recommended_actions: list[str] = []
    if attendance_percentage < 75:
        recommended_actions.append("Trigger counselor intervention for attendance recovery within 7 days.")
    if float(profile["attendance_marks_correlation"]) < 0:
        recommended_actions.append("Attendance is not translating into marks. Review study strategy and internal preparation.")
    if gpa_velocity < 0:
        recommended_actions.append("GPA velocity is falling. Schedule subject-wise remediation for the next cycle.")
    if active_arrears > 0:
        recommended_actions.append(f"Clear {active_arrears} active arrears before placement readiness review.")
    if not recommended_actions:
        recommended_actions.append("Maintain momentum and shift focus to high-value coding subjects for placement readiness.")

    return schemas.Student360Profile(
        roll_no=profile["roll_no"],
        reg_no=profile.get("reg_no"),
        student_name=profile["student_name"],
        batch=profile["batch"],
        section=profile.get("section"),
        current_semester=profile["current_semester"],
        overall_gpa=overall_gpa,
        attendance_percentage=attendance_percentage,
        gpa_trend=gpa_trend,
        gpa_velocity=gpa_velocity,
        attendance_marks_correlation=profile["attendance_marks_correlation"],
        active_arrears=active_arrears,
        risk_level=_risk_level(float(profile["risk_score"])),
        attendance_band=attendance_band,
        placement_signal=placement_signal,
        skill_domains=[schemas.StudentSkillDomainScore(**row) for row in payload["domains"]],
        semester_velocity=[schemas.StudentSemesterVelocity(**row) for row in payload["series"]],
        strongest_subjects=[schemas.StudentSubjectHighlight(**row) for row in payload["strengths"]],
        support_subjects=[schemas.StudentSubjectHighlight(**row) for row in payload["support"]],
        peer_benchmark=schemas.StudentPeerBenchmark(**peer),
        risk_drivers=risk_drivers,
        recommended_actions=recommended_actions,
    )


async def get_subject_bottlenecks(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    subject_code: Optional[str],
    limit: int,
    offset: int,
    sort_by: str,
) -> schemas.SubjectBottleneckResponse:
    order_sql = {
        "failure_rate": "failure_rate DESC",
        "marks_stddev": "marks_stddev DESC",
        "avg_grade": "current_average_marks ASC",
        "student_count": "attempts DESC",
        "drift": "drift_from_history ASC",
    }.get(sort_by, "failure_rate DESC")

    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        ,
        subject_history AS (
            SELECT
                me.subject_code,
                me.subject_name,
                me.semester,
                COUNT(*) AS attempts,
                ROUND((100.0 * SUM(me.failed) / NULLIF(COUNT(*), 0))::numeric, 2) AS failure_rate,
                ROUND(COALESCE(stddev_pop(me.total_marks), 0)::numeric, 2) AS marks_stddev,
                ROUND(AVG(me.total_marks)::numeric, 2) AS current_average_marks,
                ROUND(AVG(me.total_marks) FILTER (
                    WHERE substring(coalesce(me.batch, ''), 1, 4) ~ '^[0-9]{{4}}$'
                    AND CAST(substring(me.batch, 1, 4) AS INTEGER) >= EXTRACT(YEAR FROM CURRENT_DATE) - 5
                )::numeric, 2) AS historical_five_year_average,
                COUNT(*) OVER () AS total_count
            FROM marks_enriched me
            WHERE ({_cast_text_param('subject_code_val')} IS NULL OR lower(me.subject_code) = lower({_cast_text_param('subject_code_val')}))
            GROUP BY me.subject_code, me.subject_name, me.semester
        )
        SELECT
            subject_code,
            subject_name,
            semester,
            attempts,
            failure_rate,
            marks_stddev,
            current_average_marks,
            COALESCE(historical_five_year_average, current_average_marks) AS historical_five_year_average,
            ROUND((current_average_marks - COALESCE(historical_five_year_average, current_average_marks))::numeric, 2) AS drift_from_history,
            NULL::text AS faculty_context,
            total_count
        FROM subject_history
        ORDER BY {order_sql}
        OFFSET :offset LIMIT :limit
        """
    )
    rows = (await db.execute(query, {"subject_code_val": subject_code, "limit": limit, "offset": offset})).mappings().all()
    total = int(rows[0]["total_count"]) if rows else 0
    return schemas.SubjectBottleneckResponse(
        items=[schemas.SubjectBottleneckItem(**{k: v for k, v in dict(row).items() if k != "total_count"}) for row in rows],
        pagination=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


async def get_faculty_impact_matrix(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    subject_code: Optional[str],
    faculty_id: Optional[int],
    limit: int,
    offset: int,
) -> schemas.FacultyImpactMatrixResponse:
    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        ,
        subject_baseline AS (
            SELECT
                me.subject_code,
                ROUND((100.0 * SUM(me.failed) / NULLIF(COUNT(*), 0))::numeric, 2) AS subject_failure_rate
            FROM marks_enriched me
            GROUP BY me.subject_code
        ),
        faculty_matrix AS (
            SELECT
                fsa.faculty_id,
                sf.name AS faculty_name,
                sb.course_code AS subject_code,
                sb.name AS subject_name,
                COUNT(sm.id) AS student_count,
                ROUND((100.0 * SUM(CASE WHEN upper(coalesce(sm.grade, '')) IN ('U', 'FAIL', 'F', 'AB', 'W', 'I') THEN 1 ELSE 0 END) / NULLIF(COUNT(sm.id), 0))::numeric, 2) AS failure_rate,
                sbc.subject_failure_rate,
                ROUND(AVG(COALESCE(sm.total_marks, 0))::numeric, 2) AS average_marks,
                COUNT(*) OVER () AS total_count
            FROM faculty_subject_assignments fsa
            JOIN staff sf ON sf.id = fsa.faculty_id
            JOIN subjects sb ON sb.id = fsa.subject_id
            LEFT JOIN student_marks sm ON sm.subject_id = sb.id
            LEFT JOIN subject_baseline sbc ON sbc.subject_code = sb.course_code
            WHERE ({_cast_int_param('faculty_id')} IS NULL OR fsa.faculty_id = {_cast_int_param('faculty_id')})
              AND ({_cast_text_param('subject_code')} IS NULL OR lower(sb.course_code) = lower({_cast_text_param('subject_code')}))
            GROUP BY fsa.faculty_id, sf.name, sb.course_code, sb.name, sbc.subject_failure_rate
        )
        SELECT
            faculty_id,
            faculty_name,
            subject_code,
            subject_name,
            student_count,
            failure_rate,
            COALESCE(subject_failure_rate, failure_rate) AS subject_failure_rate,
            ROUND((failure_rate - COALESCE(subject_failure_rate, failure_rate))::numeric, 2) AS cohort_delta,
            average_marks,
            CASE
                WHEN failure_rate <= COALESCE(subject_failure_rate, failure_rate) - 8 THEN 'High positive impact'
                WHEN failure_rate >= COALESCE(subject_failure_rate, failure_rate) + 8 THEN 'Needs cohort review'
                ELSE 'Within subject baseline'
            END AS impact_label,
            total_count
        FROM faculty_matrix
        ORDER BY cohort_delta ASC, average_marks DESC
        OFFSET :offset LIMIT :limit
        """
    )
    rows = (await db.execute(query, {"subject_code": subject_code, "faculty_id": faculty_id, "limit": limit, "offset": offset})).mappings().all()
    total = int(rows[0]["total_count"]) if rows else 0
    return schemas.FacultyImpactMatrixResponse(
        items=[schemas.FacultyImpactMatrixItem(**{k: v for k, v in dict(row).items() if k != "total_count"}) for row in rows],
        pagination=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


async def get_placement_readiness(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    cgpa_threshold: float,
    limit: int,
    offset: int,
    sort_by: str,
) -> schemas.PlacementReadinessResponse:
    order_sql = {
        "cgpa": "cgpa DESC",
        "coding_score": "coding_subject_score DESC",
        "attendance": "attendance_percentage DESC",
    }.get(sort_by, "cgpa DESC")

    coding_filter = " OR ".join([f"lower(me.subject_name) LIKE '%{pattern}%'" for pattern in CODING_PATTERNS])
    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        ,
        coding_scores AS (
            SELECT
                me.student_id,
                ROUND(AVG(CASE WHEN {coding_filter} THEN COALESCE(me.total_marks, me.internal_marks) ELSE NULL END)::numeric, 2) AS coding_subject_score
            FROM marks_enriched me
            GROUP BY me.student_id
        ),
        placement_candidates AS (
            SELECT
                sc.roll_no,
                sc.student_name,
                sc.batch,
                sc.current_semester,
                sc.cgpa_proxy AS cgpa,
                sc.active_arrears,
                COALESCE(cs.coding_subject_score, 0) AS coding_subject_score,
                sc.attendance_percentage,
                (sc.cgpa_proxy >= :cgpa_threshold AND sc.active_arrears = 0 AND COALESCE(cs.coding_subject_score, 0) >= 65) AS placement_ready,
                COUNT(*) OVER () AS total_count
            FROM student_current sc
            LEFT JOIN coding_scores cs ON cs.student_id = sc.student_id
            WHERE sc.cgpa_proxy >= :cgpa_threshold
        )
        SELECT * FROM placement_candidates
        ORDER BY {order_sql}
        OFFSET :offset LIMIT :limit
        """
    )
    rows = (await db.execute(query, {"cgpa_threshold": cgpa_threshold, "limit": limit, "offset": offset})).mappings().all()
    total = int(rows[0]["total_count"]) if rows else 0
    return schemas.PlacementReadinessResponse(
        items=[schemas.PlacementCandidate(**{k: v for k, v in dict(row).items() if k != "total_count"}) for row in rows],
        pagination=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


async def spotlight_search(db: AsyncSession, *, query: str, limit: int = 8) -> schemas.SpotlightSearchResponse:
    sql = text(
        """
        SELECT * FROM (
            SELECT 'student' AS entity_type, st.roll_no AS entity_id, st.name AS label, concat(coalesce(st.batch, 'No batch'), ' | Sem ', coalesce(st.current_semester, 0)) AS sublabel
            FROM students st
            WHERE st.name ILIKE :pattern OR st.roll_no ILIKE :pattern
            UNION ALL
            SELECT 'faculty' AS entity_type, CAST(sf.id AS TEXT) AS entity_id, sf.name AS label, sf.department AS sublabel
            FROM staff sf
            WHERE sf.name ILIKE :pattern
            UNION ALL
            SELECT 'subject' AS entity_type, sb.course_code AS entity_id, sb.name AS label, concat('Sem ', coalesce(sb.semester, 0)) AS sublabel
            FROM subjects sb
            WHERE sb.name ILIKE :pattern OR sb.course_code ILIKE :pattern
        ) q
        LIMIT :limit
        """
    )
    rows = (await db.execute(sql, {"pattern": f"%{query}%", "limit": limit})).mappings().all()
    return schemas.SpotlightSearchResponse(results=[schemas.SpotlightResult(**dict(row)) for row in rows])


async def _get_admin_directory_rollup(db: AsyncSession, curriculum_credits: dict[str, float]) -> list[schemas.AdminDirectoryStudent]:
    query = text(
        _base_ctes(curriculum_credits)
        + """
        SELECT
            sc.roll_no,
            sc.reg_no,
            sc.student_name AS name,
            sc.city,
            sc.email,
            NULL::text AS phone_primary,
            sc.batch,
            sc.section,
            sc.current_semester,
            0 AS marks_count,
            0 AS attendance_count,
            sc.attendance_percentage,
            COALESCE(sc.cgpa_proxy, 0) AS average_grade_points,
            COALESCE(sc.internal_avg, 0) AS average_internal_percentage,
            sc.active_arrears AS backlogs,
            sc.is_initial_password,
            RANK() OVER (ORDER BY COALESCE(sc.cgpa_proxy, 0) DESC, COALESCE(sc.attendance_percentage, 0) DESC) AS rank
        FROM student_current sc
        ORDER BY rank, sc.roll_no
        """
    )
    rows = (await db.execute(query)).mappings().all()
    return [schemas.AdminDirectoryStudent(**dict(row)) for row in rows]


async def _get_batch_health(db: AsyncSession, curriculum_credits: dict[str, float]) -> list[dict]:
    query = text(
        _base_ctes(curriculum_credits)
        + """
        SELECT
            COALESCE(batch, 'Unknown') AS batch,
            ROUND(AVG(cgpa_proxy)::numeric, 2) AS avg_gpa,
            ROUND(AVG(attendance_percentage)::numeric, 2) AS avg_attendance,
            SUM(CASE WHEN active_arrears > 0 THEN 1 ELSE 0 END) AS backlog_students,
            COUNT(*) AS total_students
        FROM student_current
        GROUP BY COALESCE(batch, 'Unknown')
        ORDER BY avg_gpa DESC, avg_attendance DESC
        """
    )
    return [
        {
            "batch": row["batch"],
            "average_gpa": float(row["avg_gpa"] or 0),
            "average_attendance": float(row["avg_attendance"] or 0),
            "at_risk_count": int(row["backlog_students"] or 0),
            "total_students": int(row["total_students"] or 0)
        }
        for row in (await db.execute(query)).mappings().all()
    ]



async def _get_semester_pulse(db: AsyncSession, curriculum_credits: dict[str, float]) -> list[dict]:
    query = text(
        _base_ctes(curriculum_credits)
        + """
        SELECT
            current_semester AS semester,
            COUNT(*) AS students,
            ROUND(AVG(cgpa_proxy)::numeric, 2) AS avg_gpa,
            ROUND(AVG(attendance_percentage)::numeric, 2) AS avg_attendance,
            SUM(CASE WHEN active_arrears > 0 THEN 1 ELSE 0 END) AS backlog_students
        FROM student_current
        GROUP BY current_semester
        ORDER BY current_semester
        """
    )
    return [
        {
            "semester": int(row["semester"]),
            "average_gpa": float(row["avg_gpa"] or 0),
            "average_attendance": float(row["avg_attendance"] or 0),
            "student_count": int(row["students"] or 0),
            "at_risk_count": int(row["backlog_students"] or 0)
        }
        for row in (await db.execute(query)).mappings().all()
    ]



async def _get_risk_summary(db: AsyncSession, curriculum_credits: dict[str, float]) -> schemas.AdminRiskSummary:
    query = text(
        _base_ctes(curriculum_credits)
        + """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) AS critical,
            SUM(CASE WHEN risk_score >= 55 AND risk_score < 70 THEN 1 ELSE 0 END) AS high,
            SUM(CASE WHEN risk_score >= 35 AND risk_score < 55 THEN 1 ELSE 0 END) AS moderate,
            SUM(CASE WHEN risk_score < 35 THEN 1 ELSE 0 END) AS low
        FROM risk_scores
        """
    )
    row = (await db.execute(query)).mappings().one()
    return schemas.AdminRiskSummary(**{key: int(row[key] or 0) for key in row.keys()})


async def _get_placement_summary(db: AsyncSession, curriculum_credits: dict[str, float]) -> schemas.AdminPlacementSummary:
    coding_patterns = "|".join(CODING_PATTERNS)
    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        ,
        coding_scores AS (
            SELECT
                me.student_id,
                ROUND(AVG(CASE WHEN me.subject_name ~* :coding_patterns THEN COALESCE(me.total_marks, me.internal_marks) ELSE NULL END)::numeric, 2) AS coding_subject_score
            FROM marks_enriched me
            GROUP BY me.student_id
        )
        SELECT
            SUM(CASE WHEN sc.cgpa_proxy >= 7 AND sc.active_arrears = 0 AND COALESCE(cs.coding_subject_score, 0) >= 65 THEN 1 ELSE 0 END) AS ready_count,
            SUM(CASE WHEN sc.cgpa_proxy >= 6 AND sc.active_arrears <= 1 AND COALESCE(cs.coding_subject_score, 0) >= 55 THEN 1 ELSE 0 END) AS almost_ready_count,
            SUM(CASE WHEN sc.active_arrears > 1 OR sc.cgpa_proxy < 6 THEN 1 ELSE 0 END) AS blocked_count,
            ROUND(AVG(COALESCE(cs.coding_subject_score, 0))::numeric, 2) AS avg_coding_score
        FROM student_current sc
        LEFT JOIN coding_scores cs ON cs.student_id = sc.student_id
        """
    )
    row = (await db.execute(query, {"coding_patterns": coding_patterns})).mappings().one()
    return schemas.AdminPlacementSummary(
        ready_count=int(row["ready_count"] or 0),
        almost_ready_count=int(row["almost_ready_count"] or 0),
        blocked_count=int(row["blocked_count"] or 0),
        avg_coding_score=float(row["avg_coding_score"] or 0),
    )


async def _get_leaderboard_snapshots(db: AsyncSession, curriculum_credits: dict[str, float]) -> list[schemas.AdminLeaderboardSnapshot]:
    query = text(
        _base_ctes(curriculum_credits)
        + """
        ,
        ranked_subjects AS (
            SELECT
                me.subject_code,
                me.subject_name,
                me.current_semester,
                COUNT(*) AS attempts,
                ROUND(MAX(me.total_marks)::numeric, 2) AS top_score,
                ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY me.total_marks)::numeric, 2) AS median_score,
                ROUND((MAX(me.total_marks) - MIN(me.total_marks))::numeric, 2) AS score_spread
            FROM marks_enriched me
            GROUP BY me.subject_code, me.subject_name, me.current_semester
        )
        SELECT
            subject_code,
            subject_name,
            current_semester AS semester,
            attempts,
            top_score,
            median_score,
            score_spread
        FROM ranked_subjects
        ORDER BY attempts DESC, score_spread DESC, top_score DESC
        LIMIT 8
        """
    )
    rows = (await db.execute(query)).mappings().all()
    return [schemas.AdminLeaderboardSnapshot(**dict(row)) for row in rows]


async def _get_subject_coverage(db: AsyncSession) -> list[schemas.AdminSubjectCoverage]:
    query = text(
        """
        SELECT
            s.semester,
            COUNT(*) AS total_subjects,
            SUM(CASE WHEN COALESCE(record_counts.records, 0) > 0 THEN 1 ELSE 0 END) AS ranked_subjects,
            SUM(COALESCE(record_counts.records, 0)) AS total_records
        FROM subjects s
        LEFT JOIN (
            SELECT subject_code, COUNT(*) AS records
            FROM semester_grades
            GROUP BY subject_code
        ) record_counts ON record_counts.subject_code = s.course_code
        WHERE s.semester IS NOT NULL
        GROUP BY s.semester
        ORDER BY s.semester
        """
    )
    rows = (await db.execute(query)).mappings().all()
    return [schemas.AdminSubjectCoverage(**{key: int(row[key] or 0) for key in row.keys()}) for row in rows]


async def get_command_center(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    spotlight: str = "",
) -> schemas.AdminCommandCenterResponse:
    from .analytics_service import build_hod_dashboard

    dashboard = await build_hod_dashboard(db, curriculum_credits)
    directory = await _get_admin_directory_rollup(db, curriculum_credits)
    subject_catalog = await get_subject_catalog(db)
    bottlenecks = await get_subject_bottlenecks(db, curriculum_credits, subject_code=None, limit=6, offset=0, sort_by="failure_rate")
    faculty = await get_faculty_impact_matrix(db, curriculum_credits, subject_code=None, faculty_id=None, limit=6, offset=0)
    placements = await get_placement_readiness(db, curriculum_credits, cgpa_threshold=6.5, limit=8, offset=0, sort_by="cgpa")
    watchlist = await get_risk_registry(db, curriculum_credits, risk_level="Moderate", limit=8, offset=0, sort_by="risk_score")
    spotlight_results = await spotlight_search(db, query=spotlight, limit=8) if spotlight else schemas.SpotlightSearchResponse(results=[])
    batch_health = await _get_batch_health(db, curriculum_credits)
    semester_pulse = await _get_semester_pulse(db, curriculum_credits)
    risk_summary = await _get_risk_summary(db, curriculum_credits)
    placement_summary = await _get_placement_summary(db, curriculum_credits)
    leaderboard_snapshots = await _get_leaderboard_snapshots(db, curriculum_credits)
    subject_coverage = await _get_subject_coverage(db)

    alerts: list[str] = []
    for student in dashboard.risk_students[:4]:
        if student.risk_score >= 70 or student.gpa_drop_factor >= 1.5:
            alerts.append(f"{student.name} entered red zone with risk {student.risk_score}.")
    for subject in bottlenecks.items[:2]:
        alerts.append(f"{subject.subject_code} is trending {abs(subject.drift_from_history)} marks below its five-year baseline.")

    top_performers = sorted(directory, key=lambda item: ((item.average_grade_points or 0), (item.attendance_percentage or 0)), reverse=True)[:8]
    attendance_defaulters = sorted(directory, key=lambda item: (item.attendance_percentage or 0))[:8]
    internal_defaulters = sorted(directory, key=lambda item: (item.average_internal_percentage or 0))[:8]
    backlog_clusters = sorted([item for item in directory if (item.backlogs or 0) > 0], key=lambda item: (-(item.backlogs or 0), (item.average_grade_points or 0)))[:8]
    opportunity_students = sorted(
        [item for item in directory if (item.attendance_percentage or 0) >= 85 and (item.average_grade_points or 0) < 7],
        key=lambda item: ((item.average_grade_points or 0), -(item.attendance_percentage or 0)),
    )[:8]
    quick_actions = [
        "Open Student 360 for every red-zone student before counselor review.",
        "Use the semester-filtered leaderboard to compare top and bottom performers paper-by-paper.",
        "Export the batch summary before placement committee meetings.",
        "Map faculty assignments to unlock cohort-level teaching impact analysis.",
        "Review attendance defaulters and internal defaulters together to prioritize intervention."
    ]
    action_queue = [
        schemas.AdminCohortAction(
            title="Critical-risk sweep",
            detail="Start with red-zone students before moving to moderate watchlist cases.",
            metric=f"{risk_summary.critical} critical students",
            tone="critical" if risk_summary.critical else "info",
        ),
        schemas.AdminCohortAction(
            title="Placement pipeline",
            detail="Students who are close to placement-ready should get coding-subject mentoring first.",
            metric=f"{placement_summary.almost_ready_count} almost ready",
            tone="warning" if placement_summary.almost_ready_count else "positive",
        ),
        schemas.AdminCohortAction(
            title="Attendance rescue",
            detail="Combine attendance defaulters with support-subject cases for the fastest intervention ROI.",
            metric=f"{len(attendance_defaulters)} surfaced students",
            tone="warning" if attendance_defaulters else "info",
        ),
        schemas.AdminCohortAction(
            title="Subject bottlenecks",
            detail="Review the hardest subjects with drift below recent baseline before internal reviews.",
            metric=f"{len([item for item in bottlenecks.items if item.drift_from_history < 0])} drifting subjects",
            tone="critical" if any(item.drift_from_history < -5 for item in bottlenecks.items) else "warning",
        ),
    ]

    return schemas.AdminCommandCenterResponse(
        daily_briefing=dashboard.daily_briefing,
        department_health=dashboard.department_health,
        alerts=alerts,
        bottlenecks=bottlenecks.items,
        faculty_impact=faculty.items,
        placement_ready=placements.items,
        spotlight_results=spotlight_results.results,
        top_performers=top_performers,
        attendance_defaulters=attendance_defaulters,
        internal_defaulters=internal_defaulters,
        backlog_clusters=backlog_clusters,
        opportunity_students=opportunity_students,
        watchlist_students=watchlist.items,
        batch_health=batch_health,
        semester_pulse=semester_pulse,
        risk_summary=risk_summary,
        placement_summary=placement_summary,
        leaderboard_snapshots=leaderboard_snapshots,
        subject_coverage=subject_coverage,
        action_queue=action_queue,
        quick_actions=quick_actions,
        subject_catalog=subject_catalog,
    )


async def get_risk_registry(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
    *,
    risk_level: Optional[str],
    limit: int,
    offset: int,
    sort_by: str,
) -> schemas.RiskRegistryResponse:
    order_sql = {
        "risk_score": "risk_score DESC",
        "attendance": "attendance_percentage ASC",
        "gpa_velocity": "gpa_velocity ASC",
    }.get(sort_by, "risk_score DESC")
    query = text(
        _base_ctes(curriculum_credits)
        + f"""
        SELECT
            roll_no,
            student_name,
            risk_score,
            attendance_percentage,
            internal_avg,
            ROUND(GREATEST(0, previous_sgpa - cgpa_proxy)::numeric, 2) AS gpa_drop_factor,
            gpa_velocity,
            COUNT(*) OVER () AS total_count
        FROM risk_scores
        WHERE (CAST(:risk_level AS TEXT) IS NULL)
           OR (CAST(:risk_level AS TEXT) = 'Critical' AND risk_score >= 70)
           OR (CAST(:risk_level AS TEXT) = 'High' AND risk_score >= 55 AND risk_score < 70)
           OR (CAST(:risk_level AS TEXT) = 'Moderate' AND risk_score >= 35 AND risk_score < 55)
           OR (CAST(:risk_level AS TEXT) = 'Low' AND risk_score < 35)
        ORDER BY {order_sql}
        OFFSET :offset LIMIT :limit
        """
    )
    rows = (await db.execute(query, {"risk_level": risk_level, "limit": limit, "offset": offset})).mappings().all()
    total = int(rows[0]["total_count"]) if rows else 0
    items = []
    for row in rows:
        risk_score = float(row["risk_score"])
        alerts = []
        if float(row["attendance_percentage"]) < 75:
            alerts.append(f"Attendance at {row['attendance_percentage']}%")
        if row["internal_avg"] is not None and float(row["internal_avg"]) < 60:
            alerts.append(f"Internals at {row['internal_avg']}%")
        if float(row["gpa_drop_factor"]) > 0.5:
            alerts.append(f"GPA drop {row['gpa_drop_factor']}")
        items.append(
            schemas.StudentRiskScore(
                roll_no=row["roll_no"],
                name=row["student_name"],
                risk_score=risk_score,
                attendance_factor=float(row["attendance_percentage"]),
                internal_marks_factor=float(row["internal_avg"] or 0),
                gpa_drop_factor=float(row["gpa_drop_factor"]),
                is_at_risk=risk_score >= 55,
                risk_level=_risk_level(risk_score),
                alerts=alerts or ["Monitoring recommended"],
            )
        )
    return schemas.RiskRegistryResponse(items=items, pagination=schemas.PaginationMeta(total=total, limit=limit, offset=offset))


async def export_batch_summary_xlsx(db: AsyncSession, curriculum_credits: dict[str, float], *, cgpa_threshold: float) -> StreamingResponse:
    from openpyxl import Workbook

    placements = await get_placement_readiness(db, curriculum_credits, cgpa_threshold=cgpa_threshold, limit=500, offset=0, sort_by="cgpa")
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Placement Readiness"
    sheet.append(["Roll No", "Student Name", "Batch", "Semester", "CGPA", "Arrears", "Coding Score", "Attendance", "Ready"])
    for item in placements.items:
        sheet.append([
            item.roll_no,
            item.student_name,
            item.batch,
            item.current_semester,
            item.cgpa,
            item.active_arrears,
            item.coding_subject_score,
            item.attendance_percentage,
            "Yes" if item.placement_ready else "No",
        ])

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="mca-batch-summary.xlsx"'},
    )


async def export_student_grade_sheet_pdf(db: AsyncSession, curriculum_credits: dict[str, float], *, roll_no: str) -> StreamingResponse:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    profile = await get_student_360(db, curriculum_credits, roll_no=roll_no)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    pdf.setTitle(f"Grade Sheet {profile.roll_no}")
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(20 * mm, height - 20 * mm, "MCA Grade Sheet")
    pdf.setFont("Helvetica", 11)
    lines = [
        f"Student: {profile.student_name}",
        f"Roll No: {profile.roll_no}",
        f"Batch: {profile.batch or '-'}",
        f"Current Semester: {profile.current_semester or '-'}",
        f"Overall GPA: {profile.overall_gpa}",
        f"Attendance: {profile.attendance_percentage}%",
        f"GPA Trend: {profile.gpa_trend}",
        f"Active Arrears: {profile.active_arrears}",
    ]
    y = height - 35 * mm
    for line in lines:
        pdf.drawString(20 * mm, y, line)
        y -= 8 * mm

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(20 * mm, y - 4 * mm, "Semester Velocity")
    y -= 14 * mm
    pdf.setFont("Helvetica", 10)
    for item in profile.semester_velocity:
        pdf.drawString(
            20 * mm,
            y,
            f"Sem {item.semester}: SGPA {item.sgpa} | Velocity {item.velocity if item.velocity is not None else '-'} | Attendance {item.attendance_pct}%",
        )
        y -= 7 * mm
        if y < 20 * mm:
            pdf.showPage()
            y = height - 20 * mm
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{roll_no}-grade-sheet.pdf"'})
