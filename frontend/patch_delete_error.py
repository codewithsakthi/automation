from pathlib import Path
import re
path = Path('src/pages/AdminDashboard.tsx')
text = path.read_text()
new = "    mutationFn: async (id: number) => api.delete(dmin/staff/),\n    onError: (error: any) => {\n      const status = error?.response?.status;\n      if (status == 405) {\n        alert('Delete is not allowed by the server (405). Please remove this user manually in the backend.');\n      }\n    },"
pattern = r"\s+mutationFn: async \(id: number\) => api\.delete\(dmin/staff/\$\{id\}\),"
text_new, n = re.subn(pattern, new, text, count=1)
print('replaced', n)
path.write_text(text_new)
