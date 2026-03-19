from pathlib import Path
text = Path('src/pages/AdminDashboard.tsx').read_text()
start = text.find("      {activeTab === 'Staff' && (")
end = text.find("      {/* Profile Modal */}", start)
if start == -1 or end == -1:
    raise SystemExit('markers not found')
new_block = """      {activeTab === 'Staff' && (
        <div className=\"space-y-4\">
          <div className=\"flex flex-wrap items-center justify-between gap-3\">
            <div>
              <p className=\"text-lg font-semibold text-foreground\">Staff</p>
              <p className=\"text-sm text-muted-foreground\">Manage faculty access and profiles.</p>
            </div>
            <div className=\"flex flex-wrap items-center gap-2\">
              <input
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className=\"input-field !py-2 w-56\"
                placeholder=\"Search name, username, dept\"
              />
              <button
                className=\"btn-primary inline-flex items-center gap-2\"
                onClick={() => {
                  setEditingStaff(null);
                  setStaffForm({ username: '', name: '', email: '', department: '', password: '' });
                  setStaffModalOpen(true);
                }}
              >
                <Plus size={16} />
                Add Staff
              </button>
            </div>
          </div>

          <article className=\"panel space-y-3\">
            <div className=\"overflow-x-auto rounded-2xl border border-border/60 bg-card/60\">
              <table className=\"w-full text-sm\">
                <thead className=\"bg-muted/40 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground\">
                  <tr>
                    <th className=\"px-4 py-3 text-left\">Staff</th>
                    <th className=\"px-4 py-3 text-left\">Username / Dept</th>
                    <th className=\"px-4 py-3 text-left\">Email</th>
                    <th className=\"px-4 py-3 text-left\">Subjects</th>
                    <th className=\"px-4 py-3 text-left\">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredStaff || []).map((s) => {
                    const impact = staffImpact.find((i) => i.faculty_id === s.id || i.faculty_name.toLowerCase() === (s.name || '').toLowerCase());
                    return (
                      <tr key={s.id} className=\"border-t border-border/40 hover:bg-muted/30 transition-colors\">
                        <td className=\"px-4 py-3\">
                          <div className=\"flex items-center gap-3\">
                            <div className=\"h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold\">
                              {s.name?.slice(0, 1) || s.username.slice(0, 1)}
                            </div>
                            <div>
                              <p className=\"font-semibold text-foreground\">{s.name || '—'}</p>
                              <p className=\"text-[11px] text-muted-foreground\">ID: {s.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className=\"px-4 py-3 text-muted-foreground\">
                          <div className=\"font-mono text-xs text-foreground\">{s.username}</div>
                          <div className=\"text-xs\">{s.department || 'Dept NA'}</div>
                        </td>
                        <td className=\"px-4 py-3 text-xs text-muted-foreground\">
                          {s.email || 'No email'}
                        </td>
                        <td className=\"px-4 py-3 text-xs text-muted-foreground\">
                          {impact?.subjects?.length ? (
                            <div className=\"flex flex-wrap gap-1\">
                              {impact.subjects.slice(0, 3).map((sub) => (
                                <span key={sub.subject_code} className=\"px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold\">
                                  {sub.subject_code}
                                </span>
                              ))}
                              {impact.subjects.length > 3 && <span className=\"text-[10px] text-foreground\">+{impact.subjects.length - 3}</span>}
                            </div>
                          ) : (
                            <span className=\"text-[11px]\">No subjects</span>
                          )}
                        </td>
                        <td className=\"px-4 py-3\">
                          <div className=\"flex flex-wrap gap-2\">
                            <button
                              className=\"tab-chip\"
                              onClick={() => {
                                setEditingStaff(s);
                                setStaffForm({
                                  username: s.username,
                                  name: s.name,
                                  email: s.email || '',
                                  department: s.department || '',
                                  password: '',
                                });
                                setStaffModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className=\"tab-chip !bg-rose-500/10 !text-rose-600 hover:!bg-rose-500/20\"
                              onClick={() => setStaffToDelete(s)}
                              disabled={deleteStaffMutation.isPending}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {loadingStaff && (
                    <tr>
                      <td className=\"px-4 py-4 text-sm text-muted-foreground\" colSpan={5}>
                        Loading staff...
                      </td>
                    </tr>
                  )}
                  {!loadingStaff && filteredStaff.length === 0 && (
                    <tr>
                      <td className=\"px-4 py-4 text-sm text-muted-foreground\" colSpan={5}>
                        No staff match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {/* Profile Modal */}"""
text = text[:start] + new_block + text[end:]
Path('src/pages/AdminDashboard.tsx').write_text(text)
