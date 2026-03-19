from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
lines = text.splitlines()
for i,line in enumerate(lines):
    if "activeTab === 'Staff'" in line:
        start=i
        break
else:
    start=None
print('start', start+1 if start is not None else 'n/a')
for j in range(start, start+120):
    print(f"{j+1:04d}: {lines[j]}")
