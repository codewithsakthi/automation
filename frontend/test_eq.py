from pathlib import Path
line = '    mutationFn: async (id: number) => api.delete(dmin/staff/),'
target = "mutationFn: async (id: number) => api.delete(dmin/staff/),"
print(line.strip()==target)
