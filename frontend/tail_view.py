from pathlib import Path
lines=Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
for j in range(8056,8130):
    print(f"{j+1:04d}: {lines[j]}")
