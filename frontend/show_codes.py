from pathlib import Path
for line in Path('src/pages/AdminDashboard.tsx').read_text().splitlines():
    if 'admin/staff/' in line:
        print([ord(c) for c in line])
