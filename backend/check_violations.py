import asyncio
import json
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT COUNT(*) FROM student_marks"))
        count = res.scalar()
        
        output = {
            "total_count": count,
            "violations": [],
            "samples": []
        }
        
        if count > 0:
            res = await db.execute(text("SELECT * FROM student_marks WHERE cit1_marks < 0 OR cit1_marks > 30 OR cit2_marks < 0 OR cit2_marks > 30 OR cit3_marks < 0 OR cit3_marks > 30 OR semester_exam_marks < 0 OR semester_exam_marks > 100 LIMIT 50"))
            violations = res.mappings().all()
            output["violations"] = [dict(v) for v in violations]
            
            res = await db.execute(text("SELECT * FROM student_marks LIMIT 10"))
            samples = res.mappings().all()
            output["samples"] = [dict(s) for s in samples]

        with open("violations.json", "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, default=str)
    print("Done writing violations.json")

if __name__ == "__main__":
    asyncio.run(check())
