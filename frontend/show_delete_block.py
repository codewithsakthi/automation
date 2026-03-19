from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
start=None
for i,l in enumerate(text):
    if 'deleteStaffMutation' in l:
        start=i
        break
for l in text[start:start+12]:
    print(repr(l))
