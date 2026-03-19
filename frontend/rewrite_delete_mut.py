from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text()
start = text.find('const deleteStaffMutation = useMutation({')
end = text.find('});', start)
if start==-1 or end==-1:
    raise SystemExit('not found')
new_block = """  const deleteStaffMutation = useMutation({
    mutationFn: async (id: number) => api.delete(dmin/staff/),
    onError: (error: any) => {
      const status = error?.response?.status;
      if (status == 405) {
        alert('Delete is not allowed by the server (405). Please remove this user manually in the backend.');
      }
    },
    onSuccess: (_data, id) => {
      if (editingStaff?.id === id) {
        setEditingStaff(null);
        setStaffForm({ username: '', name: '', email: '', department: '', password: '' });
      }
      refetchStaff();
    },
  });
"""
text = text[:start] + new_block + text[end+3:]
Path('src/pages/AdminDashboard.tsx').write_text(text)
