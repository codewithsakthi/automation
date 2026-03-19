from pathlib import Path
lines=Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
for j in range(len(lines)-30, len(lines)):
    print(f"{j+1:04d}: {lines[j]}")
