from pathlib import Path
lines = Path('src/pages/AdminDashboard.tsx').read_text().splitlines()
new_block = [
"    mutationFn: async (id: number) => api.delete(dmin/staff/),",
"    onError: (error: any) => {",
"      const status = error?.response?.status;",
"      if (status == 405) {",
"        alert('Delete is not allowed by the server (405). Please remove this user manually in the backend.');",
"      }",
"    },"
]
out=[]
replaced=False
for line in lines:
    if 'mutationFn: async (id: number) => api.delete(dmin/staff/),' in line.replace('"'"'Mutation'"'"','"'"'mutation'"'"') and not replaced:
        indent = line[:len(line)-len(line.lstrip())]
        out.extend([indent + l for l in new_block])
        replaced=True
    else:
        out.append(line)
Path('src/pages/AdminDashboard.tsx').write_text('\n'.join(out))
print('replaced', replaced)
