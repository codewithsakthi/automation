from app.database import SessionLocal
from app.main import build_admin_overview, build_full_student_record

def test():
    db = SessionLocal()
    try:
        ov = build_admin_overview(db)
        print("OVERVIEW - TOTAL STUDENTS:", ov.total_students)
        print("OVERVIEW - AVG GPA:", ov.average_grade_points)
        
        # Test specific student record
        test_roll = "258312"
        record = build_full_student_record(test_roll, db)
        print(f"\nSTUDENT {test_roll} RECORD:")
        print(f"Name: {record.core_profile.name}")
        print(f"GPA: {record.academic_snapshot.cgpa_proxy}")
        print(f"CIT Marks Count: {len(record.internal_marks)}")
        print(f"Semester Grades Count: {len(record.semester_grades)}")
        
        if record.internal_marks:
            first = record.internal_marks[0]
            print(f"Sample CIT Mark: {first.subject_code} Test {first.test_number} = {first.percentage}%")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("CRASH CAUSE:", str(getattr(e, '__cause__', e)))

if __name__ == "__main__":
    test()
