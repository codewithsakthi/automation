from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8', errors='replace')
lines = text.splitlines()
for i in range(2100,2150):
    print(f"{i+1:04d}: {lines[i]}")
