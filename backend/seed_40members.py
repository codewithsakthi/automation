import csv
import hashlib
from app.database import SessionLocal, engine, Base
from app import models
from sqlalchemy import text

def get_simple_hash(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def seed_db():
    print("Resetting remote database...")
    try:
        with engine.connect() as conn:
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
        return

    print("Re-creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Seed Roles
        roles = ['admin', 'staff', 'student']
        for role_name in roles:
            if not db.query(models.Role).filter(models.Role.name == role_name).first():
                db.add(models.Role(name=role_name))
        db.commit()
        print("Roles seeded.")

        # Create Admin User
        admin_role = db.query(models.Role).filter(models.Role.name == 'admin').first()
        hashed_pwd = get_simple_hash('admin123')
        admin_user = models.User(
            username='admin',
            password_hash=hashed_pwd,
            role_id=admin_role.id,
            is_initial_password=False
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created (username: admin, password: admin123)")

        csv_path = r"c:\Users\devel\automation\60members.csv"
        student_role = db.query(models.Role).filter(models.Role.name == 'student').first()

        count = 0
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                roll_no = row['Roll No'].strip()
                name = row['Name'].strip()
                email = row['Email address'].strip()
                dob_raw = row['Date Of Birth'].strip() # format: DD/MM/YYYY
                
                parts = dob_raw.split('/')
                if len(parts) == 3:
                    day, month, year = parts
                    dob_db = f"{year}-{month}-{day}"
                    password_plain = f"{day.zfill(2)}{month.zfill(2)}{year}"
                else:
                    # fallback
                    dob_db = '2000-01-01'
                    password_plain = '01012000'

                hashed_pwd = get_simple_hash(password_plain)
                
                stu_user = models.User(
                    username=roll_no,
                    password_hash=hashed_pwd,
                    role_id=student_role.id,
                    is_initial_password=True
                )
                db.add(stu_user)
                db.commit()
                
                student = models.Student(
                    id=stu_user.id,
                    roll_no=roll_no,
                    name=name,
                    dob=dob_db,
                    email=email,
                    batch='2025-2027'
                )
                db.add(student)
                count += 1
                
        db.commit()
        print(f"Successfully seeded {count} students from CSV.")

        # Automatic GPA Calculation (via snapshot sync)
        print("\nStarting automatic GPA calculation (syncing snapshots)...")
        from app.scraper import PortalScraper
        scraper = PortalScraper()
        result = scraper.import_all_snapshots(db)
        print(f"Successfully synced {result['imported_count']} student snapshots.")
        if result['error_count'] > 0:
            print(f"Encountered {result['error_count']} errors during snapshot sync.")

    except Exception as e:
        print(f"Error seeding CSV: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
