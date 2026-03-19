import asyncio
import logging
from app.core.database import AsyncSessionLocal
from app.services import enterprise_analytics
from app.services.scraper import PortalScraper
from app.core.constants import CURRICULUM_CREDITS

async def debug():
    logging.basicConfig(level=logging.INFO)
    async with AsyncSessionLocal() as db:
        # TESTING WITH THE CORRECT FLAT CONSTANT
        curriculum_credits = CURRICULUM_CREDITS
        
        print("Testing get_subject_leaderboard for 24AC107...")
        try:
            res = await enterprise_analytics.get_subject_leaderboard(
                db, 
                curriculum_credits, 
                subject_code='24AC107', 
                limit=10, 
                offset=0
            )
            print("Success!")
        except Exception as e:
            msg = getattr(e, 'orig', str(e))
            print(f"ERROR_START\n{msg}\nERROR_END")

        print("\nTesting get_student_360 for 258001...")
        try:
            res = await enterprise_analytics.get_student_360(
                db, 
                curriculum_credits, 
                roll_no='258001'
            )
            print("Success!")
        except Exception as e:
            msg = getattr(e, 'orig', str(e))
            print(f"ERROR_START\n{msg}\nERROR_END")

if __name__ == "__main__":
    asyncio.run(debug())
