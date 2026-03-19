from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
lines=text.splitlines()
for i,line in enumerate(lines):
    if '{activeTab === \'Staff\'' in line:
        start=i
        break
print('start', start+1)
for j in range(start, start+80):
    print(f"{j+1:04d}: {lines[j]}")
