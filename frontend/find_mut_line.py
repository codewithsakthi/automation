from pathlib import Path
for line in Path('src/pages/AdminDashboard.tsx').read_text().splitlines():
    if 'mutationFn' in line and 'admin/staff' in line:
        print(repr(line))
