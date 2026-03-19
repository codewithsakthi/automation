from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
start=text.find('staffModalOpen')-40
print(text[start:start+120])
