import csv
import asyncio
import logging
import sys
import os
from datetime import datetime
from pathlib import Path
from sqlalchemy import text, select

# Add parent directory to sys.path to allow imports from 'app'
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from app.core.database import AsyncSessionLocal, engine, Base
from app import models
from app.core import auth
from app.services.scraper import PortalScraper

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_db():
    logger.info("Resetting remote database...")
    try:
        async with engine.begin() as conn:
            # We use drop_all instead of manual DROP TABLEs for safety and consistency with models
            logger.info("Dropping all existing tables...")
            await conn.run_sync(Base.metadata.drop_all)
            logger.info("Re-creating tables from models...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Successfully reset DB.")
    except Exception as e:
        logger.error(f"Error resetting DB: {e}")
        return

    async with AsyncSessionLocal() as db:
        try:
            # 1. Seed Roles
            logger.info("Seeding roles...")
            roles = ['admin', 'staff', 'student']
            for role_name in roles:
                result = await db.execute(select(models.Role).filter(models.Role.name == role_name))
                if not result.scalars().first():
                    db.add(models.Role(name=role_name))
            await db.commit()
            
            # 2. Seed MCA Program (usually required)
            logger.info("Seeding MCA Program...")
            result = await db.execute(select(models.Program).filter(models.Program.code == 'MCA'))
            if not result.scalars().first():
                db.add(models.Program(code='MCA', name='Master of Computer Applications'))
            await db.commit()

            # 3. Create Admin User
            logger.info("Creating admin user...")
            result = await db.execute(select(models.Role).filter(models.Role.name == 'admin'))
            admin_role = result.scalars().first()
            
            hashed_pwd = auth.get_password_hash('admin123')
            admin_user = models.User(
                username='admin',
                password_hash=hashed_pwd,
                role_id=admin_role.id,
                is_initial_password=False
            )
            db.add(admin_user)
            await db.commit()
            logger.info("Admin user created (username: admin, password: admin123)")

            # 4. Read Students from CSV and fetch RegNo from snapshots
            import json
            csv_path = r"c:\Users\devel\automation\2025-2027.csv"
            snapshots_dir = r"c:\Users\devel\automation\data"
            
            result = await db.execute(select(models.Role).filter(models.Role.name == 'student'))
            student_role = result.scalars().first()

            if not os.path.exists(csv_path):
                logger.error(f"CSV file not found at: {csv_path}")
                return

            students_data = []
            logger.info(f"Reading students from {csv_path} and enrichment from {snapshots_dir}...")
            
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    roll_no = row['Roll No'].strip()
                    name = row['Name'].strip()
                    email = row['Email address'].strip()
                    dob_raw = row['Date Of Birth'].strip()
                    
                    # Fetch RegNo from snapshot
                    reg_no = None
                    snapshot_path = os.path.join(snapshots_dir, f"{roll_no}_data.json")
                    if os.path.exists(snapshot_path):
                        try:
                            with open(snapshot_path, 'r') as sf:
                                sdata = json.load(sf)
                                reg_no = sdata.get('ParentPortal', {}).get('Info', {}).get('RegNo')
                        except Exception as e:
                            logger.warning(f"Could not read snapshot for {roll_no}: {e}")
                    
                    students_data.append({
                        'roll_no': roll_no,
                        'name': name,
                        'email': email,
                        'dob_raw': dob_raw,
                        'reg_no': reg_no or f"9999{roll_no}" # Fallback
                    })

            # Sort by RegNo
            students_data.sort(key=lambda x: str(x['reg_no']))
            n = len(students_data)
            half = (n + 1) // 2 # Use ceiling for first half if odd
            
            logger.info(f"Partitioning {n} students: first {half} to Section A, rest to Section B.")
            
            count = 0
            for i, data in enumerate(students_data):
                section = 'A' if i < half else 'B'
                
                parts = data['dob_raw'].split('/')
                if len(parts) == 3:
                    day, month, year = parts
                    dob_db = f"{year}-{month}-{day}"
                    password_plain = f"{day.zfill(2)}{month.zfill(2)}{year}"
                else:
                    dob_db = '2000-01-01'
                    password_plain = '01012000'

                hashed_pwd = auth.get_password_hash(password_plain)
                
                stu_user = models.User(
                    username=data['roll_no'],
                    password_hash=hashed_pwd,
                    role_id=student_role.id,
                    is_initial_password=True
                )
                db.add(stu_user)
                await db.flush()
                
                student = models.Student(
                    id=stu_user.id,
                    roll_no=data['roll_no'],
                    reg_no=data['reg_no'],
                    name=data['name'],
                    dob=datetime.strptime(dob_db, "%Y-%m-%d").date(),
                    email=data['email'],
                    batch='2025-2027',
                    section=section,
                    current_semester=1
                )
                db.add(student)
                count += 1
            
            await db.commit()
            logger.info(f"Successfully seeded {count} students with sections assigned.")

            # 5. Optional: Automatic GPA Calculation / Sync snapshots
            logger.info("Starting snapshot sync for GPA calculation...")
            scraper = PortalScraper()
            # Note: PortalScraper.import_all_snapshots is async
            sync_result = await scraper.import_all_snapshots(db)
            logger.info(f"Successfully synced {sync_result['imported_count']} student snapshots.")
            if sync_result['error_count'] > 0:
                logger.warning(f"Encountered {sync_result['error_count']} errors during sync.")

        except Exception as e:
            logger.error(f"Error during seeding: {e}")
            await db.rollback()
            raise
    
    logger.info("Seeding process completed!")

if __name__ == "__main__":
    asyncio.run(seed_db())
