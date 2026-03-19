from pathlib import Path
lines=Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
for j in range(7800, 8080):
    print(f"{j+1:04d}: {lines[j]}")
