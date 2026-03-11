import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.main import build_admin_directory, build_admin_overview
import pandas as pd

def generate_gpa_report():
    db = SessionLocal()
    try:
        print("--- GPA REPORT ---")
        directory = build_admin_directory(db)
        
        if not directory:
            print("No students found in directory!")
            return

        data = []
        for s in directory:
            data.append({
                "Roll No": s.roll_no,
                "Name": s.name[:20],
                "GPA": s.average_grade_points,
                "Marks": s.marks_count,
                "Internal %": f"{s.average_internal_percentage:.1f}%",
                "Att %": f"{s.attendance_percentage:.1f}%"
            })
        
        df = pd.DataFrame(data)
        # Sort by Roll No
        df = df.sort_values(by="Roll No")
        
        print(f"Total students processed by query: {len(df)}")
        print("\nSummary Statistics:")
        print(df.describe())
        
        print("\nFirst 10 students:")
        print(df.head(10).to_string(index=False))
        
        print("\nStudents with 0 GPA:")
        zero_gpa = df[df["GPA"] == 0]
        if not zero_gpa.empty:
            print(zero_gpa[["Roll No", "Name", "Marks"]].to_string(index=False))
        else:
            print("None!")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    generate_gpa_report()
