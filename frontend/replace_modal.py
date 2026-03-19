from pathlib import Path
path=Path('src/pages/AdminDashboard.tsx')
text=path.read_text()
old="""      {/* Profile Modal */}      {/* Profile Modal */}

      {staffToDelete && (
"""
new="""      {staffModalOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-[min(520px,90vw)] rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{editingStaff ? 'Edit Staff' : 'Add Staff'}</p>
                <p className="text-sm text-muted-foreground">Create or update staff login and profile.</p>
              </div>
              <button
                aria-label="Close"
                className="tab-chip"
                onClick={() => {
                  setStaffModalOpen(false);
                  setEditingStaff(null);
                  setStaffForm({ username: '', name: '', email: '', department: '', password: '' });
                }}
              >
                Close
              </button>
            </div>

            <div className="grid gap-3">
              {!editingStaff && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Username</p>
                  <input
                    className="input-field w-full"
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    placeholder="e.g., staff01"
                  />
                </div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</p>
                <input
                  className="input-field w-full"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</p>
                <input
                  className="input-field w-full"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="name@college.edu"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</p>
                  <input
                    className="input-field w-full"
                    value={staffForm.department}
                    onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                    placeholder="MCA"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</p>
                  <input
                    type="password"
                    className="input-field w-full"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder={editingStaff ? 'Leave blank to keep' : 'Set initial password'}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="tab-chip"
                onClick={() => {
                  setStaffModalOpen(false);
                  setEditingStaff(null);
                  setStaffForm({ username: '', name: '', email: '', department: '', password: '' });
                }}
                disabled={createStaffMutation.isPending || updateStaffMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleStaffSubmit}
                className="btn-primary inline-flex items-center gap-2"
                disabled={createStaffMutation.isPending || updateStaffMutation.isPending}
              >
                {editingStaff ? <Edit3 size={16} /> : <Plus size={16} />}
                {editingStaff ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}

      {staffToDelete && (
"""
if old not in text:
    raise SystemExit('pattern not found')
path.write_text(text.replace(old,new,1))
