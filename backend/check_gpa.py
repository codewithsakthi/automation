
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

AVG_MARKS_CASE = """
CASE upper(coalesce(grade, ''))
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

def _base_ctes():
    return f"""
    WITH student_current AS (
        SELECT s.id as student_id, s.roll_no, s.name as student_name, s.batch, s.current_semester,
               COALESCE(avg_grades.avg_grade, 0) as cgpa_proxy,
               COALESCE(att.attendance_percentage, 0) as attendance_percentage,
               COALESCE(arr.active_arrears, 0) as active_arrears
        FROM students s
        LEFT JOIN (
            SELECT roll_no, AVG(COALESCE(marks, {AVG_MARKS_CASE}, internal_marks, 0)) / 10 as avg_grade
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

async def check_gpa():
    async with AsyncSessionLocal() as db:
        query = text(_base_ctes() + """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN cgpa_proxy >= 7 THEN 1 ELSE 0 END) as above_7,
                SUM(CASE WHEN cgpa_proxy >= 6 THEN 1 ELSE 0 END) as above_6,
                AVG(cgpa_proxy) as avg_cgpa
            FROM student_current
        """)
        result = await db.execute(query)
        row = result.mappings().one()
        print(f"Updated GPA Stats: {dict(row)}")

if __name__ == "__main__":
    asyncio.run(check_gpa())
