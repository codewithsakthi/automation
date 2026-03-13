from __future__ import annotations

from typing import Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas

GRADE_POINTS_SQL = """
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


def _credits_values(curriculum_credits: dict[str, float]) -> str:
    return ", ".join(f"('{code}', {credit})" for code, credit in curriculum_credits.items())


def _risk_level(score: float) -> str:
    if score >= 70:
        return "Critical"
    if score >= 55:
        return "High"
    if score >= 35:
        return "Moderate"
    return "Low"


def _lab_or_audit_case(subject_name_expr: str, subject_code_expr: str) -> str:
    return f"""
    CASE
        WHEN lower(coalesce({subject_name_expr}, '')) SIMILAR TO '%(lab|project|practic|workshop|audit|value added|mandatory|non credit)%' THEN FALSE
        WHEN coalesce({subject_code_expr}, '') ILIKE '%AC%' THEN FALSE
        ELSE TRUE
    END
    """


async def build_hod_dashboard(
    db: AsyncSession,
    curriculum_credits: dict[str, float],
) -> schemas.HODDashboardResponse:
    credits_values = _credits_values(curriculum_credits)
    sg_grade_points = GRADE_POINTS_SQL.format(grade_col="sg.grade")
    sm_grade_points = GRADE_POINTS_SQL.format(grade_col="sm.grade")
    sg_internal_case = _lab_or_audit_case("COALESCE(sg.subject_title, sc.name, sg.subject_code)", "sg.subject_code")
    directory_internal_case = _lab_or_audit_case("sg.subject_title", "sg.subject_code")

    dashboard_query = text(
        f"""
        WITH curriculum_credits_map AS (
            SELECT * FROM (VALUES {credits_values}) AS t(course_code, credit)
        ),
        subject_catalog AS (
            SELECT s.id, s.course_code, s.name, s.semester, COALESCE(NULLIF(s.credits, 0), ccm.credit, 0) AS credit
            FROM subjects s
            LEFT JOIN curriculum_credits_map ccm ON ccm.course_code = s.course_code
        ),
        marks_enriched AS (
            SELECT
                st.id AS student_id,
                st.roll_no,
                st.name,
                st.batch,
                st.current_semester,
                sg.semester,
                sg.subject_code,
                COALESCE(sg.subject_title, sc.name, sg.subject_code) AS subject_name,
                COALESCE(sc.credit, 0) AS credit,
                COALESCE(sg.internal_marks, 0) AS internal_marks,
                CASE
                    WHEN {sg_internal_case} THEN COALESCE(sg.internal_marks, 0)
                    ELSE NULL
                END AS effective_internal_marks,
                {sg_grade_points} AS grade_point,
                CASE WHEN upper(coalesce(sg.grade, '')) IN ('U', 'FAIL', 'F', 'AB', 'W', 'I') THEN 1 ELSE 0 END AS failed
            FROM semester_grades sg
            JOIN students st ON st.roll_no = sg.roll_no
            LEFT JOIN subject_catalog sc ON sc.course_code = sg.subject_code
        ),
        semester_gpa AS (
            SELECT
                student_id,
                roll_no,
                name,
                semester,
                CASE
                    WHEN SUM(credit) FILTER (WHERE credit > 0) > 0
                    THEN ROUND((SUM(grade_point * credit) / SUM(credit) FILTER (WHERE credit > 0))::numeric, 2)
                    ELSE 0
                END AS sgpa,
                ROUND(AVG(effective_internal_marks)::numeric, 2) AS avg_internal,
                ROUND((100.0 * SUM(CASE WHEN failed = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::numeric, 2) AS pass_rate
            FROM marks_enriched
            GROUP BY student_id, roll_no, name, semester
        ),
        gpa_velocity AS (
            SELECT
                student_id,
                roll_no,
                name,
                semester,
                sgpa,
                LAG(sgpa) OVER (PARTITION BY student_id ORDER BY semester) AS previous_sgpa,
                ROUND((sgpa - LAG(sgpa) OVER (PARTITION BY student_id ORDER BY semester))::numeric, 2) AS velocity
            FROM semester_gpa
        ),
        attendance_rollup AS (
            SELECT
                st.id AS student_id,
                ROUND(
                    COALESCE(100.0 * SUM(COALESCE(a.total_present, 0)) / NULLIF(SUM(COALESCE(a.total_hours, 0)), 0), 0)::numeric,
                    2
                ) AS attendance_pct
            FROM students st
            LEFT JOIN attendance a ON a.student_id = st.id
            GROUP BY st.id
        ),
        student_current AS (
            SELECT DISTINCT ON (st.id)
                st.id AS student_id,
                st.roll_no,
                st.name,
                st.batch,
                st.current_semester,
                COALESCE(ar.attendance_pct, 0) AS attendance_pct,
                COALESCE(sg.sgpa, 0) AS current_sgpa,
                sg.avg_internal AS internal_pct,
                COALESCE(gv.velocity, 0) AS gpa_velocity,
                COALESCE(gv.previous_sgpa, sg.sgpa, 0) AS previous_sgpa
            FROM students st
            LEFT JOIN attendance_rollup ar ON ar.student_id = st.id
            LEFT JOIN semester_gpa sg ON sg.student_id = st.id AND sg.semester = st.current_semester
            LEFT JOIN gpa_velocity gv ON gv.student_id = st.id AND gv.semester = st.current_semester
            ORDER BY st.id, st.current_semester DESC
        ),
        risk_scores AS (
            SELECT
                sc.*,
                ROUND(LEAST(
                    100,
                    GREATEST(0, (75 - sc.attendance_pct) / 75.0 * 100) * 0.30 +
                    CASE
                        WHEN sc.internal_pct IS NULL THEN 0
                        ELSE GREATEST(0, (60 - sc.internal_pct) / 60.0 * 100) * 0.30
                    END +
                    GREATEST(0, (COALESCE(sc.previous_sgpa, sc.current_sgpa) - sc.current_sgpa) * 20) * 0.40
                )::numeric, 2) AS risk_score
            FROM student_current sc
        ),
        trend_points AS (
            SELECT
                semester,
                ROUND(AVG(sgpa)::numeric, 2) AS avg_sgpa,
                ROUND(AVG(pass_rate)::numeric, 2) AS pass_rate,
                ROUND(AVG(avg_internal)::numeric, 2) AS avg_internal
            FROM semester_gpa
            GROUP BY semester
            ORDER BY semester
        ),
        failure_density AS (
            SELECT
                me.subject_code,
                me.subject_name,
                me.semester,
                COUNT(*) AS attempts,
                SUM(me.failed) AS red_zone_count,
                ROUND((100.0 * SUM(me.failed) / NULLIF(COUNT(*), 0))::numeric, 2) AS fail_rate
            FROM marks_enriched me
            GROUP BY me.subject_code, me.subject_name, me.semester
            HAVING COUNT(*) >= 3
        ),
        faculty_impact AS (
            SELECT
                fsa.faculty_id,
                sf.name AS faculty_name,
                sb.course_code AS subject_code,
                sb.name AS subject_name,
                COUNT(sm.id) AS student_count,
                ROUND(AVG({sm_grade_points})::numeric, 2) AS average_gpa,
                ROUND((100.0 * SUM(CASE WHEN upper(coalesce(sm.grade, '')) NOT IN ('U', 'FAIL', 'F', 'AB', 'W', 'I') THEN 1 ELSE 0 END) / NULLIF(COUNT(sm.id), 0))::numeric, 2) AS pass_rate
            FROM faculty_subject_assignments fsa
            JOIN staff sf ON sf.id = fsa.faculty_id
            JOIN subjects sb ON sb.id = fsa.subject_id
            LEFT JOIN student_marks sm ON sm.subject_id = sb.id
            GROUP BY fsa.faculty_id, sf.name, sb.course_code, sb.name
        )
        SELECT json_build_object(
            'metrics', json_build_object(
                'active_students', (SELECT COUNT(*) FROM students),
                'avg_attendance', COALESCE((SELECT ROUND(AVG(attendance_pct)::numeric, 2) FROM student_current), 0),
                'avg_gpa', COALESCE((SELECT ROUND(AVG(current_sgpa)::numeric, 2) FROM student_current), 0),
                'risk_count', COALESCE((SELECT COUNT(*) FROM risk_scores WHERE risk_score >= 70), 0)
            ),
            'risk_students', COALESCE((
                SELECT json_agg(x ORDER BY x.risk_score DESC)
                FROM (
                    SELECT roll_no, name, risk_score, attendance_pct, internal_pct, previous_sgpa, current_sgpa, gpa_velocity
                    FROM risk_scores
                    WHERE risk_score >= 35
                    ORDER BY risk_score DESC
                    LIMIT 8
                ) x
            ), '[]'::json),
            'trend_points', COALESCE((SELECT json_agg(tp ORDER BY tp.semester) FROM trend_points tp), '[]'::json),
            'failure_heatmap', COALESCE((
                SELECT json_agg(fd ORDER BY fd.fail_rate DESC, fd.red_zone_count DESC)
                FROM (
                    SELECT * FROM failure_density
                    ORDER BY fail_rate DESC, red_zone_count DESC
                    LIMIT 8
                ) fd
            ), '[]'::json),
            'faculty_impact', COALESCE((
                SELECT json_agg(fi ORDER BY fi.pass_rate DESC, fi.average_gpa DESC)
                FROM (
                    SELECT *, ROUND((pass_rate * 0.65 + average_gpa * 3.5)::numeric, 2) AS impact_score
                    FROM faculty_impact
                    WHERE student_count > 0
                    ORDER BY impact_score DESC
                    LIMIT 6
                ) fi
            ), '[]'::json),
            'strength_radar', COALESCE((
                SELECT json_agg(sr ORDER BY sr.gpa DESC, sr.consistency DESC)
                FROM (
                    SELECT
                        rs.roll_no,
                        rs.name,
                        rs.attendance_pct AS attendance,
                        rs.internal_pct AS internals,
                        rs.current_sgpa AS gpa,
                        ROUND(GREATEST(0, 100 - ABS(COALESCE(rs.gpa_velocity, 0)) * 40)::numeric, 2) AS consistency
                    FROM risk_scores rs
                    ORDER BY rs.current_sgpa DESC, rs.internal_pct DESC
                    LIMIT 5
                ) sr
            ), '[]'::json)
        ) AS payload
        """
    )

    result = await db.execute(dashboard_query)
    payload = result.scalar_one()

    directory_query = text(
        f"""
        WITH attendance_rollup AS (
            SELECT
                st.id AS student_id,
                ROUND(
                    COALESCE(100.0 * SUM(COALESCE(a.total_present, 0)) / NULLIF(SUM(COALESCE(a.total_hours, 0)), 0), 0)::numeric,
                    2
                ) AS attendance_percentage,
                COUNT(a.id) AS attendance_count
            FROM students st
            LEFT JOIN attendance a ON a.student_id = st.id
            GROUP BY st.id
        ),
        grade_rollup AS (
            SELECT
                st.id AS student_id,
                COUNT(sg.id) AS marks_count,
                ROUND(AVG(CASE WHEN {directory_internal_case} THEN COALESCE(sg.internal_marks, 0) ELSE NULL END)::numeric, 2) AS average_internal_percentage,
                ROUND(AVG(
                    CASE upper(coalesce(sg.grade, ''))
                        WHEN 'O' THEN 10 WHEN 'S' THEN 10 WHEN 'A+' THEN 9 WHEN 'A' THEN 8
                        WHEN 'B+' THEN 7 WHEN 'B' THEN 6 WHEN 'C' THEN 5 WHEN 'D' THEN 4
                        WHEN 'E' THEN 3 WHEN 'PASS' THEN 5 WHEN 'P' THEN 5 ELSE 0
                    END
                )::numeric, 2) AS average_grade_points,
                SUM(CASE WHEN upper(coalesce(sg.grade, '')) IN ('U', 'FAIL', 'F', 'AB', 'W', 'I') THEN 1 ELSE 0 END) AS backlogs
            FROM students st
            LEFT JOIN semester_grades sg ON sg.roll_no = st.roll_no
            GROUP BY st.id
        )
        SELECT
            st.roll_no,
            st.reg_no,
            st.name,
            st.batch,
            st.current_semester,
            NULL::text AS city,
            st.email,
            NULL::text AS phone_primary,
            COALESCE(gr.marks_count, 0) AS marks_count,
            COALESCE(ar.attendance_count, 0) AS attendance_count,
            COALESCE(ar.attendance_percentage, 0) AS attendance_percentage,
            COALESCE(gr.average_grade_points, 0) AS average_grade_points,
            COALESCE(gr.average_internal_percentage, 0) AS average_internal_percentage,
            COALESCE(gr.backlogs, 0) AS backlogs,
            RANK() OVER (ORDER BY COALESCE(gr.average_grade_points, 0) DESC, COALESCE(ar.attendance_percentage, 0) DESC) AS rank
        FROM students st
        LEFT JOIN grade_rollup gr ON gr.student_id = st.id
        LEFT JOIN attendance_rollup ar ON ar.student_id = st.id
        ORDER BY rank, st.roll_no
        LIMIT 12
        """
    )
    directory_rows = (await db.execute(directory_query)).mappings().all()
    directory = [schemas.AdminDirectoryStudent(**dict(row)) for row in directory_rows]

    metrics_blob = payload["metrics"]
    risk_students = [_build_risk_student(row) for row in payload["risk_students"]]
    trend_points = [schemas.TrendPoint(label=f"Sem {row['semester']}", **row) for row in payload["trend_points"]]
    failure_heatmap = [schemas.FailureHeatmapCell(**row) for row in payload["failure_heatmap"]]
    faculty_impact = [schemas.FacultyImpactView(**row) for row in payload["faculty_impact"]]
    strength_radar = [schemas.StudentStrengthRadar(**row) for row in payload["strength_radar"]]

    critical_risk_count = int(metrics_blob["risk_count"])

    overall_health_score = round(
        max(
            0.0,
            min(
                100.0,
                100
                - (critical_risk_count * 4)
                + (metrics_blob["avg_attendance"] - 75) * 0.2
                + (metrics_blob["avg_gpa"] - 6) * 6,
            ),
        ),
        2,
    )

    daily_briefing = _build_daily_briefing(
        overall_health_score=overall_health_score,
        failure_heatmap=failure_heatmap,
        trend_points=trend_points,
        risk_students=risk_students,
        critical_risk_count=critical_risk_count,
    )

    department_health = schemas.DepartmentHealth(
        overall_health_score=overall_health_score,
        active_students=metrics_blob["active_students"],
        at_risk_count=critical_risk_count,
        average_attendance=metrics_blob["avg_attendance"],
        average_gpa=metrics_blob["avg_gpa"],
        department_name="MCA",
        daily_briefing=daily_briefing,
        semester_trends=[point.model_dump() for point in trend_points],
        top_critical_subjects=[
            schemas.SubjectDifficultyItem(
                code=item.subject_code,
                subject=item.subject_name,
                semester=item.semester,
                fail_rate=item.fail_rate,
                average_grade_point=0,
                average_internal=0,
                variance=0,
                difficulty_index=round(item.fail_rate / 10, 2),
                pass_rate=round(100 - item.fail_rate, 2),
            )
            for item in failure_heatmap[:5]
        ],
    )

    metrics = {
        "activeStudents": schemas.DashboardMetric(value=metrics_blob["active_students"], label="Active Students"),
        "averageAttendance": schemas.DashboardMetric(value=metrics_blob["avg_attendance"], label="Average Attendance"),
        "averageGpa": schemas.DashboardMetric(value=metrics_blob["avg_gpa"], label="Average GPA"),
        "criticalRisk": schemas.DashboardMetric(value=department_health.at_risk_count, label="Critical Risk"),
        "healthScore": schemas.DashboardMetric(value=department_health.overall_health_score, label="Health Score"),
    }

    return schemas.HODDashboardResponse(
        department_health=department_health,
        metrics=metrics,
        daily_briefing=daily_briefing,
        risk_students=risk_students,
        trend_points=trend_points,
        failure_heatmap=failure_heatmap,
        faculty_impact=faculty_impact,
        strength_radar=strength_radar,
        directory=directory,
    )


def _build_risk_student(row: dict) -> schemas.StudentRiskScore:
    alerts = []
    if row["attendance_pct"] < 75:
        alerts.append(f"Attendance at {row['attendance_pct']}%")
    if row["internal_pct"] is not None and row["internal_pct"] < 60:
        alerts.append(f"Internals at {row['internal_pct']}%")
    if row["current_sgpa"] < row["previous_sgpa"]:
        alerts.append(f"GPA velocity {row['gpa_velocity']}")

    risk_score = float(row["risk_score"])
    return schemas.StudentRiskScore(
        roll_no=row["roll_no"],
        name=row["name"],
        risk_score=risk_score,
        attendance_factor=float(row["attendance_pct"]),
        internal_marks_factor=float(row["internal_pct"] or 0),
        gpa_drop_factor=max(0.0, float(row["previous_sgpa"]) - float(row["current_sgpa"])),
        is_at_risk=risk_score >= 55,
        risk_level=_risk_level(risk_score),
        alerts=alerts or ["Monitoring recommended"],
    )


def _build_daily_briefing(
    *,
    overall_health_score: float,
    failure_heatmap: Iterable[schemas.FailureHeatmapCell],
    trend_points: Iterable[schemas.TrendPoint],
    risk_students: Iterable[schemas.StudentRiskScore],
    critical_risk_count: int,
) -> str:
    failure_heatmap = list(failure_heatmap)
    trend_points = list(trend_points)
    risk_students = list(risk_students)

    lead = f"Overall Dept. Health is {round(overall_health_score)}%."
    if failure_heatmap:
        hottest = failure_heatmap[0]
        lead += f" Alert: {hottest.subject_name} in Sem {hottest.semester} is showing a {round(hottest.fail_rate, 1)}% red-zone cluster."

    if trend_points:
        latest = trend_points[-1]
        lead += f" Current semester GPA is {latest.avg_sgpa} with {latest.pass_rate}% pass momentum."

    if risk_students:
        lead += f" {critical_risk_count} students need immediate intervention."

    return lead[:400]
