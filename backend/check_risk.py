
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

# Simplified risk calculation logic from enterprise_analytics.py
def _base_ctes():
    return """
    WITH student_current AS (
        SELECT s.id as student_id, s.roll_no, s.name as student_name, s.batch, s.current_semester,
               COALESCE(avg_grades.avg_grade, 0) as cgpa_proxy,
               COALESCE(att.attendance_percentage, 0) as attendance_percentage,
               COALESCE(arr.active_arrears, 0) as active_arrears
        FROM students s
        LEFT JOIN (
            SELECT roll_no, AVG(marks)/10 as avg_grade
            FROM semester_grades
            GROUP BY roll_no
        ) avg_grades ON avg_grades.roll_no = s.roll_no
        LEFT JOIN (
            SELECT roll_no, 
                   CAST(SUM(present_days) AS FLOAT) * 100 / NULLIF(SUM(present_days + absent_days), 0) as attendance_percentage
            FROM attendance_summary
            GROUP BY roll_no
        ) att ON att.roll_no = s.roll_no
        LEFT JOIN (
            SELECT roll_no, COUNT(*) as active_arrears
            FROM semester_grades
            WHERE grade = 'F'
            GROUP BY roll_no
        ) arr ON arr.roll_no = s.roll_no
    ),
    risk_scores AS (
        SELECT roll_no, student_name, cgpa_proxy, attendance_percentage, active_arrears,
               (
                   (CASE WHEN attendance_percentage < 75 THEN 40 ELSE 0 END) +
                   (CASE WHEN active_arrears > 0 THEN active_arrears * 15 ELSE 0 END) +
                   (CASE WHEN cgpa_proxy < 6 THEN 20 ELSE 0 END)
               ) as risk_score
        FROM student_current
    )
    """

async def check_risk_dist():
    async with AsyncSessionLocal() as db:
        query = text(_base_ctes() + """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN risk_score >= 55 AND risk_score < 70 THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN risk_score >= 35 AND risk_score < 55 THEN 1 ELSE 0 END) as moderate,
                SUM(CASE WHEN risk_score < 35 THEN 1 ELSE 0 END) as low
            FROM risk_scores
        """)
        result = await db.execute(query)
        row = result.mappings().one()
        print(f"Risk Distribution: {dict(row)}")

        query = text(_base_ctes() + "SELECT risk_score FROM risk_scores LIMIT 10")
        result = await db.execute(query)
        scores = [r[0] for r in result.fetchall()]
        print(f"Sample risk scores: {scores}")

if __name__ == "__main__":
    asyncio.run(check_risk_dist())
