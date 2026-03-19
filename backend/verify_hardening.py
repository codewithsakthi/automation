import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def verify():
    async with AsyncSessionLocal() as db:
        print("Verifying computed columns with a test insertion...")
        # Use existing student/subject to satisfy FK
        res = await db.execute(text("SELECT id FROM students LIMIT 1"))
        student_id = res.scalar()
        res = await db.execute(text("SELECT id FROM subjects LIMIT 1"))
        subject_id = res.scalar()
        
        if not student_id or not subject_id:
            print("Error: Could not find student or subject for test.")
            return

        test_sem = 12
        try:
            # Clear old test data
            await db.execute(text("DELETE FROM student_marks WHERE student_id = :st AND subject_id = :sub AND semester = :sem"),
                            {"st": student_id, "sub": subject_id, "sem": test_sem})
            
            # Insert with raw marks
            await db.execute(text("""
                INSERT INTO student_marks 
                (student_id, subject_id, semester, cit1_marks, cit2_marks, cit3_marks, semester_exam_marks)
                VALUES (:st, :sub, :sem, 25, 20, 28, 65)
            """), {"st": student_id, "sub": subject_id, "sem": test_sem})
            await db.commit()
            
            res = await db.execute(text("SELECT * FROM student_marks WHERE student_id = :st AND subject_id = :sub AND semester = :sem"),
                                 {"st": student_id, "sub": subject_id, "sem": test_sem})
            row = res.mappings().one()
            print(f"Inserted row: {dict(row)}")
            
            # internal_marks = GREATEST(25, 20, 28) = 28
            # total_marks = 28 + 65 = 93
            # 93 >= 90 -> 'O'
            
            print(f"Internal Marks: {row['internal_marks']} (Expected: 28.00)")
            print(f"Total Marks: {row['total_marks']} (Expected: 93.00)")
            print(f"Grade: {row['grade']} (Expected: O)")
            print(f"Status: {row['result_status']} (Expected: Pass)")
            
            assert float(row['internal_marks']) == 28.0
            assert float(row['total_marks']) == 93.0
            assert row['grade'] == 'O'
            assert row['result_status'] == 'Pass'
            print("Verification PASSED for computed columns.")
            
            # Clean up
            await db.execute(text("DELETE FROM student_marks WHERE student_id = :st AND subject_id = :sub AND semester = :sem"),
                            {"st": student_id, "sub": subject_id, "sem": test_sem})
            await db.commit()

        except Exception as e:
            print(f"Verification failed: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(verify())
