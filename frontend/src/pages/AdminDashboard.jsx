import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  Copy,
  Download,
  Filter,
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
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';
const GRADE_POINTS = { O: 10, S: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, D: 4, E: 3, PASS: 5, P: 5, FAIL: 0, F: 0, U: 0, W: 0, I: 0, AB: 0 };

const fmt = (value) => (value === null || value === undefined || value === '' ? '-' : value);
const numberFmt = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');

const buildStudentAnalytics = (record) => {
  const semesterGrades = record?.semester_grades || [];
  const groupedSemesters = semesterGrades.reduce((acc, item) => {
    const key = item.semester || 0;
    acc[key] = acc[key] || { grades: [], internals: [] };
    if (item.grade) acc[key].grades.push(GRADE_POINTS[item.grade] ?? 0);
    if (item.internal_marks !== null && item.internal_marks !== undefined) acc[key].internals.push(item.internal_marks);
    return acc;
  }, {});

  return Object.entries(groupedSemesters).map(([semester, values]) => ({
    semester: `Sem ${semester}`,
    averageGradePoints: values.grades.length ? Number((values.grades.reduce((sum, value) => sum + value, 0) / values.grades.length).toFixed(2)) : 0,
    averageInternal: values.internals.length ? Number((values.internals.reduce((sum, value) => sum + value, 0) / values.internals.length).toFixed(2)) : 0,
  }));
};

const buildInternalTrend = (record) => (record?.internal_marks || []).slice(0, 18).map((item, index) => ({
  label: item.subject_code || item.subject_title || `Test ${index + 1}`,
  percentage: item.percentage || 0,
}));

const buildAssessmentSummary = (record) => {
  const grouped = (record?.internal_marks || []).reduce((acc, item) => {
    const key = item.test_number || 'NA';
    acc[key] = acc[key] || { count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += Number(item.percentage || 0);
    return acc;
  }, {});

  return Object.entries(grouped).map(([test, values]) => ({
    test: `Test ${test}`,
    average: values.count ? Number((values.total / values.count).toFixed(2)) : 0,
    subjects: values.count,
  }));
};

const summarizeRecord = (record) => {
  const semesterGrades = record?.semester_grades || [];
  const internalMarks = record?.internal_marks || [];
  const diary = record?.counselor_diary || [];
  const activities = record?.extra_curricular || [];
  const previousAcademics = record?.previous_academics || [];
  const backlogCount = semesterGrades.filter((item) => ['U', 'FAIL', 'W', 'I'].includes(String(item.grade || '').toUpperCase())).length;
  const bestSubject = semesterGrades.reduce((best, item) => {
    const nextPoint = GRADE_POINTS[item.grade] ?? -1;
    const bestPoint = best ? (GRADE_POINTS[best.grade] ?? -1) : -1;
    return nextPoint > bestPoint ? item : best;
  }, null);
  const focusSubject = internalMarks.reduce((lowest, item) => {
    const score = Number(item.percentage ?? 999);
    const current = lowest ? Number(lowest.percentage ?? 999) : 999;
    return score < current ? item : lowest;
  }, null);

  return { semesterGrades, internalMarks, diary, activities, previousAcademics, backlogCount, bestSubject, focusSubject };
};

const DetailField = ({ icon: Icon, label, value, emphasis = false }) => (
  <div className={`detail-field ${emphasis ? 'detail-field-emphasis' : ''}`}>
    <div className="detail-label">{Icon ? <Icon size={14} /> : null}<span>{label}</span></div>
    <div className="detail-value">{fmt(value)}</div>
  </div>
);

const EmptyState = ({ text }) => <div className="empty-note">{text}</div>;

const SectionTitle = ({ eyebrow, title, copy }) => (
  <div className="section-heading">
    {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
    <h3>{title}</h3>
    {copy ? <p>{copy}</p> : null}
  </div>
);

const toCsvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const AdminDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'directory', 'student-record'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [adminProfile, setAdminProfile] = useState(null);

  // Storage for Overview Metrics
  const [overview, setOverview] = useState(null);
  const [insights, setInsights] = useState(null);

  // Storage for Directory
  const [directory, setDirectory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [filters, setFilters] = useState({
    city: 'ALL',
    batch: 'ALL',
    semester: 'ALL',
    riskOnly: false,
    sortBy: 'roll_no',
    sortDir: 'asc'
  });

  // Storage for Details
  const [selectedRoll, setSelectedRoll] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [studentCredentials, setStudentCredentials] = useState(null);

  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }), [user]);

  const handleApiResponse = async (resp, fallbackMsg) => {
    if (resp.status === 401) {
      onLogout();
      throw new Error('Session expired. Please sign in again.');
    }
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      const detail = errorData.detail;
      const message = typeof detail === 'string'
        ? detail
        : (typeof detail === 'object' ? JSON.stringify(detail) : fallbackMsg);
      throw new Error(message);
    }
    return resp.json();
  };

  const loadChromeData = async () => {
    try {
      setLoading(true);
      const [ovResp, inResp, meResp] = await Promise.all([
        fetch(`${API_BASE}/admin/overview`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/directory-insights`, { headers: authHeaders }),
        fetch(`${API_BASE}/me`, { headers: authHeaders })
      ]);
      const [overviewPayload, insightsPayload, profilePayload] = await Promise.all([
        handleApiResponse(ovResp, 'Failed to load overview'),
        handleApiResponse(inResp, 'Failed to load insights'),
        handleApiResponse(meResp, 'Failed to load profile')
      ]);
      setOverview(overviewPayload);
      setInsights(insightsPayload);
      setAdminProfile(profilePayload);
      onUserUpdate(profilePayload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const loadDirectory = async () => {
    try {
      setLoading(true);
      const queryObj = {
        search: deferredSearch,
        city: filters.city !== 'ALL' ? filters.city : '',
        batch: filters.batch !== 'ALL' ? filters.batch : '',
        risk_only: filters.riskOnly,
        sort_by: filters.sortBy,
        sort_dir: filters.sortDir
      };
      if (filters.semester !== 'ALL' && filters.semester !== '') {
        queryObj.semester = filters.semester;
      }
      const query = new URLSearchParams(queryObj);
      const resp = await fetch(`${API_BASE}/admin/students?${query}`, { headers: authHeaders });
      setDirectory(await handleApiResponse(resp, 'Failed to load directory'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDrilldown = async (roll) => {
    try {
      setLoading(true);
      const [recResp, credResp] = await Promise.all([
        fetch(`${API_BASE}/admin/student-record/${roll}`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/student-credentials/${roll}`, { headers: authHeaders })
      ]);
      setStudentRecord(await handleApiResponse(recResp, 'Failed to load student record'));
      setStudentCredentials(await handleApiResponse(credResp, 'Failed to load credentials'));
      setSelectedRoll(roll);
      setActiveView('student-record');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [importingSnapshots, setImportingSnapshots] = useState(false);
  const handleImportSnapshots = async () => {
    try {
      setImportingSnapshots(true);
      setError('');
      const response = await fetch(`${API_BASE}/admin/import-snapshots`, {
        method: 'POST',
        headers: authHeaders,
      });
      const payload = await handleApiResponse(response, 'Failed to import snapshot data');
      setWorkspaceMessage(`${payload.message} Credentials use DOB in DDMMYYYY format.`);
      await refreshWorkspace();
    } catch (err) {
      setError(err.message || 'Unable to import snapshots.');
    } finally {
      setImportingSnapshots(false);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);
  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      setError('');
      setWorkspaceMessage('Starting bulk sync for all students in data directory... This may take a while.');
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
      setSyncingAll(false);
    }
  };

  useEffect(() => { loadChromeData(); }, []);
  useEffect(() => {
    if (activeView === 'directory') loadDirectory();
  }, [activeView, deferredSearch, filters.city, filters.batch, filters.semester, filters.riskOnly, filters.sortBy, filters.sortDir]);

  const analyticData = useMemo(() => buildStudentAnalytics(studentRecord), [studentRecord]);

  const exportDirectory = () => {
    if (!directory.length) return;
    const headers = ['roll_no', 'name', 'city', 'email', 'phone_primary', 'batch', 'current_semester', 'average_grade_points', 'average_internal_percentage'];
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
    if (!selectedCredential) return;
    const lines = [
      `Roll No: ${selectedCredential.roll_no}`,
      `Username: ${selectedCredential.username}`,
      `DOB: ${selectedCredential.dob_masked || '-'}`,
      `Initial Password: ${selectedCredential.initial_password_hint || 'Already changed by student'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setWorkspaceMessage(`Copied credentials for ${selectedCredential.roll_no}.`);
    } catch {
      setWorkspaceMessage('Clipboard copy failed on this browser.');
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spinner" /></div>;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0 0.5rem' }}>
            <div className="logo-box" style={{ background: 'var(--accent-gradient)', padding: '0.6rem', borderRadius: '14px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}>
              <GraduationCap color="white" size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'white' }}>Portal<span className="gradient-text">CRM</span></h2>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700' }}>Admin Engine</p>
            </div>
          </div>

          <nav className="admin-nav" style={{ marginTop: '3rem' }}>
            <button
              className={`admin-nav-item ${activeView === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <LayoutDashboard size={20} /> Dashboard
            </button>
            <button
              className={`admin-nav-item ${activeView === 'directory' || activeView === 'student-record' ? 'active' : ''}`}
              onClick={() => { setActiveView('directory'); setSelectedRoll(null); }}
            >
              <Users size={20} /> Students
            </button>
            <button
              className="admin-nav-item"
              onClick={() => setError('Performance analytics module is being synchronized.')}
            >
              <Sparkles size={20} /> AI Insights
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="admin-profile-pill">
            <div className="avatar">{adminProfile?.name?.charAt(0) || 'A'}</div>
            <div className="info">
              <p className="name">{adminProfile?.name || 'Administrator'}</p>
              <p className="status">Active Session</p>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={18} /> Exit System
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-top-bar">
          <div className="breadcrumb">
            <Home size={16} />
            <span className="sep">/</span>
            <span className="current">{activeView === 'student-record' ? 'Profile Details' : activeView.charAt(0).toUpperCase() + activeView.slice(1)}</span>
          </div>

          <div className="top-bar-actions">
            {workspaceMessage && (
              <div className="system-msg animate-fade">
                <Sparkles size={14} /> {workspaceMessage}
              </div>
            )}
            <div className="action-divider" />
            <button className="icon-action" onClick={() => { loadChromeData(); if (activeView === 'directory') loadDirectory(); }} title="Reload Data">
              <RefreshCw size={18} className={loading ? 'spinner' : ''} />
            </button>
          </div>
        </header>

        <section className="admin-pane scroll-y animate-fade" key={activeView}>
          {error && (
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <AlertTriangle size={18} color="var(--danger)" /> {error}
              </div>
              <button onClick={() => setError('')} className="close" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
            </div>
          )}

          {activeView === 'overview' && overview && (
            <div className="overview-container">
              <div className="welcome-banner">
                <h1>Pulse <span className="gradient-text">Metrics</span></h1>
                <p>Aggregated academic health and institutional baseline across {overview.total_students} student profiles.</p>

                <div className="banner-ops">
                  <button className="btn-glass" onClick={handleImportSnapshots} disabled={importingSnapshots} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '12px', display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer' }}>
                    {importingSnapshots ? <Loader2 size={18} className="spinner" /> : <Download size={18} />} Import Logs
                  </button>
                  <button className="btn-primary" onClick={handleSyncAll} disabled={syncingAll}>
                    {syncingAll ? <Loader2 size={18} className="spinner" /> : <RefreshCw size={18} />} Sync All Data
                  </button>
                </div>
              </div>

              <div className="kpi-grid-modern">
                <div className="kpi-card-rich glass-panel">
                  <div className="icon-bg" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}><Users /></div>
                  <div className="data">
                    <span className="label">Total Managed</span>
                    <strong className="value">{overview.total_students}</strong>
                    <p className="sub">Active Records</p>
                  </div>
                </div>
                <div className="kpi-card-rich glass-panel">
                  <div className="icon-bg" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><AlertTriangle /></div>
                  <div className="data">
                    <span className="label">High Risk</span>
                    <strong className="value">{overview.students_needing_attention}</strong>
                    <p className="sub">Immediate Attention</p>
                  </div>
                </div>
                <div className="kpi-card-rich glass-panel">
                  <div className="icon-bg" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}><GraduationCap /></div>
                  <div className="data">
                    <span className="label">GPA Average</span>
                    <strong className="value">{numberFmt(overview.average_grade_points)}</strong>
                    <p className="sub">Institutional Avg</p>
                  </div>
                </div>
                <div className="kpi-card-rich glass-panel">
                  <div className="icon-bg" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}><CalendarDays /></div>
                  <div className="data">
                    <span className="label">Engagement</span>
                    <strong className="value">{numberFmt(overview.average_attendance)}%</strong>
                    <p className="sub">Avg Attendance</p>
                  </div>
                </div>
              </div>

              <div className="priority-split">
                <div className="priority-panel glass-panel">
                  <div className="panel-header">
                    <h3><Sparkles size={18} /> Top Performing Talents</h3>
                    <p>High achieving students across all batches.</p>
                  </div>
                  <div className="priority-list">
                    {overview.top_performers.map(node => (
                      <button key={node.roll_no} className="priority-item" onClick={() => loadStudentDrilldown(node.roll_no)}>
                        <div className="node-avatar">{node.name.charAt(0)}</div>
                        <div className="node-main">
                          <strong>{node.name}</strong>
                          <span>{node.roll_no} • {node.program_name}</span>
                        </div>
                        <div className="node-metric">
                          <span className="val">{numberFmt(node.average_grade_points)}</span>
                          <span className="lab">CGPA</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="priority-panel glass-panel danger">
                  <div className="panel-header">
                    <h3><AlertTriangle size={18} /> Critical Risk Profiles</h3>
                    <p>Immediate intervention recommended based on arrears.</p>
                  </div>
                  <div className="priority-list">
                    {overview.attention_required.map(node => (
                      <button key={node.roll_no} className="priority-item risk" onClick={() => loadStudentDrilldown(node.roll_no)}>
                        <div className="node-avatar">{node.name.charAt(0)}</div>
                        <div className="node-main">
                          <strong>{node.name}</strong>
                          <span>{node.roll_no} • Sem {node.current_semester}</span>
                        </div>
                        <div className="node-metric">
                          <span className="val">{node.backlogs}</span>
                          <span className="lab">Arrears</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'directory' && (
            <div className="directory-container">
              <div className="directory-header">
                <div className="titles">
                  <h1>Student <span className="gradient-text">Explorer</span></h1>
                  <p>Search through {insights?.total_records || 'all'} institutional records with granular filters.</p>
                </div>
                <div className="search-box-rich glass-panel">
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder="Search student identity, roll, or region..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="directory-toolbar-rich">
                <div className="filter-pills">
                  <button className={`pill ${!filters.riskOnly ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, riskOnly: false }))}>All Profiles</button>
                  <button className={`pill risk ${filters.riskOnly ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, riskOnly: true }))}>
                    At Risk
                  </button>
                </div>

                <div className="select-filters">
                  <div className="select-wrap">
                    <Filter size={14} />
                    <select value={filters.batch} onChange={(e) => setFilters(f => ({ ...f, batch: e.target.value }))}>
                      <option value="ALL">All Batches</option>
                      {insights?.batches.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
                    </select>
                  </div>
                  <div className="select-wrap">
                    <MapPin size={14} />
                    <select value={filters.city} onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}>
                      <option value="ALL">All Regions</option>
                      {insights?.cities.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="global-ops" style={{ marginLeft: 'auto' }}>
                  <button className="btn-primary" onClick={exportDirectory} style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}>
                    <Download size={18} /> Export Data
                  </button>
                </div>
              </div>

              <div className="table-stage glass-panel" style={{ overflow: 'hidden' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th onClick={() => setFilters(f => ({ ...f, sortBy: 'roll_no', sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' }))}>Roll Number</th>
                      <th onClick={() => setFilters(f => ({ ...f, sortBy: 'name', sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' }))}>Student Entity</th>
                      <th>Program Flow</th>
                      <th>Academic Stance</th>
                      <th>Engagement</th>
                      <th>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.map(node => (
                      <tr key={node.roll_no} className={node.backlogs > 0 ? 'warning-row' : ''}>
                        <td className="roll-id"><strong>{node.roll_no}</strong></td>
                        <td>
                          <div className="entity-info">
                            <span className="name">{node.name}</span>
                            <span className="sub">{node.email || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flow-info">
                            <span className="batch">{node.batch}</span>
                            <span className="sem">Semester {node.current_semester}</span>
                          </div>
                        </td>
                        <td>
                          <div className="stance-info">
                            <span className="gpa">{numberFmt(node.average_grade_points)} CGPA</span>
                            <span className={`backlogs ${node.backlogs > 0 ? 'danger' : ''}`}>{node.backlogs} Arrears</span>
                          </div>
                        </td>
                        <td>
                          <div className="eng-info">
                            <div className="eng-track">
                              <div className="eng-bar" style={{ width: `${node.attendance_percentage}%`, background: node.attendance_percentage < 75 ? '#ef4444' : '#10b981' }} />
                            </div>
                            <span className="val">{numberFmt(node.attendance_percentage)}%</span>
                          </div>
                        </td>
                        <td>
                          <button className="action-link" onClick={() => loadStudentDrilldown(node.roll_no)}>Explore Profile</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {directory.length === 0 && !loading && (
                  <div className="empty-results" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No student records match existing filter criteria.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'student-record' && studentRecord && (
            <div className="drilldown-container animate-fade">
              <header className="drilldown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button className="nav-back" onClick={() => setActiveView('directory')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '12px', display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer' }}>
                  <ChevronLeft size={18} /> Directory Base
                </button>
                <div className="profile-identity" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div className="avatar-main" style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>{studentRecord?.core_profile?.name?.charAt(0) || '?'}</div>
                  <div className="text-main">
                    <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{studentRecord?.core_profile?.name || 'Unknown Student'}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{studentRecord?.roll_no} • {studentRecord?.core_profile?.batch || 'No Batch'}</p>
                  </div>
                </div>
                <div className="header-badges" style={{ display: 'flex', gap: '1rem' }}>
                  <span className="detail-pill subtle-pill">Semester {studentRecord?.core_profile?.current_semester || 'N/A'}</span>
                  {studentRecord?.academic_snapshot?.needs_attention && <span className="detail-pill risk">Risk Profile</span>}
                </div>
              </header>

              <div className="record-grid-modern" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ gridColumn: 'span 2', padding: '1.5rem' }}>
                  <div className="box-header">
                    <h3>Performance Progression</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Semester-wise CGPA trajectory</p>
                  </div>
                  <div className="chart-large" style={{ height: '300px', marginTop: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticData}>
                        <defs>
                          <linearGradient id="colGpaRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="semester" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 10]} />
                        <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '12px', border: '1px solid var(--glass-border)' }} />
                        <Area type="monotone" dataKey="averageGradePoints" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colGpaRec)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '1rem' }}>Contact Info</h3>
                    <div className="contact-stack" style={{ display: 'grid', gap: '1rem' }}>
                      <div className="c-item" style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}><Mail size={16} /> {studentRecord?.contact_info?.email || 'N/A'}</div>
                      <div className="c-item" style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '1rem' }}><Phone size={16} /> {studentRecord?.contact_info?.phone_primary || 'N/A'}</div>
                      <div className="c-item" style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-muted)' }}><MapPin size={16} /> {studentRecord?.contact_info?.city || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 'bold' }}>Portal Access</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <code style={{ fontSize: '1rem', color: '#818cf8', fontWeight: 'bold' }}>{studentCredentials?.username}</code>
                      <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: studentCredentials?.is_initial_password ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: studentCredentials?.is_initial_password ? 'var(--warning)' : 'var(--success)' }}>
                        {studentCredentials?.is_initial_password ? 'Initial Pass' : 'Secured'}
                      </span>
                    </div>
                    <button className="btn-secondary" onClick={copyCredential} style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>
                      <Copy size={14} style={{ marginRight: '0.5rem' }} /> Copy Details
                    </button>
                  </div>
                </div>

                <div className="glass-panel" style={{ gridColumn: 'span 3', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3>Academic Performance Log</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Consolidated results from portal records</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Avg GPA</p>
                        <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>{numberFmt(studentRecord?.academic_snapshot?.cgpa_proxy)}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Best Grade</p>
                        <strong style={{ fontSize: '1.25rem' }}>{studentRecord?.academic_snapshot?.best_grade || '-'}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Attendance</p>
                        <strong style={{ fontSize: '1.25rem' }}>{numberFmt(studentRecord?.core_profile?.attendance_percentage)}%</strong>
                      </div>
                    </div>
                  </div>

                  <div className="table-stage" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="modern-table">
                      <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                        <tr>
                          <th>Semester</th>
                          <th>Course Code</th>
                          <th>Subject Title</th>
                          <th>Grade</th>
                          <th>Points</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(studentRecord?.semester_grades || []).map((grade, idx) => (
                          <tr key={idx}>
                            <td>Sem {grade.semester}</td>
                            <td style={{ fontWeight: 'bold', color: '#94a3b8' }}>{grade.subject_code}</td>
                            <td>{grade.subject_title}</td>
                            <td><span style={{ fontWeight: 'bold' }}>{grade.grade}</span></td>
                            <td>{grade.grade_point}</td>
                            <td>
                              <span style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                background: ['U', 'F', 'FAIL', 'AB'].includes(String(grade.grade || '').toUpperCase()) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: ['U', 'F', 'FAIL', 'AB'].includes(String(grade.grade || '').toUpperCase()) ? 'var(--danger)' : 'var(--success)'
                              }}>
                                {['U', 'F', 'FAIL', 'AB'].includes(String(grade.grade || '').toUpperCase()) ? 'Arrear' : 'Pass'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="glass-panel" style={{ gridColumn: 'span 3', padding: '1.5rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3>Counselor Support Diary</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Official interaction logs and remarks history</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {(studentRecord?.counselor_diary || []).length ? studentRecord.counselor_diary.map((entry, idx) => (
                      <div key={idx} className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase' }}>{entry.remark_category}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.meeting_date}</span>
                        </div>
                        <p style={{ fontSize: '0.95rem', marginBottom: '1rem', lineHeight: '1.5' }}>{entry.remarks}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>with <strong>{entry.counselor_name}</strong></span>
                          {entry.action_planned && <span style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><Sparkles size={14} /> Action Taken</span>}
                        </div>
                      </div>
                    )) : (
                      <div style={{ gridColumn: 'span 2', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No counselling records found for this student.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
