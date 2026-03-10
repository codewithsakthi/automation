from app.database import engine, Base
from sqlalchemy import text

def reset_db():
    print("Resetting database...")
    try:
        with engine.connect() as conn:
            # Drop all tables in current schema
            conn.execute(text("DROP TABLE IF EXISTS attendance CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS student_marks CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS students CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS staff CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS subjects CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS programs CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS roles CASCADE;"))
            conn.commit()
            print("Successfully dropped all tables.")
    except Exception as e:
        print(f"Error resetting DB: {e}")

if __name__ == "__main__":
    reset_db()
