import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  Copy,
  Download,
  GraduationCap,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';

const API_BASE = 'https://sparkbackendvercel.app';
const GRADE_POINTS = { O: 10, S: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, D: 4, E: 3, PASS: 5, P: 5, FAIL: 0, F: 0, U: 0, W: 0, I: 0, AB: 0 };
const CHART_COLORS = ['#38bdf8', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#f97316'];

const fmt = (value, fallback = '-') => (value === null || value === undefined || value === '' ? fallback : value);
const num = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');
const toCsvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const EmptyState = ({ text }) => <div className="empty-note">{text}</div>;

const SectionTitle = ({ eyebrow, title, copy }) => (
  <div className="section-header">
    <span className="eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    <p>{copy}</p>
  </div>
);

const SortHeader = ({ label, field, currentSort, currentDir, onSort }) => {
  const isActive = currentSort === field;
  return (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {label}
        {isActive ? (
          currentDir === 'asc' ? <ArrowUp size={14} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={14} style={{ color: 'var(--primary)' }} />
        ) : (
          <ArrowUpDown size={14} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
        )}
      </div>
    </th>
  );
};

const DetailField = ({ icon: Icon, label, value, emphasis = false }) => (
  <div className={`detail-field ${emphasis ? 'detail-field-emphasis' : ''}`}>
    <div className="detail-label">{Icon ? <Icon size={14} /> : null}<span>{label}</span></div>
    <div className="detail-value">{fmt(value)}</div>
  </div>
);

const ChartCard = ({ title, copy, height = 260, data, children }) => (
  <div className="record-panel">
    <SectionTitle title={title} copy={copy} />
    <div style={{ height }}>
      {data?.length ? children : <EmptyState text="Not enough data to draw this chart yet." />}
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="kpi-card-rich glass-panel">
    <div className="icon-bg" style={{ background: `${accent}20`, color: accent }}><Icon size={22} /></div>
    <div className="data">
      <span className="label">{label}</span>
      <strong className="value">{value}</strong>
    </div>
  </div>
);

const buildStudentAnalytics = (record) => {
  const semesterGrades = record?.semester_grades || [];
  const semesterBuckets = semesterGrades.reduce((acc, item) => {
    const semester = item.semester || 0;
    acc[semester] = acc[semester] || { grades: [], internals: [], backlogCount: 0 };
    if (item.grade) acc[semester].grades.push(GRADE_POINTS[item.grade] ?? 0);
    if (item.internal_marks !== null && item.internal_marks !== undefined) acc[semester].internals.push(Number(item.internal_marks));
    if (['U', 'FAIL', 'F', 'AB', 'W', 'I'].includes(String(item.grade || '').toUpperCase())) acc[semester].backlogCount += 1;
    return acc;
  }, {});

  return Object.entries(semesterBuckets).map(([semester, values]) => ({
    semester: `Sem ${semester}`,
    averageGradePoints: values.grades.length ? Number((values.grades.reduce((sum, value) => sum + value, 0) / values.grades.length).toFixed(2)) : 0,
    averageInternal: values.internals.length ? Number((values.internals.reduce((sum, value) => sum + value, 0) / values.internals.length).toFixed(2)) : 0,
    backlogs: values.backlogCount,
  }));
};

const buildAssessmentSummary = (record) => {
  const grouped = (record?.internal_marks || []).reduce((acc, item) => {
    const key = item.test_number || 'NA';
    acc[key] = acc[key] || { total: 0, count: 0 };
    acc[key].total += Number(item.percentage || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  return Object.entries(grouped).map(([testNumber, values]) => ({
    test: `Test ${testNumber}`,
    average: values.count ? Number((values.total / values.count).toFixed(2)) : 0,
    subjects: values.count,
  }));
};

const buildGradeDistribution = (record) => {
  const counts = (record?.semester_grades || []).reduce((acc, item) => {
    const grade = item.grade || 'NA';
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
};

const buildRecordHighlights = (record) => {
  const semesterGrades = record?.semester_grades || [];
  const internalMarks = record?.internal_marks || [];
  const counselorDiary = record?.counselor_diary || [];
  const bestSubject = semesterGrades.reduce((best, current) => {
    const currentPoint = Number(current.grade_point ?? GRADE_POINTS[current.grade] ?? -1);
    const bestPoint = Number(best?.grade_point ?? GRADE_POINTS[best?.grade] ?? -1);
    return currentPoint > bestPoint ? current : best;
  }, null);
  const supportNeed = internalMarks.reduce((lowest, current) => {
    const currentValue = Number(current.percentage ?? 999);
    const lowestValue = Number(lowest?.percentage ?? 999);
    return currentValue < lowestValue ? current : lowest;
  }, null);
  return {
    bestSubject,
    supportNeed,
    latestNote: counselorDiary[0] || null,
    backlogCount: semesterGrades.filter((item) => ['U', 'FAIL', 'F', 'AB', 'W', 'I'].includes(String(item.grade || '').toUpperCase())).length,
  };
};

function AdminDashboard({ user, onLogout, onUserUpdate }) {
  const [activeView, setActiveView] = useState('overview');
  const [bootLoading, setBootLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({ import: false, sync: false });
  const [error, setError] = useState('');
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [adminProfile, setAdminProfile] = useState(user);
  const [overview, setOverview] = useState(null);
  const [insights, setInsights] = useState(null);
  const [workspaceAnalytics, setWorkspaceAnalytics] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [filters, setFilters] = useState({
    city: 'ALL',
    batch: 'ALL',
    semester: 'ALL',
    riskOnly: false,
    sortBy: 'roll_no',
    sortDir: 'asc',
  });
  const [selectedRoll, setSelectedRoll] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [studentCredentials, setStudentCredentials] = useState(null);
  const [recordFilters, setRecordFilters] = useState({ cit: 'ALL', semester: 'ALL', citSemester: 'ALL' });
  const [editingStudent, setEditingStudent] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isDeletingUrl, setIsDeletingUrl] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, [user]);

  const handleApiResponse = async (response, fallbackMessage) => {
    if (response.status === 401) {
      onLogout();
      throw new Error('Session expired. Please sign in again.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload?.detail === 'string' ? payload.detail : fallbackMessage);
    }
    return payload;
  };

  const loadChromeData = async (isInitial = false) => {
    if (isInitial) setBootLoading(true);
    setError('');
    try {
      const overviewUrl = filters.batch !== 'ALL' ? `${API_BASE}/admin/overview?batch=${encodeURIComponent(filters.batch)}` : `${API_BASE}/admin/overview`;
      const [overviewResp, insightsResp, analyticsResp, meResp] = await Promise.all([
        fetch(overviewUrl, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/directory-insights`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/analytics`, { headers: authHeaders }),
        fetch(`${API_BASE}/me`, { headers: authHeaders }),
      ]);
      const [overviewPayload, insightsPayload, analyticsPayload, mePayload] = await Promise.all([
        handleApiResponse(overviewResp, 'Failed to load overview'),
        handleApiResponse(insightsResp, 'Failed to load directory insights'),
        handleApiResponse(analyticsResp, 'Failed to load workspace analytics'),
        handleApiResponse(meResp, 'Failed to load admin profile'),
      ]);
      setOverview(overviewPayload);
      setInsights(insightsPayload);
      setWorkspaceAnalytics(analyticsPayload);
      setAdminProfile(mePayload);
      onUserUpdate(mePayload);
    } catch (err) {
      setError(err.message || 'Unable to load admin workspace.');
    } finally {
      setBootLoading(false);
    }
  };

  const loadDirectory = async () => {
    setDirectoryLoading(true);
    setError('');
    try {
      const queryObj = {
        search: deferredSearch,
        city: filters.city !== 'ALL' ? filters.city : '',
        batch: filters.batch !== 'ALL' ? filters.batch : '',
        risk_only: String(filters.riskOnly),
        sort_by: filters.sortBy,
        sort_dir: filters.sortDir,
        limit: '300',
      };
      if (filters.semester !== 'ALL') {
        queryObj.semester = String(filters.semester);
      }
      const query = new URLSearchParams(queryObj);
      const response = await fetch(`${API_BASE}/admin/students?${query.toString()}`, { headers: authHeaders });
      setDirectory(await handleApiResponse(response, 'Failed to load student directory'));
    } catch (err) {
      setError(err.message || 'Unable to load directory.');
    } finally {
      setDirectoryLoading(false);
    }
  };

  const loadStudentDrilldown = async (rollNo) => {
    setRecordLoading(true);
    setError('');
    try {
      const [recordResp, credentialResp] = await Promise.all([
        fetch(`${API_BASE}/admin/student-record/${rollNo}`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/student-credentials/${rollNo}`, { headers: authHeaders }),
      ]);
      const [recordPayload, credentialPayload] = await Promise.all([
        handleApiResponse(recordResp, 'Failed to load student record'),
        handleApiResponse(credentialResp, 'Failed to load student credentials'),
      ]);
      setStudentRecord(recordPayload);
      setStudentCredentials(credentialPayload);
      setSelectedRoll(rollNo);
      setActiveView('student-record');
    } catch (err) {
      setError(err.message || 'Unable to load student record.');
    } finally {
      setRecordLoading(false);
    }
  };

  const refreshWorkspace = async () => {
    await loadChromeData();
    if (activeView === 'directory') {
      await loadDirectory();
    }
    if (activeView === 'student-record' && selectedRoll) {
      await loadStudentDrilldown(selectedRoll);
    }
  };

  const handleImportSnapshots = async () => {
    setActionLoading((prev) => ({ ...prev, import: true }));
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/import-snapshots`, {
        method: 'POST',
        headers: authHeaders,
      });
      const payload = await handleApiResponse(response, 'Failed to import snapshot files');
      setWorkspaceMessage(`${payload.message} Default student password remains DOB in DDMMYYYY format.`);
      await refreshWorkspace();
    } catch (err) {
      setError(err.message || 'Unable to import snapshot files.');
    } finally {
      setActionLoading((prev) => ({ ...prev, import: false }));
    }
  };

  const handleSyncAll = async () => {
    setActionLoading((prev) => ({ ...prev, sync: true }));
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/sync/all`, {
        method: 'POST',
        headers: authHeaders,
      });
      const payload = await handleApiResponse(response, 'Failed to sync all students');
      setWorkspaceMessage(payload.message);
      await refreshWorkspace();
    } catch (err) {
      setError(err.message || 'Unable to sync all students.');
    } finally {
      setActionLoading((prev) => ({ ...prev, sync: false }));
    }
  };

  const exportDirectory = () => {
    if (!directory.length) return;
    const headers = ['rank', 'roll_no', 'reg_no', 'name', 'city', 'email', 'phone_primary', 'batch', 'current_semester', 'average_grade_points', 'attendance_percentage', 'backlogs'];
    const rows = directory.map((student) => headers.map((key) => toCsvValue(student[key])));
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'student-directory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyCredential = async () => {
    if (!studentCredentials) return;
    const lines = [
      `Roll No: ${studentCredentials.roll_no}`,
      `Username: ${studentCredentials.username}`,
      `Account: ${studentCredentials.has_account ? 'Provisioned' : 'Not provisioned'}`,
      `DOB: ${studentCredentials.dob_masked || '-'}`,
      `Initial Password: ${studentCredentials.initial_password_hint || 'Already changed or unavailable'}`,
      studentCredentials.note ? `Note: ${studentCredentials.note}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setWorkspaceMessage(`Copied credentials for ${studentCredentials.roll_no}.`);
    } catch {
      setWorkspaceMessage('Clipboard copy failed on this browser.');
    }
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    setActionInProgress(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/students/${selectedRoll}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(editFormData),
      });
      await handleApiResponse(response, 'Failed to update student');
      setWorkspaceMessage('Student updated successfully.');
      setEditingStudent(false);
      await loadStudentDrilldown(selectedRoll);
    } catch (err) {
      setError(err.message || 'Unable to update student.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteStudent = async () => {
    setActionInProgress(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/students/${selectedRoll}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      await handleApiResponse(response, 'Failed to delete student');
      setWorkspaceMessage('Student deleted successfully.');
      setIsDeletingUrl(false);
      setActiveView('directory');
    } catch (err) {
      setError(err.message || 'Unable to delete student.');
    } finally {
      setActionInProgress(false);
    }
  };

  const printProfile = () => {
    if (!studentRecord) return;
    window.print();
  };

  useEffect(() => {
    loadChromeData(true);
  }, []);

  useEffect(() => {
    if (activeView === 'overview') {
      loadChromeData(false);
    }
  }, [filters.batch, activeView]);

  useEffect(() => {
    if (activeView === 'overview') {
      loadChromeData(false);
    }
  }, [filters.batch, activeView]);

  useEffect(() => {
    if (activeView === 'directory') {
      loadDirectory();
    }
  }, [activeView, deferredSearch, filters.city, filters.batch, filters.semester, filters.riskOnly, filters.sortBy, filters.sortDir]);

  const directoryMeta = useMemo(() => ({
    avgAttendance: directory.length ? num(directory.reduce((sum, item) => sum + Number(item.attendance_percentage || 0), 0) / directory.length) : '0.00',
    avgGpa: directory.length ? num(directory.reduce((sum, item) => sum + Number(item.average_grade_points || 0), 0) / directory.length) : '0.00',
    withBacklogs: directory.filter((item) => item.backlogs > 0).length,
  }), [directory]);

  const studentSemTrend = useMemo(() => buildStudentAnalytics(studentRecord), [studentRecord]);
  const studentAssessments = useMemo(() => buildAssessmentSummary(studentRecord), [studentRecord]);
  const studentGradeDistribution = useMemo(() => buildGradeDistribution(studentRecord), [studentRecord]);
  const studentHighlights = useMemo(() => buildRecordHighlights(studentRecord), [studentRecord]);

  const cityChart = workspaceAnalytics?.city_distribution?.slice(0, 6) || [];
  const batchChart = workspaceAnalytics?.batch_distribution || [];
  const semesterChart = workspaceAnalytics?.semester_distribution || [];
  const attendanceBandChart = workspaceAnalytics?.attendance_bands || [];
  const gpaBandChart = workspaceAnalytics?.gpa_bands || [];

  if (bootLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="spinner" />
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="logo-box" style={{ background: 'var(--accent-gradient)', padding: '0.75rem', borderRadius: '16px' }}>
              <GraduationCap color="white" size={24} />
            </div>
            <div>
              <h2 style={{ color: 'white' }}>PortalCRM</h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Admin workspace</p>
            </div>
          </div>

          <nav className="admin-nav" style={{ marginTop: '2rem' }}>
            <button className={`admin-nav-item ${activeView === 'overview' ? 'active' : ''}`} onClick={() => setActiveView('overview')}>
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </button>
            <button className={`admin-nav-item ${activeView === 'directory' || activeView === 'student-record' ? 'active' : ''}`} onClick={() => setActiveView('directory')}>
              <Users size={18} />
              <span>Students</span>
            </button>
            <button className={`admin-nav-item ${activeView === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveView('intelligence')}>
              <Sparkles size={18} />
              <span>Intelligence</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="admin-profile-pill">
            <div className="avatar">{adminProfile?.name?.charAt(0) || 'A'}</div>
            <div className="info">
              <p className="name">{adminProfile?.name || 'Administrator'}</p>
              <p className="status">Admin</p>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-top-bar">
          <div className="breadcrumb">
            <Home size={15} />
            <span className="sep">/</span>
            <span className="current">
              {activeView === 'student-record'
                ? 'Student record'
                : activeView === 'intelligence'
                  ? 'Workspace intelligence'
                  : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
            </span>
          </div>
          <div className="top-bar-actions">
            {workspaceMessage ? <div className="system-msg"><Sparkles size={14} /> {workspaceMessage}</div> : null}
            <button className="icon-action" onClick={refreshWorkspace} title="Refresh workspace">
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        <section className="admin-pane scroll-y">
          {error ? (
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--danger)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <AlertTriangle size={18} color="var(--danger)" />
                  <span>{error}</span>
                </div>
                <button className="icon-action" onClick={() => setError('')}>Close</button>
              </div>
            </div>
          ) : null}

          {activeView === 'overview' && overview ? (
            <div className="overview-container">
              <div className="welcome-banner">
                <h1>Academic operations command center</h1>
                <p>Track student health, refresh synced records, and move from portfolio overview into full student context without leaving the workspace.</p>
                <div className="banner-ops">
                  <button className="btn-primary" onClick={handleImportSnapshots} disabled={actionLoading.import}>
                    {actionLoading.import ? <Loader2 className="spinner" size={16} /> : <Download size={16} />}
                    Import snapshots
                  </button>
                  <button className="btn-primary" onClick={handleSyncAll} disabled={actionLoading.sync} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)' }}>
                    {actionLoading.sync ? <Loader2 className="spinner" size={16} /> : <RefreshCw size={16} />}
                    Sync all students
                  </button>
                </div>
              </div>

              <div className="kpi-grid-modern">
                <StatCard icon={Users} label="Students" value={overview.total_students} accent="#6366f1" />
                <StatCard icon={AlertTriangle} label="Need attention" value={overview.students_needing_attention} accent="#ef4444" />
                <StatCard icon={TrendingUp} label="Avg GPA" value={num(overview.average_grade_points)} accent="#10b981" />
                <StatCard icon={CalendarDays} label="Avg attendance" value={`${num(overview.average_attendance)}%`} accent="#38bdf8" />
              </div>

              <div className="priority-split">
                <div className="priority-panel glass-panel">
                  <div className="panel-header">
                    <h3><ShieldCheck size={18} /> Top performers</h3>
                    <p>Students balancing grades and attendance strongly.</p>
                  </div>
                  <div className="priority-list">
                    {overview.top_performers.map((student) => (
                      <button key={student.roll_no} className="priority-item" onClick={() => loadStudentDrilldown(student.roll_no)}>
                        <div className="node-avatar">{student.name?.charAt(0) || '?'}</div>
                        <div className="node-main">
                          <strong>{student.name}</strong>
                          <span>{student.roll_no} | Sem {fmt(student.current_semester)}</span>
                        </div>
                        <div className="node-metric">
                          <span className="val">{num(student.average_grade_points)}</span>
                          <span className="lab">GPA</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="priority-panel glass-panel danger">
                  <div className="panel-header">
                    <h3><AlertTriangle size={18} /> Immediate follow-up</h3>
                    <p>Students with backlog or attendance pressure.</p>
                  </div>
                  <div className="priority-list">
                    {overview.attention_required.map((student) => (
                      <button key={student.roll_no} className="priority-item risk" onClick={() => loadStudentDrilldown(student.roll_no)}>
                        <div className="node-avatar">{student.name?.charAt(0) || '?'}</div>
                        <div className="node-main">
                          <strong>{student.name}</strong>
                          <span>{student.roll_no} | {fmt(student.batch)}</span>
                        </div>
                        <div className="node-metric">
                          <span className="val">{student.backlogs}</span>
                          <span className="lab">Backlogs</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="record-grid record-grid-middle">
                <ChartCard title="Batch mix" copy="How the current dataset is distributed by batch." data={batchChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={batchChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Attendance bands" copy="Useful for quickly spotting disengagement clusters." data={attendanceBandChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={attendanceBandChart} dataKey="count" nameKey="label" outerRadius={90} innerRadius={45}>
                        {attendanceBandChart.map((entry, index) => <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          ) : null}

          {activeView === 'intelligence' ? (
            <div className="overview-container">
              <div className="record-kpis record-kpis-rich">
                <div className="record-stat-card">
                  <span>Critical risk</span>
                  <strong>{workspaceAnalytics?.risk_breakdown?.critical ?? 0}</strong>
                  <p>Urgent follow-up recommended.</p>
                </div>
                <div className="record-stat-card">
                  <span>Warning</span>
                  <strong>{workspaceAnalytics?.risk_breakdown?.warning ?? 0}</strong>
                  <p>Needs closer academic monitoring.</p>
                </div>
                <div className="record-stat-card">
                  <span>Healthy</span>
                  <strong>{workspaceAnalytics?.risk_breakdown?.healthy ?? 0}</strong>
                  <p>Stable academic standing.</p>
                </div>
                <div className="record-stat-card">
                  <span>Missing data</span>
                  <strong>{workspaceAnalytics?.risk_breakdown?.missing_data ?? 0}</strong>
                  <p>Records that need data completion.</p>
                </div>
              </div>

              <div className="record-grid record-grid-middle">
                <ChartCard title="Semester distribution" copy="Coverage across tracked semesters." data={semesterChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={semesterChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                      <Bar dataKey="count" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="GPA bands" copy="Distribution of academic performance proxies." data={gpaBandChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gpaBandChart} dataKey="count" nameKey="label" outerRadius={90} innerRadius={45}>
                        {gpaBandChart.map((entry, index) => <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title="Top source cities" copy="The largest location clusters in the current record set." data={cityChart} height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" />
                    <YAxis type="category" dataKey="label" stroke="#94a3b8" width={100} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : null}

          {activeView === 'directory' ? (
            <div className="directory-container">
              <div className="directory-header">
                <div className="titles">
                  <h1>Student Explorer</h1>
                  <p>Search, segment, and open any student record from the live academic directory.</p>
                </div>
                <div className="search-box-rich glass-panel">
                  <Search size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search roll number, student name, email, or city"
                  />
                </div>
              </div>

              <div className="directory-toolbar-rich">
                <div className="filter-pills">
                  <button className={`pill ${!filters.riskOnly ? 'active' : ''}`} onClick={() => setFilters((prev) => ({ ...prev, riskOnly: false }))}>All profiles</button>
                  <button className={`pill risk ${filters.riskOnly ? 'active' : ''}`} onClick={() => setFilters((prev) => ({ ...prev, riskOnly: true }))}>Risk only</button>
                </div>
                <div className="select-filters">
                  <div className="select-wrap">
                    <select value={filters.batch} onChange={(event) => setFilters((prev) => ({ ...prev, batch: event.target.value }))}>
                      <option value="ALL">All batches</option>
                      {(insights?.batches || []).map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="select-wrap">
                    <select value={filters.city} onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}>
                      <option value="ALL">All cities</option>
                      {(insights?.cities || []).map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="select-wrap">
                    <select value={filters.semester} onChange={(event) => setFilters((prev) => ({ ...prev, semester: event.target.value }))}>
                      <option value="ALL">All semesters</option>
                      {(insights?.semesters || []).map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn-primary" onClick={exportDirectory}>
                  <Download size={16} />
                  Export CSV
                </button>
              </div>

              <div className="record-kpis record-kpis-rich">
                <div className="record-stat-card">
                  <span>Filtered records</span>
                  <strong>{directory.length}</strong>
                  <p>Records currently in view.</p>
                </div>
                <div className="record-stat-card">
                  <span>Avg attendance</span>
                  <strong>{directoryMeta.avgAttendance}%</strong>
                  <p>Across the filtered set.</p>
                </div>
                <div className="record-stat-card">
                  <span>Avg GPA</span>
                  <strong>{directoryMeta.avgGpa}</strong>
                  <p>Derived from semester grade points.</p>
                </div>
                <div className="record-stat-card">
                  <span>With backlogs</span>
                  <strong>{directoryMeta.withBacklogs}</strong>
                  <p>Students requiring academic follow-up.</p>
                </div>
              </div>

              <div className="table-stage glass-panel" style={{ overflow: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <SortHeader label="Rank" field="rank" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <SortHeader label="Roll no" field="roll_no" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <SortHeader label="Student" field="name" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <SortHeader label="Batch / sem" field="batch" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <SortHeader label="Academic" field="gpa" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <SortHeader label="Internal" field="internal" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <SortHeader label="Attendance" field="attendance" currentSort={filters.sortBy} currentDir={filters.sortDir} onSort={(f) => setFilters((prev) => ({ ...prev, sortBy: f, sortDir: prev.sortBy === f ? (prev.sortDir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {directory.map((student) => (
                      <tr key={student.roll_no} className={student.backlogs > 0 ? 'warning-row' : ''}>
                        <td className="rank-id" style={{ fontWeight: 'bold' }}>#{student.rank}</td>
                        <td className="roll-id"><strong>{student.roll_no}</strong></td>
                        <td>
                          <div className="entity-info">
                            <span className="name">{student.name}</span>
                            <span className="sub">{fmt(student.reg_no, 'No Reg No')} | {fmt(student.email, 'No email')}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flow-info">
                            <span className="batch">{fmt(student.batch, 'Batch pending')}</span>
                            <span className="sem">Semester {fmt(student.current_semester, 'NA')}</span>
                          </div>
                        </td>
                        <td>
                          <div className="stance-info">
                            <span className="gpa">{num(student.average_grade_points)} GPA</span>
                            <span className={`backlogs ${student.backlogs > 0 ? 'danger' : ''}`}>{student.backlogs} backlog(s)</span>
                          </div>
                        </td>
                        <td>{num(student.average_internal_percentage)}%</td>
                        <td>
                          <div className="eng-info">
                            <div className="eng-track">
                              <div className="eng-bar" style={{ width: `${Number(student.attendance_percentage || 0)}%`, background: Number(student.attendance_percentage || 0) < 75 ? '#ef4444' : '#10b981' }} />
                            </div>
                            <span className="val">{num(student.attendance_percentage)}%</span>
                          </div>
                        </td>
                        <td>
                          <button className="action-link" onClick={() => loadStudentDrilldown(student.roll_no)}>Open record</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {directoryLoading ? <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Loading directory...</div> : null}
                {!directoryLoading && !directory.length ? <div style={{ padding: '2rem' }}><EmptyState text="No student records matched the current filters." /></div> : null}
              </div>
            </div>
          ) : null}

          {activeView === 'student-record' ? (
            <div className="student-record-shell">
              <div className="record-header record-header-rich">
                <div>
                  <button className="action-link" onClick={() => setActiveView('directory')} style={{ marginBottom: '1rem' }}>
                    <ChevronLeft size={16} />
                    Back to directory
                  </button>
                  <h1>{studentRecord?.core_profile?.name || 'Student record'}</h1>
                  <p style={{ color: 'var(--text-muted)' }}>
                    {fmt(studentRecord?.roll_no)} | {fmt(studentRecord?.core_profile?.batch)} | Semester {fmt(studentRecord?.core_profile?.current_semester, 'NA')}
                  </p>
                </div>
                <div className="record-badges">
                  <span className="detail-pill subtle-pill"><UserCog size={14} /> {studentCredentials?.username || studentRecord?.roll_no}</span>
                  {studentCredentials?.has_account === false ? <span className="detail-pill"><AlertTriangle size={14} /> No login yet</span> : null}
                  {studentRecord?.academic_snapshot?.needs_attention ? <span className="detail-pill"><AlertTriangle size={14} /> Needs attention</span> : <span className="detail-pill"><ShieldCheck size={14} /> Stable</span>}
                  <button className="action-link" onClick={copyCredential}><Copy size={14} /> Copy credentials</button>
                  <button className="action-link" onClick={printProfile}><Download size={14} /> Print profile</button>
                  <button className="action-link" onClick={() => {
                    setEditFormData({
                      name: studentRecord?.core_profile?.name || '',
                      email: studentRecord?.contact_info?.email || studentRecord?.core_profile?.email || '',
                      phone_primary: studentRecord?.contact_info?.phone_primary || studentRecord?.core_profile?.phone_primary || '',
                      city: studentRecord?.contact_info?.city || studentRecord?.core_profile?.city || '',
                      batch: studentRecord?.core_profile?.batch || '',
                      current_semester: studentRecord?.core_profile?.current_semester || 1,
                    });
                    setEditingStudent(true);
                  }}><UserCog size={14} /> Edit student</button>
                  <button className="action-link" style={{ color: 'var(--danger)' }} onClick={() => setIsDeletingUrl(true)}>
                    <AlertTriangle size={14} /> Delete student
                  </button>
                </div>
              </div>

              {editingStudent && (
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
                  <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserCog size={18} /> Edit Student Profile
                  </h3>
                  <form onSubmit={handleEditStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Name</label>
                        <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff' }} required />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email</label>
                        <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Phone</label>
                        <input type="text" value={editFormData.phone_primary} onChange={(e) => setEditFormData({ ...editFormData, phone_primary: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>City</label>
                        <input type="text" value={editFormData.city} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Batch</label>
                        <input type="text" value={editFormData.batch} onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Semester</label>
                        <input type="number" min="1" max="10" value={editFormData.current_semester} onChange={(e) => setEditFormData({ ...editFormData, current_semester: parseInt(e.target.value) })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn-primary" disabled={actionInProgress}>
                        {actionInProgress ? <Loader2 className="spinner" size={16} /> : 'Save Changes'}
                      </button>
                      <button type="button" className="btn-primary" onClick={() => setEditingStudent(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {isDeletingUrl && (
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                  <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                    <AlertTriangle size={18} /> Confirm Deletion
                  </h3>
                  <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)' }}>Are you absolutely sure you want to delete {studentRecord?.core_profile?.name}'s record? This action will permanently erase their profile, grades, attendance, and login access. It cannot be undone.</p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn-primary" onClick={handleDeleteStudent} disabled={actionInProgress} style={{ background: 'var(--danger)', border: 'none' }}>
                      {actionInProgress ? <Loader2 className="spinner" size={16} /> : 'Yes, Delete Permanently'}
                    </button>
                    <button className="btn-primary" onClick={() => setIsDeletingUrl(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                  </div>
                </div>
              )}

              {recordLoading ? <div className="glass-panel" style={{ padding: '1.5rem' }}>Loading student record...</div> : null}

              {studentRecord ? (
                <>
                  <div className="record-kpis record-kpis-rich">
                    <div className="record-stat-card">
                      <span>Record completion</span>
                      <strong>{num(studentRecord.record_health?.completion_percentage)}%</strong>
                      <p>{studentRecord.record_health?.available_sections?.length || 0} sections available.</p>
                    </div>
                    <div className="record-stat-card">
                      <span>CGPA proxy</span>
                      <strong>{num(studentRecord.academic_snapshot?.cgpa_proxy)}</strong>
                      <p>Based on semester grade records.</p>
                    </div>
                    <div className="record-stat-card">
                      <span>Attendance</span>
                      <strong>{num(studentRecord.core_profile?.attendance_percentage)}%</strong>
                      <p>{studentRecord.core_profile?.attendance_count || 0} attendance entries.</p>
                    </div>
                    <div className="record-stat-card">
                      <span>Backlogs</span>
                      <strong>{studentHighlights.backlogCount}</strong>
                      <p>Live count from semester grades.</p>
                    </div>
                  </div>

                  <div className="record-grid record-grid-profile">
                    <div className="record-panel">
                      <SectionTitle eyebrow="Identity" title="Student profile" copy="Core identity, access, and academic standing in one place." />
                      <div className="detail-grid detail-grid-wide">
                        <DetailField icon={Users} label="Roll number" value={studentRecord.roll_no} emphasis />
                        <DetailField icon={Users} label="Registration no" value={studentRecord.core_profile?.reg_no} emphasis />
                        <DetailField icon={GraduationCap} label="Batch" value={studentRecord.core_profile?.batch} />
                        <DetailField icon={BookOpenText} label="Current semester" value={studentRecord.core_profile?.current_semester} />
                        <DetailField icon={ShieldCheck} label="Best grade" value={studentRecord.academic_snapshot?.best_grade} />
                        <DetailField icon={TrendingUp} label="Grade entries" value={studentRecord.academic_snapshot?.grade_entries} />
                        <DetailField icon={CalendarDays} label="Internal tests" value={studentRecord.academic_snapshot?.internal_tests} />
                      </div>
                    </div>

                    <div className="record-panel">
                      <SectionTitle eyebrow="Access" title="Portal credentials" copy="Use these details when helping a student sign in." />
                      <div className="detail-grid">
                        <DetailField icon={UserCog} label="Username" value={studentCredentials?.username} emphasis />
                        <DetailField icon={ShieldCheck} label="Account status" value={studentCredentials?.has_account ? 'Provisioned' : 'Not provisioned'} />
                        <DetailField icon={CalendarDays} label="DOB on file" value={studentCredentials?.dob_masked} />
                        <DetailField icon={AlertTriangle} label="Initial password" value={studentCredentials?.initial_password_hint || 'Already changed'} />
                      </div>
                      {studentCredentials?.note ? <EmptyState text={studentCredentials.note} /> : null}
                    </div>
                  </div>

                  <div className="record-grid record-grid-middle">
                    <div className="record-panel">
                      <SectionTitle eyebrow="Contact" title="Contact details" copy="Student and family communication points." />
                      <div className="detail-grid detail-grid-wide">
                        <DetailField icon={Mail} label="Email" value={studentRecord.contact_info?.email || studentRecord.core_profile?.email} />
                        <DetailField icon={Phone} label="Primary phone" value={studentRecord.contact_info?.phone_primary || studentRecord.core_profile?.phone_primary} />
                        <DetailField icon={Phone} label="Secondary phone" value={studentRecord.contact_info?.phone_secondary} />
                        <DetailField icon={MapPin} label="City" value={studentRecord.contact_info?.city || studentRecord.core_profile?.city} />
                        <DetailField icon={MapPin} label="Address" value={studentRecord.contact_info?.address} />
                        <DetailField icon={MapPin} label="Pincode" value={studentRecord.contact_info?.pincode} />
                      </div>
                    </div>

                    <div className="record-panel">
                      <SectionTitle eyebrow="Family" title="Guardian and emergency" copy="Useful when follow-up or support outreach is required." />
                      <div className="detail-grid detail-grid-wide">
                        <DetailField label="Parent / guardian" value={studentRecord.family_details?.parent_guardian_name} emphasis />
                        <DetailField label="Parent phone" value={studentRecord.family_details?.parent_phone} />
                        <DetailField label="Occupation" value={studentRecord.family_details?.occupation || studentRecord.family_details?.parent_occupation} />
                        <DetailField label="Parent email" value={studentRecord.family_details?.parent_email} />
                        <DetailField label="Emergency contact" value={studentRecord.family_details?.emergency_contact_name || studentRecord.family_details?.emergency_name} />
                        <DetailField label="Emergency phone" value={studentRecord.family_details?.emergency_contact_phone || studentRecord.family_details?.emergency_phone} />
                      </div>
                    </div>

                    <div className="record-panel">
                      <SectionTitle eyebrow="Performance" title="Semester-wise summary" copy="A consolidated view of academic progress per semester." />
                      <div className="table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Semester</th>
                              <th>Avg GPA</th>
                              <th>Avg Internal</th>
                              <th>Backlogs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentSemTrend.map((trend, index) => (
                              <tr key={index}>
                                <td style={{ fontWeight: '600', color: 'var(--accent)' }}>{trend.semester}</td>
                                <td>{num(trend.averageGradePoints)}</td>
                                <td>{num(trend.averageInternal)}%</td>
                                <td className={trend.backlogs > 0 ? 'text-danger' : ''}>{trend.backlogs}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="record-grid record-grid-insights">
                    <ChartCard title="Semester performance" copy="Tracks GPA proxy, internal average, and backlog count by semester." data={studentSemTrend} height={280}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={studentSemTrend}>
                          <defs>
                            <linearGradient id="student-sem-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="semester" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" domain={[0, 10]} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                          <Area type="monotone" dataKey="averageGradePoints" stroke="#38bdf8" fill="url(#student-sem-fill)" strokeWidth={3} />
                          <Area type="monotone" dataKey="averageInternal" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Internal assessment profile" copy="Average outcome per internal test set." data={studentAssessments} height={280}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={studentAssessments}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="test" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                          <Bar dataKey="average" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="record-grid record-grid-insights">
                    <ChartCard title="Grade distribution" copy="How the recorded grades are spread across the transcript." data={studentGradeDistribution} height={260}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={studentGradeDistribution} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                            {studentGradeDistribution.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <div className="record-panel">
                      <SectionTitle eyebrow="Highlights" title="Academic spotlight" copy="Quick prompts for review, mentoring, or intervention." />
                      <div className="insight-list">
                        <div className="insight-card">
                          <strong>Best subject</strong>
                          <span>{studentHighlights.bestSubject ? `${fmt(studentHighlights.bestSubject.subject_code)} | ${fmt(studentHighlights.bestSubject.subject_title)}` : 'No subject strengths recorded yet.'}</span>
                          <p>{studentHighlights.bestSubject ? `Grade ${fmt(studentHighlights.bestSubject.grade)} with ${fmt(studentHighlights.bestSubject.grade_point)} points.` : 'Add semester grades to unlock this insight.'}</p>
                        </div>
                        <div className="insight-card warning">
                          <strong>Support focus</strong>
                          <span>{studentHighlights.supportNeed ? `${fmt(studentHighlights.supportNeed.subject_code)} | ${fmt(studentHighlights.supportNeed.subject_title)}` : 'No internal risk subject recorded.'}</span>
                          <p>{studentHighlights.supportNeed ? `${fmt(studentHighlights.supportNeed.percentage)}% is the weakest internal score currently available.` : 'Internal assessment coverage is limited.'}</p>
                        </div>
                        <div className="insight-card">
                          <strong>Latest counselor note</strong>
                          <span>{studentHighlights.latestNote ? `${fmt(studentHighlights.latestNote.meeting_date)} | ${fmt(studentHighlights.latestNote.remark_category)}` : 'No counselor notes recorded.'}</span>
                          <p>{studentHighlights.latestNote?.remarks || 'This section updates once counselor diary entries are available.'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="record-grid record-grid-bottom">
                    <div className="record-panel">
                      <SectionTitle eyebrow="History" title="Previous academics" copy="Past qualifications and percentages before joining the current program." />
                      {(studentRecord.previous_academics || []).length ? (
                        <div className="stack-list">
                          {studentRecord.previous_academics.map((item, index) => (
                            <div key={`${item.qualification}-${index}`} className="stack-card">
                              <strong>{fmt(item.qualification || item.level)}</strong>
                              <p>{fmt(item.school_name || item.institution)}</p>
                              <span>{fmt(item.board_university)} | {fmt(item.year_passing || item.passing_year)} | {fmt(item.percentage)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : <EmptyState text="No previous academic records are available for this student yet." />}
                    </div>

                    <div className="record-panel">
                      <SectionTitle eyebrow="Activities" title="Extra curricular record" copy="Clubs, competitions, and non-academic participation." />
                      {(studentRecord.extra_curricular || []).length ? (
                        <div className="activity-cloud">
                          {studentRecord.extra_curricular.map((item, index) => (
                            <div key={`${item.category}-${index}`} className="activity-card">
                              <strong>{fmt(item.category || item.activity_type)}</strong>
                              <p>{fmt(item.description)}</p>
                              <span>{fmt(item.year)}</span>
                            </div>
                          ))}
                        </div>
                      ) : <EmptyState text="No extra curricular records are present." />}
                    </div>
                  </div>

                  <div className="record-panel">
                    <SectionTitle eyebrow="Counselor diary" title="Support timeline" copy="Meeting notes, interventions, and follow-up actions." />
                    {(studentRecord.counselor_diary || []).length ? (
                      <div className="timeline-list">
                        {studentRecord.counselor_diary.map((entry, index) => (
                          <div key={`${entry.created_at || entry.meeting_date}-${index}`} className="timeline-item">
                            <div className="timeline-dot" />
                            <div>
                              <strong>{fmt(entry.remark_category, 'General note')}</strong>
                              <p>{entry.remarks || 'No remarks captured.'}</p>
                              <span>{fmt(entry.meeting_date)} | {fmt(entry.counselor_name)}{entry.action_planned ? ` | Action: ${entry.action_planned}` : ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState text="No counselor diary entries were found for this student." />}
                  </div>

                  <div className="record-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <SectionTitle eyebrow="Transcript" title="Semester grades" copy="Detailed grade entries pulled from the academic record tables." />
                      <div className="select-wrap" style={{ width: '180px' }}>
                        <select
                          value={recordFilters.semester}
                          onChange={(e) => setRecordFilters(prev => ({ ...prev, semester: e.target.value }))}
                          style={{ background: 'var(--surface-light)', color: 'white', border: '1px solid var(--glass-border)' }}
                        >
                          <option value="ALL">All Semesters</option>
                          {[...new Set((studentRecord.semester_grades || []).map(g => g.semester))].sort().map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {(studentRecord.semester_grades || []).length ? (
                      <div className="table-wrap large-table">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Semester</th>
                              <th>Code</th>
                              <th>Subject</th>
                              <th>Grade</th>
                              <th>Grade point</th>
                              <th>Internal</th>
                              <th>Marks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentRecord.semester_grades
                              .filter(g => recordFilters.semester === 'ALL' || String(g.semester) === recordFilters.semester)
                              .map((grade, index) => (
                                <tr key={`${grade.subject_code}-${index}`}>
                                  <td>{fmt(grade.semester)}</td>
                                  <td>{fmt(grade.subject_code)}</td>
                                  <td>{fmt(grade.subject_title)}</td>
                                  <td>{fmt(grade.grade)}</td>
                                  <td>{fmt(grade.grade_point)}</td>
                                  <td>{num(grade.internal_marks)}</td>
                                  <td>{fmt(grade.marks)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <EmptyState text="No semester grades are stored for this student." />}
                  </div>

                  <div className="record-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <SectionTitle eyebrow="Assessments" title="Internal mark entries" copy="Subject-wise internal percentages." />
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div className="select-wrap" style={{ width: '160px' }}>
                          <select
                            value={recordFilters.citSemester}
                            onChange={(e) => setRecordFilters(prev => ({ ...prev, citSemester: e.target.value }))}
                            style={{ background: 'var(--surface-light)', color: 'white', border: '1px solid var(--glass-border)' }}
                          >
                            <option value="ALL">All Semesters</option>
                            {[...new Set((studentRecord.internal_marks || []).map(m => m.semester))].sort().map(s => (
                              <option key={s} value={s}>Semester {s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="select-wrap" style={{ width: '140px' }}>
                          <select
                            value={recordFilters.cit}
                            onChange={(e) => setRecordFilters(prev => ({ ...prev, cit: e.target.value }))}
                            style={{ background: 'var(--surface-light)', color: 'white', border: '1px solid var(--glass-border)' }}
                          >
                            <option value="ALL">All CIT Marks</option>
                            <option value="1">CIT 1</option>
                            <option value="2">CIT 2</option>
                            <option value="3">CIT 3</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {(studentRecord.internal_marks || []).length ? (
                      <div className="table-wrap large-table">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Semester</th>
                              <th>Test</th>
                              <th>Code</th>
                              <th>Subject</th>
                              <th>Percentage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentRecord.internal_marks
                              .filter(m => (recordFilters.cit === 'ALL' || String(m.test_number) === recordFilters.cit) && (recordFilters.citSemester === 'ALL' || String(m.semester) === recordFilters.citSemester))
                              .map((mark, index) => (
                                <tr key={`${mark.subject_code}-${mark.test_number}-${index}`}>
                                  <td>{fmt(mark.semester)}</td>
                                  <td style={{ fontWeight: '600', color: 'var(--accent)' }}>CIT {fmt(mark.test_number)}</td>
                                  <td>{fmt(mark.subject_code)}</td>
                                  <td>{fmt(mark.subject_title)}</td>
                                  <td>{mark.percentage === -1 ? <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>AB</span> : `${num(mark.percentage)}%`}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <EmptyState text="No internal mark entries are available for this student." />}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;
