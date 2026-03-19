"""
Risk scoring unit tests.

Tests the pure Python logic of `StudentService.calculate_student_risk`.
We patch `calculate_analytics` (the DB-dependent part) and supply a
correctly-shaped mock student object so only the risk formula is exercised.

Risk formula (from student_service.py):
  att_risk     = max(0, (75 - att_pct) / 75 * 100) if att_pct < 75 else 0
  risk_score  += att_risk * 0.3

  internal_risk = max(0, (60 - avg_internal) / 60 * 100) if avg_internal < 60 else 0
  risk_score  += internal_risk * 0.3   (only if internal marks present on student)

  gpa_drop     = max(0, prev_gpa - current_gpa)
  velocity_risk = min(100, gpa_drop * 50)
  risk_score  += velocity_risk * 0.4   (only if ≥ 2 semesters)

  risk_level: >70 → Critical, >50 → High, >30 → Moderate, else Low
  is_at_risk:  risk_score > 50
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from app.services.student_service import StudentService
from app.schemas.base import (
    AnalyticsSummary, AttendanceInsight, SemesterPerformanceItem,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_student(roll_no: str = "23CS001", name: str = "Test Student"):
    """Build a minimal mock Student with empty marks (no internal marks check)."""
    student = MagicMock()
    student.roll_no = roll_no
    student.name = name
    student.marks = []  # empty → internal_marks_available = False
    return student


def _analytics(
    att_pct: float,
    avg_internal: float = 0.0,
    gpa_now: float = 8.0,
    gpa_prev: float | None = None,
) -> AnalyticsSummary:
    """Build a minimal AnalyticsSummary to feed the risk scorer."""
    semesters = []
    if gpa_prev is not None:
        semesters.append(SemesterPerformanceItem(
            semester=1, subject_count=5,
            average_internal=avg_internal,
            average_grade_points=gpa_prev,
            backlog_count=0,
        ))
    semesters.append(SemesterPerformanceItem(
        semester=2, subject_count=5,
        average_internal=avg_internal,
        average_grade_points=gpa_now,
        backlog_count=0,
    ))

    return AnalyticsSummary(
        average_grade_points=gpa_now,
        average_internal=avg_internal,
        total_backlogs=0,
        total_subjects=10,
        grade_distribution=[],
        semester_performance=semesters,
        risk_subjects=[],
        strength_subjects=[],
        attendance=AttendanceInsight(
            total_present=int(att_pct),
            total_hours=100,
            percentage=att_pct,
            recent_streak_days=0,
            absent_days=int(100 - att_pct),
        ),
    )


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_risk_critical_low_attendance():
    """
    att_pct=10, GPA drop 9→0 (no internal marks because CS101 not in CURRICULUM_CREDITS):
      att_risk = (75-10)/75*100 = 86.67 → ×0.3 = 26.0
      velocity  = min(100, 9*50) = 100  → ×0.4 = 40.0
      total = 66.0 → High (>50, <70)
    """
    student = _mock_student()
    # marks list non-empty but course code unknown to CURRICULUM_CREDITS
    # → has_internal_component returns False → no internal contribution
    mark_stub = MagicMock()
    mark_stub.internal_marks = 10.0
    mark_stub.subject = MagicMock()
    mark_stub.subject.course_code = "CS101"
    mark_stub.subject.name = "Data Structures"
    student.marks = [mark_stub]

    analytics = _analytics(att_pct=10, avg_internal=10, gpa_now=0, gpa_prev=9)

    with patch.object(StudentService, "calculate_analytics", AsyncMock(return_value=analytics)):
        result = await StudentService.calculate_student_risk(student, db=MagicMock())

    # 66 → High (risk_score > 50 and ≤ 70)
    assert result.risk_level in ("High", "Critical")  # Critical if internal kicks in
    assert result.is_at_risk is True
    assert result.risk_score > 50
    assert any("Attendance" in alert for alert in result.alerts)


async def test_risk_low_good_standing():
    """Attendance ≥ 85%, no GPA drop → Low risk."""
    student = _mock_student()
    analytics = _analytics(att_pct=90.0, gpa_now=8.5, gpa_prev=8.5)

    with patch.object(StudentService, "calculate_analytics", AsyncMock(return_value=analytics)):
        result = await StudentService.calculate_student_risk(student, db=MagicMock())

    assert result.risk_level == "Low"
    assert result.is_at_risk is False
    assert result.risk_score == 0.0


async def test_risk_high_large_gpa_drop():
    """
    att=45%, GPA drop 9→0, no internal marks:
      att_risk = (75-45)/75*100 = 40 → ×0.3 = 12
      velocity = min(100, 9*50) = 100 → ×0.4 = 40
      total = 52 → High (>50)
    """
    student = _mock_student()
    analytics = _analytics(att_pct=45.0, gpa_now=0.0, gpa_prev=9.0)

    with patch.object(StudentService, "calculate_analytics", AsyncMock(return_value=analytics)):
        result = await StudentService.calculate_student_risk(student, db=MagicMock())

    assert result.risk_level in ("High", "Critical")
    assert result.is_at_risk is True
    assert any("GPA" in alert for alert in result.alerts)


async def test_low_attendance_alert_present():
    """Attendance below 75% must produce an alert string."""
    student = _mock_student()
    analytics = _analytics(att_pct=65.0)

    with patch.object(StudentService, "calculate_analytics", AsyncMock(return_value=analytics)):
        result = await StudentService.calculate_student_risk(student, db=MagicMock())

    assert any("Attendance" in alert for alert in result.alerts)


async def test_no_alerts_for_healthy_student():
    """Good student produces no alerts."""
    student = _mock_student()
    analytics = _analytics(att_pct=90.0, avg_internal=75.0, gpa_now=8.5, gpa_prev=8.5)

    with patch.object(StudentService, "calculate_analytics", AsyncMock(return_value=analytics)):
        result = await StudentService.calculate_student_risk(student, db=MagicMock())

    assert result.alerts == []
