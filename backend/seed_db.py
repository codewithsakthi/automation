import hashlib
from app.database import SessionLocal, engine, Base
from app import models
from sqlalchemy import text

def get_simple_hash(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def seed_db():
    print("Seeding database (Simple Hash)...")
    db = SessionLocal()
    try:
        # Re-create tables
        Base.metadata.create_all(bind=engine)
        print("Tables re-created.")

        # Seed Roles
        roles = ['admin', 'staff', 'student']
        for role_name in roles:
            if not db.query(models.Role).filter(models.Role.name == role_name).first():
                db.add(models.Role(name=role_name))
        db.commit()
        print("Roles seeded.")

        # Create Admin User
        admin_role = db.query(models.Role).filter(models.Role.name == 'admin').first()
        if not db.query(models.User).filter(models.User.username == 'admin').first():
            # Use SHA256 for initial seed if bcrypt fails
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

        # Create Test Student
        student_role = db.query(models.Role).filter(models.Role.name == 'student').first()
        if not db.query(models.User).filter(models.User.username == '248307').first():
            hashed_pwd = get_simple_hash('15032004') # DOB as password
            stu_user = models.User(
                username='248307',
                password_hash=hashed_pwd,
                role_id=student_role.id,
                is_initial_password=True
            )
            db.add(stu_user)
            db.commit()
            
            student = models.Student(
                id=stu_user.id,
                roll_no='248307',
                name='Kaviya G',
                dob='2004-03-15',
                batch='2024-2026'
            )
            db.add(student)
            db.commit()
            print("Test Student created (username: 248307, password: DOB)")

    except Exception as e:
        print(f"Error seeding DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
