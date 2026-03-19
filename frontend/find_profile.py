from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
print(text.count('Profile Modal'))
start=text.find('Profile Modal')
print(start)
print(text[start-40:start+40])
