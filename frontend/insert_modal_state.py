from pathlib import Path
text=Path('src/pages/AdminDashboard.tsx').read_text()
needle='  const [staffToDelete, setStaffToDelete] = useState<StaffProfile | null>(null);\n\n'
if needle in text:
    text=text.replace(needle, needle + '  const [staffModalOpen, setStaffModalOpen] = useState(false);\n\n',1)
else:
    raise SystemExit('needle not found')
Path('src/pages/AdminDashboard.tsx').write_text(text)
