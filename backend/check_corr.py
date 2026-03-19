
import asyncio
import os
from sqlalchemy import text
from app.core.database import engine

async def check_corr():
    async with engine.connect() as conn:
        try:
            # Check if corr exists
            res = await conn.execute(text("SELECT corr(1.0::float, 1.0::float)"))
            print("corr(1.0, 1.0) works:", res.scalar())
        except Exception as e:
            print("corr(1.0, 1.0) FAILED:", e)

        try:
            # Check with window function
            res = await conn.execute(text("SELECT corr(x, y) OVER() FROM (SELECT 1.0::float as x, 2.0::float as y) t"))
            print("corr(x, y) OVER() works:", res.scalar())
        except Exception as e:
            print("corr(x, y) OVER() FAILED:", e)

        try:
            # Check roles
            res = await conn.execute(text("SELECT current_user, current_setting('search_path')"))
            print("Context:", res.fetchone())
        except Exception as e:
            print("Context check FAILED:", e)

if __name__ == "__main__":
    asyncio.run(check_corr())
