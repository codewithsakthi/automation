import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.main import build_admin_directory, build_admin_overview
import pandas as pd

def generate_gpa_report():
    db = SessionLocal()
    try:
        print("Generating GPA Report for everyone...")
        directory = build_admin_directory(db)
        overview = build_admin_overview(db)
        
        data = []
        for s in directory:
            data.append({
                "Roll No": s.roll_no,
                "Name": s.name,
                "GPA": s.average_grade_points,
                "Marks Count": s.marks_count,
                "Attendance %": f"{s.attendance_percentage:.2f}%",
                "Backlogs": s.backlogs
            })
        
        df = pd.DataFrame(data)
        # Sort by GPA descending
        df = df.sort_values(by="GPA", ascending=False)
        
        print("\n=== SYSTEM OVERVIEW ===")
        print(f"Total Students: {overview.total_students}")
        print(f"System Avg GPA: {overview.average_grade_points:.2f}")
        print(f"Avg Attendance: {overview.average_attendance:.2f}%")
        
        print("\n=== STUDENT GPA LIST (Top 60) ===")
        print(df.to_string(index=False))
        
        # Count students with 0 GPA
        zero_gpa = df[df["GPA"] == 0]
        if not zero_gpa.empty:
            print(f"\nNote: {len(zero_gpa)} students have 0.0 GPA (likely missing snapshot data).")
            print("Missing snapshots for:", ", ".join(zero_gpa["Roll No"].tolist()))

    except Exception as e:
        print(f"Error generating report: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    generate_gpa_report()
