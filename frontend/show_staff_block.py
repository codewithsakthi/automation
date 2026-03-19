from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
lines = text.splitlines()
for i in range(2120,2285):
    print(f"{i+1:04d}: {lines[i]}")
