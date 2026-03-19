from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
needle = '<div className="grid gap-3">'
idx = -1
positions = []
while True:
    idx = text.find(needle, idx+1)
    if idx == -1:
        break
    positions.append(idx)
print(positions)
