from app.database import engine
from sqlalchemy import text

def create_tables():
    print("Creating missing legacy JSON tables for the Dashboard query...")
    with engine.connect() as conn:
        conn.execute(text("""
            DROP TABLE IF EXISTS contact_info;
            CREATE TABLE IF NOT EXISTS contact_info (
                roll_no TEXT PRIMARY KEY, address TEXT, pincode TEXT, phone_primary TEXT, 
                phone_secondary TEXT, phone_tertiary TEXT, email TEXT, city TEXT
            );
            DROP TABLE IF EXISTS family_details;
            CREATE TABLE IF NOT EXISTS family_details (
                roll_no TEXT PRIMARY KEY, parent_guardian_name TEXT, occupation TEXT, parent_phone TEXT, 
                emergency_name TEXT, emergency_address TEXT, emergency_phone TEXT, emergency_email TEXT, 
                father_name TEXT, mother_name TEXT, parent_occupation TEXT, parent_address TEXT, parent_email TEXT,
                emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, 
                emergency_contact_address TEXT, emergency_contact_email TEXT
            );
            DROP TABLE IF EXISTS previous_academics;
            CREATE TABLE IF NOT EXISTS previous_academics (
                id SERIAL PRIMARY KEY, roll_no TEXT, qualification TEXT, school_name TEXT, 
                passing_year TEXT, percentage NUMERIC, level TEXT, institution TEXT, 
                year_passing TEXT, board_university TEXT
            );
            DROP TABLE IF EXISTS semester_grades;
            CREATE TABLE IF NOT EXISTS semester_grades (
                id SERIAL PRIMARY KEY, roll_no TEXT, semester INTEGER, subject_code TEXT, 
                subject_title TEXT, grade TEXT, marks NUMERIC, internal_marks NUMERIC, 
                attempt INTEGER, remarks TEXT
            );
            DROP TABLE IF EXISTS internal_marks;
            CREATE TABLE IF NOT EXISTS internal_marks (
                id SERIAL PRIMARY KEY, roll_no TEXT, semester INTEGER, test_number INTEGER, 
                percentage NUMERIC, subject_code TEXT, subject_title TEXT
            );
            DROP TABLE IF EXISTS counselor_diary;
            CREATE TABLE IF NOT EXISTS counselor_diary (
                meeting_id SERIAL PRIMARY KEY, roll_no TEXT, semester INTEGER, meeting_date DATE, 
                remark_category TEXT, remarks TEXT, action_planned TEXT, follow_up_date DATE, 
                counselor_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            DROP TABLE IF EXISTS extra_curricular;
            CREATE TABLE IF NOT EXISTS extra_curricular (
                activity_id SERIAL PRIMARY KEY, roll_no TEXT, category TEXT, description TEXT, 
                year TEXT, activity_type TEXT
            );
            DROP TABLE IF EXISTS attendance_summary;
            CREATE TABLE IF NOT EXISTS attendance_summary (
                roll_no TEXT, present_days INTEGER, absent_days INTEGER, leave_days INTEGER, semester INTEGER,
                PRIMARY KEY (roll_no, semester)
            );
        """))
        conn.commit()
        print("Success!")

if __name__ == '__main__':
    create_tables()
