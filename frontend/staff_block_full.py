from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
lines=text.splitlines()
start=3899
for j in range(start, start+200):
    print(f"{j+1:04d}: {lines[j]}")
