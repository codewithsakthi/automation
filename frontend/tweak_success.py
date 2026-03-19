from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text()
text = text.replace('setEditingStaff(null);\n\n      refetchStaff();','setEditingStaff(null);\n\n      setStaffModalOpen(false);\n\n      refetchStaff();',1)
text = text.replace('setEditingStaff(null);\n\n      refetchStaff();','setEditingStaff(null);\n\n      setStaffModalOpen(false);\n\n      refetchStaff();',1)
Path('src/pages/AdminDashboard.tsx').write_text(text)
