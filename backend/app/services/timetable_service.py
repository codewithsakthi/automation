from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

# Abbreviation -> canonical subject metadata from the provided timetables
SUBJECT_META: Dict[str, Dict[str, str]] = {
    "IOT": {"course_code": "24MC201", "name": "Internet of Things"},
    "DS": {"course_code": "24MC202", "name": "Data Structures and Algorithms"},
    "ML": {"course_code": "24MC203", "name": "Machine Learning"},
    "JAVA": {"course_code": "24MC204", "name": "Advanced Java"},
    "MC": {"course_code": "24MC2E2", "name": "Mobile Computing"},
    "OR": {"course_code": "24MC2E6", "name": "Operation Research"},
    "DS LAB": {"course_code": "24MC2L1", "name": "Data Structures and Algorithms Laboratory"},
    "JAVA LAB": {"course_code": "24MC2L2", "name": "Advance Java Laboratory"},
    "ML LAB": {"course_code": "24MC2L3", "name": "Machine Learning Laboratory"},
    "COMM LAB": {"course_code": "24MC2L4", "name": "Communication Skills Laboratory - II"},
    "AT/GD": {"course_code": "AT/GD", "name": "Aptitude Test / Group Discussion"},
    "AC": {"course_code": "AC", "name": "Audit Course"},
}

# Day-of-week (0 = Monday) -> list of (hour, abbreviation) pairs
STATIC_TIMETABLE: Dict[str, Dict[int, List[tuple[int, str]]]] = {
    "A": {
        0: [(1, "DS"), (2, "MC"), (3, "JAVA"), (4, "IOT"), (5, "ML"), (6, "OR"), (7, "AT/GD")],
        1: [(1, "ML"), (2, "DS"), (3, "MC"), (4, "JAVA"), (5, "IOT"), (6, "DS LAB")],
        2: [(1, "OR"), (2, "JAVA"), (3, "COMM LAB"), (5, "ML"), (6, "MC"), (7, "DS")],
        3: [(1, "JAVA"), (2, "MC"), (3, "ML LAB"), (5, "IOT"), (6, "OR"), (7, "DS")],
        4: [(1, "IOT"), (2, "DS"), (3, "ML"), (4, "OR"), (5, "JAVA"), (6, "JAVA LAB")],
        5: [(1, "DS LAB"), (3, "JAVA LAB"), (5, "AC"), (6, "ML LAB")],
    },
    "B": {
        0: [(1, "ML"), (2, "IOT"), (3, "OR"), (4, "DS"), (5, "JAVA"), (6, "ML LAB")],
        1: [(1, "OR"), (2, "IOT"), (3, "JAVA"), (4, "DS"), (5, "ML"), (6, "MC"), (7, "AT/GD")],
        2: [(1, "DS"), (2, "MC"), (3, "COMM LAB"), (5, "DS"), (6, "IOT"), (7, "JAVA")],
        3: [(1, "OR"), (2, "ML"), (3, "JAVA"), (4, "MC"), (5, "DS"), (6, "JAVA LAB")],
        4: [(1, "MC"), (2, "JAVA"), (3, "DS LAB"), (5, "IOT"), (6, "OR"), (7, "ML")],
        5: [(1, "JAVA LAB"), (3, "ML LAB"), (5, "AC"), (6, "DS LAB")],
    },
}


async def _subject_lookup(db: AsyncSession) -> Dict[str, models.Subject]:
    """Return a dictionary keyed by upper-cased course_code."""
    result = await db.execute(select(models.Subject))
    subjects = result.scalars().all()
    return {s.course_code.upper(): s for s in subjects}


def _materialize_entries(
    raw: Dict[int, List[tuple[int, str]]],
    section: str,
    subject_lookup: Dict[str, models.Subject],
    semester_fallback: int = 2,
) -> List[dict]:
    """Convert raw static timetable rows into serializable dicts."""
    entries: List[dict] = []
    for day, hour_slots in raw.items():
        for hour, abbr in hour_slots:
            meta = SUBJECT_META.get(abbr, {"course_code": abbr, "name": abbr})
            subject = subject_lookup.get(meta["course_code"].upper())
            entries.append(
                {
                    "id": subject.id if subject else int(f"{day}{hour}"),
                    "day_of_week": day,
                    "hour": hour,
                    "subject_id": subject.id if subject else 0,
                    "subject_name": subject.name if subject else meta["name"],
                    "course_code": subject.course_code if subject else meta["course_code"],
                    "section": section,
                    "semester": subject.semester if subject else semester_fallback,
                }
            )
    return entries


async def get_faculty_timetable(
    db: AsyncSession, faculty_id: int, section: Optional[str] = None, semester: Optional[int] = None
) -> List[dict]:
    """
    Fetch timetable rows for a faculty member. Falls back to the static MCA II sem timetable
    when the database has no entries.
    """
    q = (
        select(models.TimeTable, models.Subject)
        .join(models.Subject, models.TimeTable.subject_id == models.Subject.id)
        .filter(models.TimeTable.faculty_id == faculty_id)
    )
    if section:
        q = q.filter(models.TimeTable.section == section)
    if semester:
        q = q.filter(models.TimeTable.semester == semester)

    result = await db.execute(q)
    rows = result.all()
    if rows:
        return [
            {
                "id": tt.id,
                "day_of_week": tt.day_of_week,
                "hour": tt.hour,
                "subject_id": tt.subject_id,
                "subject_name": subj.name,
                "course_code": subj.course_code,
                "section": tt.section,
                "semester": tt.semester,
            }
            for tt, subj in rows
        ]

    # fallback
    section_key = (section or "A").upper()
    subject_lookup = await _subject_lookup(db)
    raw = STATIC_TIMETABLE.get(section_key) or STATIC_TIMETABLE["A"]
    return _materialize_entries(raw, section_key, subject_lookup, semester_fallback=semester or 2)


async def get_section_timetable(
    db: AsyncSession, section: Optional[str] = None, semester: Optional[int] = None
) -> List[dict]:
    """Fetch timetable rows for a given section (student-facing)."""
    section_key = (section or "A").upper()
    q = (
        select(models.TimeTable, models.Subject)
        .join(models.Subject, models.TimeTable.subject_id == models.Subject.id)
        .filter(models.TimeTable.section == section_key)
    )
    if semester:
        q = q.filter(models.TimeTable.semester == semester)

    result = await db.execute(q)
    rows = result.all()
    if rows:
        return [
            {
                "id": tt.id,
                "day_of_week": tt.day_of_week,
                "hour": tt.hour,
                "subject_id": tt.subject_id,
                "subject_name": subj.name,
                "course_code": subj.course_code,
                "section": tt.section,
                "semester": tt.semester,
            }
            for tt, subj in rows
        ]

    subject_lookup = await _subject_lookup(db)
    raw = STATIC_TIMETABLE.get(section_key) or STATIC_TIMETABLE["A"]
    return _materialize_entries(raw, section_key, subject_lookup, semester_fallback=semester or 2)
