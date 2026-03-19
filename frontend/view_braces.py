from pathlib import Path
lines=Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
for i in range(1470,1505):
    print(f"{i+1}: {lines[i]}")
