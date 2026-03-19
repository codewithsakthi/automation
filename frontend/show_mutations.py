from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
start=text.find('const createStaffMutation')
print(text[start:start+260])
