import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def cleanse():
    async with AsyncSessionLocal() as db:
        # 1. Clamp marks to ranges
        print("Clamping marks to allowed ranges...")
        queries = [
            "UPDATE student_marks SET cit1_marks = 30 WHERE cit1_marks > 30",
            "UPDATE student_marks SET cit1_marks = 0 WHERE cit1_marks < 0",
            "UPDATE student_marks SET cit2_marks = 30 WHERE cit2_marks > 30",
            "UPDATE student_marks SET cit2_marks = 0 WHERE cit2_marks < 0",
            "UPDATE student_marks SET cit3_marks = 30 WHERE cit3_marks > 30",
            "UPDATE student_marks SET cit3_marks = 0 WHERE cit3_marks < 0",
            "UPDATE student_marks SET semester_exam_marks = 100 WHERE semester_exam_marks > 100",
            "UPDATE student_marks SET semester_exam_marks = 0 WHERE semester_exam_marks < 0",
            "UPDATE student_marks SET semester = 1 WHERE semester < 1",
            "UPDATE student_marks SET semester = 12 WHERE semester > 12",
        ]
        
        for q in queries:
            await db.execute(text(q))
        
        # 2. Resolve duplicates for (student_id, subject_id, semester)
        print("Finding and resolving duplicates for (student_id, subject_id, semester)...")
        res = await db.execute(text("""
            SELECT student_id, subject_id, semester
            FROM student_marks
            GROUP BY student_id, subject_id, semester
            HAVING COUNT(*) > 1
        """))
        duplicates = res.all()
        print(f"Found {len(duplicates)} sets of duplicates.")
        
        for student_id, subject_id, semester in duplicates:
            # Keep the one with the highest ID
            res = await db.execute(text("""
                SELECT id FROM student_marks 
                WHERE student_id = :st_id AND subject_id = :sub_id AND semester = :sem
                ORDER BY id DESC
            """), {"st_id": student_id, "sub_id": subject_id, "sem": semester})
            ids = [row[0] for row in res.all()]
            
            if len(ids) > 1:
                ids_to_delete = ids[1:]
                print(f"Deleting {len(ids_to_delete)} duplicates for Student {student_id}, Subject {subject_id}, Sem {semester}")
                await db.execute(text("DELETE FROM student_marks WHERE id = ANY(:ids)"), {"ids": ids_to_delete})
        
        await db.commit()
        print("Data cleansing complete.")

if __name__ == "__main__":
    asyncio.run(cleanse())
