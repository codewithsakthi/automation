import React, { useEffect, useMemo, useState } from 'react';
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  Book,
  Calendar,
  ChartNoAxesCombined,
  Lock,
  LogOut,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Shield,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';

const API_BASE = 'https://automation-0pd0.onrender.com';
const GRADE_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#38bdf8', '#f97316'];
const TAB_OPTIONS = ['Overview', 'Analytics', 'Profile', 'Security'];

const gradePoints = {
  O: 10,
  S: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  D: 4,
  E: 3,
  U: 0,
  W: 0,
  I: 0,
  P: 5,
  F: 0,
  AB: 0,
  FAIL: 0,
  PASS: 5,
};

const SortHeader = ({ label, field, currentSort, currentDir, onSort }) => {
  const isActive = currentSort === field;
  return (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer', userSelect: 'none', padding: '0.75rem 0' }}>
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

const Dashboard = ({ user, onLogout, onUserUpdate }) => {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [profile, setProfile] = useState(user);
  const [activeTab, setActiveTab] = useState('Overview');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncMeta, setSyncMeta] = useState(null);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    batch: user?.batch || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [sortBy, setSortBy] = useState('semester');
  const [sortDir, setSortDir] = useState('desc');
  const [semFilter, setSemFilter] = useState('ALL');
  const [assessmentFilter, setAssessmentFilter] = useState('ALL');

  const rollNo = user?.roll_no || user?.username;

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user]);

  const handleApiResponse = async (response, fallbackMessage, emptyValue = {}) => {
    const payload = await response.json().catch(() => emptyValue);
    if (response.status === 401) {
      onLogout();
      throw new Error('Session expired. Please sign in again.');
    }
    if (!response.ok) {
      throw new Error(payload.detail || fallbackMessage);
    }
    return payload;
  };

  const fetchDashboardData = async () => {
    if (!rollNo) {
      setError('Missing user information');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const [performanceResp, analyticsResp, meResp] = await Promise.all([
        fetch(`${API_BASE}/student/performance/${rollNo}`, { headers: authHeaders }),
        fetch(`${API_BASE}/student/analytics/${rollNo}`, { headers: authHeaders }),
        fetch(`${API_BASE}/me`, { headers: authHeaders }),
      ]);

      const [performancePayload, analyticsPayload, mePayload] = await Promise.all([
        handleApiResponse(performanceResp, 'Failed to load dashboard'),
        handleApiResponse(analyticsResp, 'Failed to load analytics'),
        handleApiResponse(meResp, 'Failed to load profile'),
      ]);

      setData(performancePayload);
      setAnalytics(analyticsPayload);
      setProfile(mePayload);
      setProfileForm({
        name: mePayload.name || '',
        email: mePayload.email || '',
        batch: mePayload.batch || '',
      });
      onUserUpdate(mePayload);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to load dashboard right now.');
    } finally {
      setLoading(false);
    }
  };

  const [showDobModal, setShowDobModal] = useState(false);
  const [syncDob, setSyncDob] = useState(localStorage.getItem('syncDob') || '');

  const handleSyncInitiate = () => {
    setShowDobModal(true);
  };

  const handleSyncSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!syncDob || syncDob.length !== 8) {
      setSyncMessage('Please enter DOB in DDMMYYYY format (8 digits).');
      return;
    }

    setSyncing(true);
    setSyncMessage('');
    setShowDobModal(false);
    try {
      const resp = await fetch(`${API_BASE}/scrape/${rollNo}?dob=${encodeURIComponent(syncDob)}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const payload = await handleApiResponse(resp, 'Sync failed');

      localStorage.setItem('syncDob', syncDob);
      localStorage.setItem('lastSyncMeta', JSON.stringify(payload.meta || null));
      localStorage.setItem('lastSyncMessage', payload.message || 'Sync completed');
      setSyncMeta(payload.meta || null);
      setSyncMessage(payload.message || 'Sync completed');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      setSyncMessage(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const resp = await fetch(`${API_BASE}/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(profileForm),
      });
      const payload = await handleApiResponse(resp, 'Failed to update profile');
      setProfile(payload);
      onUserUpdate(payload);
      setProfileMessage('Profile updated successfully.');
    } catch (err) {
      setProfileMessage(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordMessage('');
    try {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error('New password and confirmation do not match');
      }
      const resp = await fetch(`${API_BASE}/me/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      const payload = await handleApiResponse(resp, 'Failed to update password');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMessage(payload.message || 'Password updated successfully.');
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const storedMeta = localStorage.getItem('lastSyncMeta');
    const storedMessage = localStorage.getItem('lastSyncMessage');
    if (storedMeta) {
      try {
        setSyncMeta(JSON.parse(storedMeta));
      } catch {
        localStorage.removeItem('lastSyncMeta');
      }
    }
    if (storedMessage) {
      setSyncMessage(storedMessage);
    }
  }, [rollNo]);

  const marks = data?.marks ?? [];
  const attendance = data?.attendance ?? [];

  const filteredMarks = useMemo(() => marks.filter((mark) => {
    const courseCode = mark.subject?.course_code || '';
    const subjectName = mark.subject?.name || '';
    const matchesSearch = `${courseCode} ${subjectName}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = gradeFilter === 'ALL' || mark.grade === gradeFilter;
    const matchesSem = semFilter === 'ALL' || String(mark.semester) === semFilter;
    return matchesSearch && matchesGrade && matchesSem;
  }), [marks, searchTerm, gradeFilter, semFilter]);

  const sortedMarks = useMemo(() => {
    const fieldMap = {
      code: (m) => m.subject?.course_code || '',
      subject: (m) => (m.subject?.name || '').toLowerCase(),
      semester: (m) => m.semester || 0,
      grade: (m) => m.grade || '',
      internal: (m) => m.internal_marks || 0,
      total: (m) => m.total_marks || 0,
    };
    const getter = fieldMap[sortBy] || fieldMap.semester;
    const sorted = [...filteredMarks].sort((a, b) => {
      const valA = getter(a);
      const valB = getter(b);
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredMarks, sortBy, sortDir]);

  const chartData = filteredMarks.map((mark) => ({
    name: mark.subject?.course_code || `Sem ${mark.semester}`,
    cit1: mark.cit1_marks ?? 0,
    cit2: mark.cit2_marks ?? 0,
    cit3: mark.cit3_marks ?? 0,
  }));

  const attendanceChartData = attendance.slice(-8).map((entry) => ({
    name: new Date(entry.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    present: entry.total_present ?? 0,
  }));

  const gradeDistribution = analytics?.grade_distribution?.map((item) => ({ name: item.grade, value: item.count })) || [];
  const semesterTrend = analytics?.semester_performance?.map((item) => ({
    semester: `Sem ${item.semester}`,
    averageGradePoints: item.average_grade_points,
    averageInternal: item.average_internal,
  })) || [];

  const averagePoints = analytics?.average_grade_points?.toFixed?.(2) ?? '0.00';
  const averageInternal = analytics?.average_internal?.toFixed?.(2) ?? '0.00';
  const attendancePct = analytics ? `${analytics.attendance.percentage.toFixed(0)}%` : 'N/A';
  const backlogs = analytics?.total_backlogs ?? marks.filter((mark) => ['U', 'FAIL', 'W', 'I'].includes(mark.grade)).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="spinner" />
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <div className="glass-panel student-hero">
        <div className="student-hero-main">
          <div className="hero-avatar-wrap">
            <UserIcon color="white" size={26} />
          </div>
          <div className="hero-text-wrap">
            <h1 className="hero-name-title">
              {profile?.name || data?.name || 'Student'}
              {profile?.rank && <span className="hero-rank-badge">Rank #{profile.rank}</span>}
            </h1>
            <p className="hero-meta-text">
              Roll: {rollNo} | {profile?.reg_no ? `Reg: ${profile.reg_no} | ` : ''} {profile?.program_name || 'Program unavailable'} | {profile?.batch || data?.batch || 'Batch unavailable'}
            </p>
          </div>
        </div>
        <div className="student-hero-actions">
          <button className="btn-primary" onClick={handleSyncInitiate} disabled={syncing} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
            {syncing ? <Loader2 className="spinner" /> : <RefreshCw size={18} />} Sync Data
          </button>
          <button className="btn-primary" onClick={onLogout} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      <div className="student-tabs scroll-x">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {error ? <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1rem' }}>{error}</div> : null}
      {profile?.is_initial_password ? (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1rem' }}>
          <strong>Security notice:</strong> You are still using your initial password. Change it from the `Security` tab for better account safety.
        </div>
      ) : null}
      {syncMessage ? (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
          <strong>Sync status:</strong> {syncMessage}
          {syncMeta ? <div style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Duration: {syncMeta.duration_seconds}s{syncMeta.used_cached_data ? ' | Using cached data' : ''}</div> : null}
          {syncMeta?.warnings?.length ? <div style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{syncMeta.warnings[0]}</div> : null}
        </div>
      ) : null}

      {activeTab === 'Overview' ? (
        <>
          <div className="student-kpi-grid">
            {[
              { icon: Award, label: 'Average Grade Points', value: averagePoints, color: '#6366f1' },
              { icon: Calendar, label: 'Attendance', value: attendancePct, color: '#ec4899' },
              { icon: TrendingUp, label: 'Internal Avg', value: averageInternal, color: '#10b981' },
              { icon: Book, label: 'Backlogs', value: String(backlogs), color: '#f59e0b' },
            ].map((stat) => (
              <div key={stat.label} className="glass-panel kpi-card">
                <div className="kpi-card-content">
                  <stat.icon color={stat.color} size={28} />
                  <div className="kpi-card-text">
                    <p className="kpi-label">{stat.label}</p>
                    <h3 className="kpi-value">{stat.value}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="student-chart-grid">
            <div className="glass-panel" style={{ padding: '1.8rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>CIT Marks Performance</h2>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '10px' }} />
                    <Bar dataKey="cit1" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cit2" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cit3" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.8rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Attendance Trend</h2>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceChartData}>
                    <defs>
                      <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '10px' }} />
                    <Area type="monotone" dataKey="present" stroke="#38bdf8" fillOpacity={1} fill="url(#attendanceFill)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <div className="student-toolbar">
              <h2 style={{ fontSize: '1.15rem' }}>Subject Explorer</h2>
              <div className="student-toolbar-controls">
                <div className="student-search">
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="input-field" style={{ paddingLeft: '36px', width: '100%' }} placeholder="Search subject or code" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="input-field" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                  <option value="ALL">All grades</option>
                  {[...new Set(marks.map((mark) => mark.grade).filter(Boolean))].sort().map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
                <select className="input-field" value={semFilter} onChange={(e) => setSemFilter(e.target.value)}>
                  <option value="ALL">All Semesters</option>
                  {[...new Set(marks.map((mark) => String(mark.semester)))].sort().map((sem) => (
                    <option key={sem} value={sem}>Sem {sem}</option>
                  ))}
                </select>
                <select className="input-field" value={assessmentFilter} onChange={(e) => setAssessmentFilter(e.target.value)}>
                  <option value="ALL">All Marks</option>
                  <option value="CIT1">CIT 1</option>
                  <option value="CIT2">CIT 2</option>
                  <option value="CIT3">CIT 3</option>
                </select>
              </div>
            </div>
            <div className="student-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <SortHeader label="Code" field="code" currentSort={sortBy} currentDir={sortDir} onSort={(f) => { setSortDir(sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setSortBy(f); }} />
                    <SortHeader label="Subject" field="subject" currentSort={sortBy} currentDir={sortDir} onSort={(f) => { setSortDir(sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setSortBy(f); }} />
                    <SortHeader label="Semester" field="semester" currentSort={sortBy} currentDir={sortDir} onSort={(f) => { setSortDir(sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setSortBy(f); }} />
                    <SortHeader label="Grade" field="grade" currentSort={sortBy} currentDir={sortDir} onSort={(f) => { setSortDir(sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setSortBy(f); }} />
                    <SortHeader label={assessmentFilter === 'ALL' ? 'Internal' : assessmentFilter} field="internal" currentSort={sortBy} currentDir={sortDir} onSort={(f) => { setSortDir(sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setSortBy(f); }} />
                    <SortHeader label="Total" field="total" currentSort={sortBy} currentDir={sortDir} onSort={(f) => { setSortDir(sortBy === f ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); setSortBy(f); }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedMarks.map((mark) => (
                    <tr key={mark.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '0.85rem 0' }}>{mark.subject?.course_code || '-'}</td>
                      <td style={{ padding: '0.85rem 0' }}>{mark.subject?.name || '-'}</td>
                      <td style={{ padding: '0.85rem 0' }}>{mark.semester}</td>
                      <td style={{ padding: '0.85rem 0' }}>{mark.grade || '-'}</td>
                      <td style={{ padding: '0.85rem 0' }}>
                        {assessmentFilter === 'ALL' 
                          ? (mark.internal_marks ?? '-') 
                          : (assessmentFilter === 'CIT1' ? mark.cit1_marks : (assessmentFilter === 'CIT2' ? mark.cit2_marks : mark.cit3_marks)) ?? '-'}
                      </td>
                      <td style={{ padding: '0.85rem 0' }}>{mark.total_marks ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'Analytics' ? (
        <div className="student-analytics-grid">
          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Grade Distribution</h2>
            <div style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gradeDistribution} dataKey="value" nameKey="name" outerRadius={100} label>
                    {gradeDistribution.map((entry, index) => <Cell key={entry.name} fill={GRADE_COLORS[index % GRADE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Semester Trend</h2>
            <div style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={semesterTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="semester" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '10px' }} />
                  <Bar dataKey="averageGradePoints" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="averageInternal" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Strength Areas</h2>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {(analytics?.strength_subjects || []).map((item) => (
                <div key={`${item.course_code}-${item.semester}`} className="metric-row">
                  <div>
                    <strong>{item.course_code}</strong>
                    <p style={{ color: 'var(--text-muted)' }}>{item.subject}</p>
                  </div>
                  <span>{item.grade} | {item.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Risk Watchlist</h2>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {(analytics?.risk_subjects || []).length ? (analytics.risk_subjects || []).map((item) => (
                <div key={`${item.course_code}-${item.semester}`} className="metric-row">
                  <div>
                    <strong>{item.course_code}</strong>
                    <p style={{ color: 'var(--text-muted)' }}>{item.risk_reason}</p>
                  </div>
                  <span>{item.grade} | {item.internal_marks}</span>
                </div>
              )) : <p style={{ color: 'var(--text-muted)' }}>No current risk subjects detected.</p>}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Attendance Insights</h2>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <div className="metric-row"><span>Recent full-attendance streak</span><strong>{analytics?.attendance?.recent_streak_days ?? 0} days</strong></div>
              <div className="metric-row"><span>Absent / partial days</span><strong>{analytics?.attendance?.absent_days ?? 0}</strong></div>
              <div className="metric-row"><span>Total present hours</span><strong>{analytics?.attendance?.total_present ?? 0}</strong></div>
              <div className="metric-row"><span>Total working hours</span><strong>{analytics?.attendance?.total_hours ?? 0}</strong></div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Analyst Notes</h2>
            <div style={{ display: 'grid', gap: '0.85rem', color: 'var(--text-muted)' }}>
              <p><ChartNoAxesCombined size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Semester momentum is strongest where internal marks stay above 80.</p>
              <p><Shield size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Use the risk watchlist to prioritise subjects before the next assessment cycle.</p>
              <p><TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Refresh sync after portal updates to keep CIT and attendance analytics current.</p>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'Profile' ? (
        <div className="student-form-grid">
          <form className="glass-panel" style={{ padding: '1.8rem' }} onSubmit={handleProfileSave}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Edit Profile</h2>
            <div className="input-group">
              <label>Name</label>
              <input className="input-field" value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input className="input-field" type="email" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Batch</label>
              <input className="input-field" value={profileForm.batch} onChange={(e) => setProfileForm((prev) => ({ ...prev, batch: e.target.value }))} />
            </div>
            <button className="btn-primary" type="submit" disabled={savingProfile}>
              {savingProfile ? <Loader2 className="spinner" /> : <Save size={18} />} Save Profile
            </button>
            {profileMessage ? <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>{profileMessage}</p> : null}
          </form>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Account Snapshot</h2>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <div className="metric-row"><span>Username</span><strong>{profile?.username || '-'}</strong></div>
              <div className="metric-row"><span>Roll Number</span><strong>{profile?.roll_no || '-'}</strong></div>
              <div className="metric-row"><span>Register Number</span><strong>{profile?.reg_no || '-'}</strong></div>
              <div className="metric-row"><span>Program</span><strong>{profile?.program_name || '-'}</strong></div>
              <div className="metric-row"><span>Current Semester</span><strong>{profile?.current_semester || '-'}</strong></div>
              <div className="metric-row"><span>Initial Password</span><strong>{profile?.is_initial_password ? 'Yes' : 'No'}</strong></div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'Security' ? (
        <div className="student-form-grid">
          <form className="glass-panel" style={{ padding: '1.8rem' }} onSubmit={handlePasswordSave}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Change Password</h2>
            <div className="input-group">
              <label>Current Password</label>
              <input className="input-field" type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label>New Password</label>
              <input className="input-field" type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label>Confirm New Password</label>
              <input className="input-field" type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))} required />
            </div>
            <button className="btn-primary" type="submit" disabled={changingPassword}>
              {changingPassword ? <Loader2 className="spinner" /> : <Lock size={18} />} Update Password
            </button>
            {passwordMessage ? <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>{passwordMessage}</p> : null}
          </form>

          <div className="glass-panel" style={{ padding: '1.8rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>Security Guidance</h2>
            <div style={{ display: 'grid', gap: '0.9rem', color: 'var(--text-muted)' }}>
              <p>Choose a password that is at least 6 characters long and not based on your DOB.</p>
              <p>After changing your password, use the new password for the next login and future sync sessions.</p>
              <p>If sync still requires DOB for the external portal, you can continue entering it when prompted without changing your account password here.</p>
            </div>
          </div>
        </div>
      ) : null}
      {showDobModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '400px', width: '100%' }}>
            <h2 style={{ marginBottom: '1rem' }}>Verify Identity</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Enter your Date of Birth in <strong>DDMMYYYY</strong> format to authenticate with the external portal and fetch your latest academic records.
            </p>
            <form onSubmit={handleSyncSubmit}>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label>Date of Birth (DDMMYYYY)</label>
                <input
                  autoFocus
                  className="input-field"
                  maxLength={8}
                  placeholder="e.g. 15082000"
                  type="text"
                  value={syncDob}
                  onChange={(e) => setSyncDob(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={() => setShowDobModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Start Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
