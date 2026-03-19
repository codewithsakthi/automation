from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
start=text.find('studentRiskOnly')-80
print(text[start:start+260])
