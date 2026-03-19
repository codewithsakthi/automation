from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text()
start = text.find('  const deleteStaffMutation')
if start==-1:
    raise SystemExit('start not found')
end_good = text.find('  });', start)
if end_good==-1:
    raise SystemExit('end_good not found')
end_good += len('  });')
end_bad = text.find('  });', end_good)
if end_bad!=-1:
    text = text[:end_good] + text[end_bad+len('  });'):]
Path('src/pages/AdminDashboard.tsx').write_text(text)
print('trimmed', end_bad!=-1)
