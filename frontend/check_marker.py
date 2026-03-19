from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
marker = '<div className="grid gap-3">'
print(marker in text)
print(text.find(marker))
