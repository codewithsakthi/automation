from pathlib import Path
lines=Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
for j in range(8130,8205):
    print(f"{j+1:04d}: {lines[j]}")
