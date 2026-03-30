"""
ai_service.py
-------------
Advanced AI service powered by DeepSeek-V3 via NVIDIA Integrate API.
Uses the OpenAI Python SDK for OpenAI-compatible streaming.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import AsyncGenerator

import httpx
from openai import AsyncOpenAI
from ..core.database import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Constants / Defaults
# ──────────────────────────────────────────────────────────────────────────────
CONNECT_TIMEOUT = 10.0
READ_TIMEOUT = 240.0
CLIENT_TIMEOUT = httpx.Timeout(CONNECT_TIMEOUT, read=READ_TIMEOUT)
MAX_TOKENS = 16384
TEMPERATURE = 1.0
TOP_P = 0.9

SYSTEM_PROMPT_BASE = (
    "You are SPARK AI, an intelligent academic analytics assistant embedded inside "
    "the SPARK (Scalable Production-Grade Analytics for Academic Records & Knowledge) "
    "platform. You help administrators, staff, and students with concise, data-driven "
    "insights about academic performance, attendance, placement readiness, and risk. "
    "You have access to COMPLETE, REAL database records including every student's name, "
    "GPA, attendance, backlogs, and risk status. "
    "Always be specific, professional, and compassionate. "
    "When asked to list students, DO list them by name from the data provided — never say "
    "you lack the data if it is in your context. "
    "When listing multiple items, use bullet points or a numbered list for clarity. "
    "Never fabricate data — only reason from the context provided."
)

_GRADE_POINT_SQL = """
    CASE {col}
        WHEN 'O'    THEN 10  WHEN 'S'    THEN 10
        WHEN 'A+'   THEN 9   WHEN 'A'    THEN 8
        WHEN 'B+'   THEN 7   WHEN 'B'    THEN 6
        WHEN 'C'    THEN 5   WHEN 'D'    THEN 4
        WHEN 'E'    THEN 3   WHEN 'P'    THEN 5
        WHEN 'PASS' THEN 5   ELSE NULL
    END
"""

# ──────────────────────────────────────────────────────────────────────────────
# Core API Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _api_url() -> str:
    return settings.AI_API_URL

def _api_key() -> str:
    return settings.AI_API_KEY

def _model() -> str:
    return settings.AI_MODEL

_aio_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """Singleton AsyncOpenAI client configured for NVIDIA Integrate."""
    global _aio_client
    if _aio_client is None:
        http_client = httpx.AsyncClient(timeout=CLIENT_TIMEOUT)
        _aio_client = AsyncOpenAI(
            base_url=_api_url(),
            api_key=_api_key(),
            max_retries=0,  # we handle retries ourselves
            http_client=http_client,
        )
    return _aio_client

def _build_payload(messages: list[dict], stream: bool = False, thinking: bool = True) -> dict:
    payload = {
        "model": _model(),
        "messages": messages,
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "top_p": TOP_P,
        "stream": stream,
    }
    if thinking:
        payload["extra_body"] = {"chat_template_kwargs": {"thinking": True}}
    return payload

# ──────────────────────────────────────────────────────────────────────────────
# ai_service.py — DeepSeek-V3 via NVIDIA Integrate API
# ────────────────────────────────────────────────────
# Core AI logic including tool-use, context building, and streaming.
# Replaced legacy phi4_service with DeepSeek-V3 for superior reasoning.
# ──────────────────────────────────────────────────────────────────────────────

def build_admin_context(data: dict | None, leaderboard: dict | None = None) -> str:
    if not data: return "No live dashboard data available."
    parts: list[str] = []
    health = data.get("department_health") or {}
    parts.append(
        f"DEPT_HEALTH: overall={health.get('overall_health_score', 0):.1f}%, "
        f"active_students={health.get('active_students', 0)}, "
        f"at_risk={health.get('at_risk_count', 0)}, "
        f"avg_gpa={health.get('average_gpa', 0)}, "
        f"avg_attendance={health.get('average_attendance', 0):.1f}%"
    )
    risk = data.get("risk_summary") or {}
    parts.append(f"RISK_SUMMARY: {risk}")
    top = data.get("top_performers") or []
    if top:
        rows = "\n".join(f" - {s.get('name')} (Roll: {s.get('roll_no')}) GPA={s.get('gpa')}" for s in top[:8])
        parts.append(f"TOP_PERFORMERS:\n{rows}")
    return "\n\n".join(parts)

async def build_live_context_from_db(db) -> str:
    from sqlalchemy import text as _t
    sections: list[str] = []
    gp = _GRADE_POINT_SQL
    try:
        snap = (await db.execute(_t(f"""
            SELECT COUNT(DISTINCT st.id) as total, (SELECT COUNT(*) FROM staff) as faculty
            FROM students st
        """))).mappings().first()
        if snap: sections.append(f"=== DEPT SNAPSHOT ===\nTotal Students: {snap['total']} | Faculty: {snap['faculty']}")
    except Exception as e: logger.warning(f"AI ctx [snapshot]: {e}")
    return "\n\n".join(sections)

def build_student_context(student: dict) -> str:
    if not student: return "No student data provided."
    return f"STUDENT: {student.get('name')} | Roll: {student.get('roll_no')} | GPA: {student.get('average_grade_points')} | Att%: {student.get('attendance_percentage')}"

# ──────────────────────────────────────────────────────────────────────────────
# Core API Logic (OpenAI SDK)
# ──────────────────────────────────────────────────────────────────────────────

async def generate(
    user_prompt: str,
    system: str = SYSTEM_PROMPT_BASE,
    thinking: bool = True,
    retries: int = 1
) -> str:
    payload = _build_payload(
        [{"role": "system", "content": system}, {"role": "user", "content": user_prompt}],
        stream=False,
        thinking=thinking,
    )

    for attempt in range(retries):
        try:
            logger.info("AI Gen Call via OpenAI client")
            client = _get_client()
            resp = await client.chat.completions.create(timeout=CLIENT_TIMEOUT, **payload)
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            logger.error(f"AI Gen Error (attempt {attempt+1}): {e}")
            if attempt < retries - 1:
                await asyncio.sleep(2**attempt)
            else:
                return "Generation failed."
    return "Generation failed."

async def stream_generate(
    user_prompt: str,
    system: str = SYSTEM_PROMPT_BASE,
    thinking: bool = True
) -> AsyncGenerator[str, None]:
    payload = _build_payload(
        [{"role": "system", "content": system}, {"role": "user", "content": user_prompt}],
        stream=True,
        thinking=thinking,
    )

    try:
        client = _get_client()
        completion = await client.chat.completions.create(timeout=CLIENT_TIMEOUT, **payload)
        async for chunk in completion:
            if not getattr(chunk, "choices", None):
                continue
            delta = chunk.choices[0].delta
            content = delta.content
            if content:
                yield content
    except Exception as e:
        logger.error(f"AI Stream Error: {e}")
        yield f"\n[AI Error: {str(e)}]"

# ──────────────────────────────────────────────────────────────────────────────
# Domain Wrappers
# ──────────────────────────────────────────────────────────────────────────────

async def answer_copilot_question(
    question: str,
    dashboard_context: str,
    chat_history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    system = f"{SYSTEM_PROMPT_BASE}\n\n=== LIVE DATABASE KNOWLEDGE ===\n{dashboard_context}\n=== END OF DATA ==="
    messages = [{"role": "system", "content": system}]
    if chat_history: messages.extend(chat_history[-6:])
    messages.append({"role": "user", "content": question})

    payload = _build_payload(messages, stream=True, thinking=True)

    try:
        client = _get_client()
        completion = await client.chat.completions.create(timeout=CLIENT_TIMEOUT, **payload)
        async for chunk in completion:
            if not getattr(chunk, "choices", None):
                continue
            delta = chunk.choices[0].delta
            content = delta.content
            if content:
                yield content
    except Exception as e:
        logger.error(f"Copilot Error: {e}")
        yield f"⚠️ AI service error: {str(e)}"

async def get_admin_executive_briefing(dashboard_data: dict, leaderboard: dict | None = None) -> str:
    context = build_admin_context(dashboard_data, leaderboard)
    prompt = f"Given metrics:\n{context}\n\nWrite a 3-paragraph executive briefing."
    return await generate(prompt, thinking=False)

async def get_risk_narrative_for_batch(risk_data: list[dict]) -> str:
    if not risk_data: return "No risk data available."
    prompt = f"Analyze risk for {len(risk_data)} students. Provide cohort-level interventions."
    return await generate(prompt)

async def health_check() -> dict:
    start = time.monotonic()
    try:
        await generate("ping", thinking=False)
        return {"status": "ok", "model": _model(), "latency_ms": int((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {"status": "error", "message": f"{type(e).__name__}: {str(e)}"}
