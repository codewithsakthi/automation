import asyncio
import logging
from sqlalchemy import select
from app.core.database import engine, Base, AsyncSessionLocal
from app import models
from app.services.scraper import PortalScraper
from app.core import auth

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def restore_database():
    logger.info("Initializing database restoration...")
    
    # 1. Recreate all tables
    async with engine.begin() as conn:
        logger.info("Dropping existing tables (if any)...")
        # In a real sync engine we might use drop_all, but for async we can use run_sync
        await conn.run_sync(Base.metadata.drop_all)
        logger.info("Creating all tables from models...")
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as db:
        try:
            # 2. Seed Roles
            logger.info("Seeding roles...")
            roles = ['admin', 'staff', 'student']
            for role_name in roles:
                result = await db.execute(select(models.Role).filter(models.Role.name == role_name))
                if not result.scalars().first():
                    db.add(models.Role(name=role_name))
            await db.commit()
            
            # 3. Seed MCA Program (required for many records)
            logger.info("Seeding MCA Program...")
            result = await db.execute(select(models.Program).filter(models.Program.code == 'MCA'))
            if not result.scalars().first():
                db.add(models.Program(code='MCA', name='Master of Computer Applications'))
            await db.commit()

            # 4. Create Admin User
            logger.info("Creating admin user...")
            result = await db.execute(select(models.Role).filter(models.Role.name == 'admin'))
            admin_role = result.scalars().first()
            
            result = await db.execute(select(models.User).filter(models.User.username == 'admin'))
            if not result.scalars().first():
                admin_user = models.User(
                    username='admin',
                    password_hash=auth.get_password_hash('admin123'),
                    role_id=admin_role.id,
                    is_initial_password=False
                )
                db.add(admin_user)
                await db.commit()
                logger.info("Admin user created (username: admin, password: admin123)")

            # 5. Import all student snapshots from data folder
            logger.info("Importing student snapshots from data/ directory...")
            scraper = PortalScraper()
            result = await scraper.import_all_snapshots(db)
            
            logger.info(f"Imported {result['imported_count']} students.")
            if result['error_count'] > 0:
                logger.warning(f"Encountered {result['error_count']} errors during import.")
                for err in result['errors']:
                    logger.error(f"Error in {err['file_name']}: {err['error']}")
            
            await db.commit()
            logger.info("Database restoration complete!")

        except Exception as e:
            logger.error(f"Restoration failed: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(restore_database())
