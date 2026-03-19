from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
start = text.find('<div className="grid gap-3">')
end = text.find('          </article>', start)
print(start, end)
Path('tmp_positions.txt').write_text(text[start:end], encoding='utf-8')
