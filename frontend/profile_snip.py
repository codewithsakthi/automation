from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
start=text.find('{/* Profile Modal */}')
print(text[start-120:start+80])
