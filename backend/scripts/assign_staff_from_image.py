"""
Seed staff + subject assignments based on the provided timetable image.

Usage (PowerShell/bash):
  python -m backend.scripts.assign_staff_from_image

Requirements:
- DATABASE_URL must be set (same as app).
- Program 'MCA' should exist (created by existing seeds). Will fail if missing.
"""
from __future__ import annotations
import asyncio
import os
import re
import sys
from pathlib import Path

from sqlalchemy import select

# Ensure backend root on path so "app" imports work when run directly
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))


def _load_backend_env_if_needed() -> None:
    """Populate environment variables from backend/.env when missing."""
    if os.environ.get("DATABASE_URL"):
        return

    env_path = BACKEND_ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


_load_backend_env_if_needed()

from app.core.database import AsyncSessionLocal
from app.core import auth
from app import models

# Academic defaults (SECTION can be overridden via env)
SECTION = os.getenv("SECTION", "A")
SEMESTER = 2
ACADEMIC_YEAR = "2025-26"
DEFAULT_PASSWORD = "password"

# Data transcribed from the timetable image (A section)
SUBJECT_MAP = [
    ("24MC201", "Internet of Things", "Mr.R.Somaskandan", "IOT"),
    ("24MC202", "Data Structures and Algorithms", "Mrs. K. Soundharya", "DS"),
    ("24MC203", "Machine Learning", "Mrs. S.Deepika", "ML"),
    ("24MC204", "Advanced Java", "Mr. K.Tamil Selvam", "JAVA"),
    ("24MC2E2", "Mobile Computing", "Dr. Ashokbaburaj", "MC"),
    ("24MC2E6", "Operation Research", "Mr. Ganeshbabu", "OR"),
    ("24MC2L1", "Data Structures and Algorithms Laboratory", "Mrs. K. Soundharya", "DS LAB"),
    ("24MC2L2", "Advance Java Laboratory", "Mr. K.Tamil Selvam", "JAVA LAB"),
    ("24MC2L3", "Machine Learning Laboratory", "Mrs. S.Deepika", "ML LAB"),
    ("24MC2L4", "Communication Skills Laboratory - II", "Mr. Karthick kumar", "COMM LAB"),
    ("AT/GD", "Aptitude Test / Group Discussion", "Mrs. K. Soundharya", "AT/GD"),
    ("AC", "Audit Course", "Dr. Ashokbaburaj", "AC"),
]


def slug_username(name: str) -> str:
    base = re.sub(r"[^a-z0-9]", "", name.lower())
    return base or "staff"


async def get_or_create_role(db, name: str) -> models.Role:
    res = await db.execute(select(models.Role).filter(models.Role.name == name))
    role = res.scalars().first()
    if not role:
        role = models.Role(name=name)
        db.add(role)
        await db.flush()
    return role


async def get_program_id(db) -> int:
    res = await db.execute(select(models.Program).filter(models.Program.code == "MCA"))
    program = res.scalars().first()
    if not program:
        raise RuntimeError("Program MCA not found; run seed_db first.")
    return program.id


async def upsert_staff(db, name: str, username_hint: str, role_id: int) -> models.Staff:
    # Try match by name
    res = await db.execute(select(models.Staff).filter(models.Staff.name == name))
    staff = res.scalars().first()
    if staff:
        return staff

    # Create new user + staff
    username = username_hint
    suffix = 1
    while True:
        res = await db.execute(select(models.User).filter(models.User.username == username))
        if not res.scalars().first():
            break
        suffix += 1
        username = f"{username_hint}{suffix}"

    user = models.User(
        username=username,
        password_hash=auth.get_password_hash(DEFAULT_PASSWORD),
        role_id=role_id,
        is_initial_password=True,
    )
    db.add(user)
    await db.flush()

    staff = models.Staff(
        id=user.id,
        name=name,
        department="MCA",
    )
    db.add(staff)
    await db.flush()
    return staff


async def upsert_subject(db, course_code: str, name: str, program_id: int) -> models.Subject:
    res = await db.execute(select(models.Subject).filter(models.Subject.course_code == course_code))
    subject = res.scalars().first()
    if subject:
        # Update name if missing
        if not subject.name and name:
            subject.name = name
        return subject
    subject = models.Subject(
        course_code=course_code,
        name=name,
        credits=0,
        program_id=program_id,
        semester=SEMESTER,
    )
    db.add(subject)
    await db.flush()
    return subject


async def upsert_assignment(db, faculty_id: int, subject_id: int):
    res = await db.execute(
        select(models.FacultySubjectAssignment).filter(
            models.FacultySubjectAssignment.faculty_id == faculty_id,
            models.FacultySubjectAssignment.subject_id == subject_id,
        )
    )
    assignment = res.scalars().first()
    if assignment:
        return assignment
    assignment = models.FacultySubjectAssignment(
        faculty_id=faculty_id,
        subject_id=subject_id,
        academic_year=ACADEMIC_YEAR,
        section=SECTION,
    )
    db.add(assignment)
    await db.flush()
    return assignment


async def main():
    async with AsyncSessionLocal() as db:
        staff_role = await get_or_create_role(db, "staff")
        program_id = await get_program_id(db)

        created = 0
        for course_code, subject_name, faculty_name, _abbr in SUBJECT_MAP:
            staff = await upsert_staff(db, faculty_name, slug_username(faculty_name), staff_role.id)
            subject = await upsert_subject(db, course_code, subject_name, program_id)
            await upsert_assignment(db, staff.id, subject.id)
            created += 1

        await db.commit()
        print(f"Processed {created} subject→staff assignments.")


if __name__ == "__main__":
    asyncio.run(main())
