from pathlib import Path
lines = Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
target = "mutationFn: async (id: number) => api.delete(dmin/staff/),"
for i,line in enumerate(lines):
    if line.strip()==target:
        print('match', i, repr(line))
