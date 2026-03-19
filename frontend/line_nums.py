from pathlib import Path
raw = Path('src/pages/AdminDashboard.tsx').read_bytes()
text = raw.decode('utf-8', errors='replace')
lines = text.splitlines()
start = len(lines) - 220
for i, line in enumerate(lines[start:], start+1):
    if 2150 <= i <= 2285:
        print(f"{i:04d}: {line}")
