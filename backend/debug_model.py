import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent))

from app import models

print("FacultySubjectAssignment columns:")
print(dir(models.FacultySubjectAssignment))

from sqlalchemy.inspection import inspect
inst = inspect(models.FacultySubjectAssignment)
print("Mapped columns:")
for c in inst.mapper.column_attrs:
    print(c.key)
