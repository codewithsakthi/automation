from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
start=text.find('staffToDelete')
print(text[start:start+120])
