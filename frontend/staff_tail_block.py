from pathlib import Path
lines=Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8').splitlines()
for j in range(4400,4485):
    print(f"{j+1:04d}: {lines[j]}")
