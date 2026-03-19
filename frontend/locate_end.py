from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
start = text.find('<div className="grid gap-3">', 52000)
end = text.find('            </div>\n          </article>', start)
print('start', start, 'end', end)
