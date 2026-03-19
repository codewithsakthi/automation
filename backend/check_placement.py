
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

# Simplified coding scores logic from enterprise_analytics.py
CODING_PATTERNS = ["python", "program", "java", "data structure", "algorithm", "web", "database"]
coding_patterns_regex = "|".join(CODING_PATTERNS)

def _base_ctes():
    return f"""
    WITH marks_enriched AS (
        SELECT roll_no as student_id, subject_title as subject_name, marks as total_marks, internal_marks
        FROM semester_grades
    ),
    coding_scores AS (
        SELECT
            student_id,
            ROUND(AVG(CASE WHEN subject_name ~* '{coding_patterns_regex}' THEN COALESCE(total_marks, internal_marks) ELSE NULL END)::numeric, 2) AS coding_subject_score
        FROM marks_enriched
        GROUP BY student_id
    )
    """

async def check_placement():
    async with AsyncSessionLocal() as db:
        query = text(_base_ctes() + """
            SELECT 
                COUNT(*) as total,
                AVG(COALESCE(coding_subject_score, 0)) as avg_code_score,
                SUM(CASE WHEN coding_subject_score >= 65 THEN 1 ELSE 0 END) as coding_ready
            FROM coding_scores
        """)
        result = await db.execute(query)
        row = result.mappings().one()
        print(f"Coding Stats: {dict(row)}")

        query = text(_base_ctes() + "SELECT student_id, coding_subject_score FROM coding_scores LIMIT 10")
        result = await db.execute(query)
        scores = result.fetchall()
        print(f"Sample coding scores: {scores}")

if __name__ == "__main__":
    asyncio.run(check_placement())
