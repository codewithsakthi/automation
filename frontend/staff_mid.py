from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
lines=text.splitlines()
for j in range(4200,4400):
    print(f"{j+1:04d}: {lines[j]}")
