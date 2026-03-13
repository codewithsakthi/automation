import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, Sparkles, TrendingUp, CheckCircle2, AlertTriangle, Info, 
  Award, Calendar, BadgeAlert, LogOut, RefreshCw, Save, Lock, Shield, Search 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, 
  BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { SectionTitle, StatCard, SortHeader } from '../components/DashboardComponents';
import api from '../api/client';
import { buildStudentIntelligence, fmt, num, CHART_COLORS } from '../services/academicService';

// Redundant component definitions removed - imported from DashboardComponents

const Dashboard = () => {
  const { user, logout, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [semFilter, setSemFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('semester');
  const [sortDir, setSortDir] = useState('desc');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDob, setSyncDob] = useState(localStorage.getItem('syncDob') || '');
  
  const rollNo = user?.roll_no || user?.username;

  // Data Fetching
  const { data: performance, isLoading: loadingPerf } = useQuery({
    queryKey: ['performance', rollNo],
    queryFn: () => api.get(`/api/students/performance/${rollNo}`),
    enabled: !!rollNo,
  });

  const { data: commandCenter, isLoading: loadingCommandCenter } = useQuery({
    queryKey: ['student-command-center', rollNo],
    queryFn: () => api.get(`/api/students/command-center/${rollNo}`),
    enabled: !!rollNo,
  });

  const intelligence = useMemo(() => {
    if (!user || !performance) return null;
    return buildStudentIntelligence(user, performance);
  }, [user, performance]);

  // Mutations
  const syncMutation = useMutation({
    mutationFn: (dob) => api.post(`/api/students/scrape/${rollNo}?dob=${dob}`),
    onSuccess: (data) => {
      localStorage.setItem('syncDob', syncDob);
      queryClient.invalidateQueries(['performance', rollNo]);
      queryClient.invalidateQueries(['student-command-center', rollNo]);
      setShowSyncModal(false);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.patch('/api/auth/me', data),
    onSuccess: (data) => {
      updateUser(data);
      queryClient.invalidateQueries(['me']);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data) => api.post('/api/auth/me/password', data),
  });

  // Derived Data
  const marks = performance?.marks || [];
  const filteredMarks = useMemo(() => marks.filter((mark) => {
    const matchesSearch = `${mark.subject?.course_code} ${mark.subject?.name}`.toLowerCase().includes(searchTerm.toLowerCase());
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
    return [...filteredMarks].sort((a, b) => {
      const valA = getter(a);
      const valB = getter(b);
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredMarks, sortBy, sortDir]);

  const gradeDistribution = useMemo(() => {
    const dist = {};
    marks.forEach(m => {
      dist[m.grade] = (dist[m.grade] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [marks]);

  if (loadingPerf || loadingCommandCenter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-muted-foreground animate-pulse">Initializing Intelligence Pulse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-premium pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles size={14} /> SPARK Student Dashboard
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            Welcome, <span className="text-gradient">{user?.name || 'Academic'}</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            {user?.program_name} • Batch {user?.batch} • Roll No: <span className="text-foreground font-semibold">{rollNo}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSyncModal(true)}
            disabled={syncMutation.isPending}
            className="btn-primary"
          >
            {syncMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            <span>Sync Records</span>
          </button>
          <button onClick={logout} className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-muted-foreground">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-2xl w-fit mb-8">
        {['Overview', 'Performance', 'Profile', 'Security'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === tab 
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="bento-grid">
          {/* Intelligence Spotlight */}
          <div className="bento-card col-span-12 lg:col-span-8 flex flex-col justify-between">
            <div>
              <SectionTitle 
                eyebrow="Intelligence Pulse" 
                title="Academic Insight" 
                copy="Automated observations across your semester trajectory."
              />
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary h-fit">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Predicted Path</h4>
                    <p className="text-sm text-muted-foreground mb-2">Estimated CGPA for next cycle:</p>
                    <span className="text-2xl font-black text-primary">{num(intelligence?.predictedGpa)}</span>
                  </div>
                </div>
                <div className={`p-5 rounded-2xl border flex gap-4 ${
                  intelligence?.riskLevel === 'Low' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'
                }`}>
                  <div className={`p-3 rounded-xl h-fit ${
                    intelligence?.riskLevel === 'Low' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {intelligence?.riskLevel === 'Low' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Risk Assessment</h4>
                    <p className="text-sm text-muted-foreground mb-2">{commandCenter?.risk?.risk_level || intelligence?.riskLevel} Intensity | Index: {commandCenter?.risk?.risk_score || intelligence?.riskScore}</p>
                    <p className="text-xs font-medium text-muted-foreground">{intelligence?.reasons[0] || 'Clear trajectory maintained.'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-border/50">
              <div className="flex items-center justify-between mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                <span>Placement Readiness</span>
                <span>{intelligence?.placementReadiness}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden p-0.5 ring-1 ring-border">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_-2px_rgba(var(--primary-rgb),0.5)]"
                  style={{ width: `${intelligence?.placementReadiness}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 italic">Calculated via CGPA stability, attendance thresholds, and technical breadth.</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-4">
            <StatCard icon={Award} label="Avg Grade Points" value={num(commandCenter?.analytics?.average_grade_points ?? intelligence?.averageGpa)} accent="#6366f1" subValue="Current CGPA" trend={commandCenter?.metrics?.[0]?.trend ?? 0} />
            <StatCard icon={Calendar} label="Attendance" value={`${fmt(commandCenter?.analytics?.attendance?.percentage ?? intelligence?.attendance)}%`} accent="#ec4899" />
            <StatCard icon={BadgeAlert} label="Active Backlogs" value={fmt(commandCenter?.analytics?.total_backlogs ?? intelligence?.failCount, '0')} accent="#f59e0b" />
            <StatCard icon={TrendingUp} label="Performance" value={intelligence?.trendDirection.toUpperCase()} accent="#10b981" subValue={`Rank ${commandCenter?.class_rank || user?.rank || '-'}`} />
          </div>

          {/* Charts Row */}
          <div className="bento-card col-span-12 lg:col-span-7">
            <SectionTitle title="Performance Timeline" copy="Semester-wise GPA trajectory and historical growth." />
            <div className="h-80 w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={intelligence?.semesterTrend}>
                  <defs>
                    <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsla(var(--border), 0.3)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} domain={[0, 10]} />
                  <Tooltip 
                    contentStyle={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)', boxShadow: '0 8px 16px -4px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: '600' }}
                  />
                  <Area type="monotone" dataKey="averageGradePoints" name="GPA" stroke="var(--primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorGpa)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bento-card col-span-12 lg:col-span-5">
            <SectionTitle title="Assessment Mastery" copy="Consistency across technical internal evaluations." />
            <div className="h-80 w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marks.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsla(var(--border), 0.3)" />
                  <XAxis dataKey="subject.course_code" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <Tooltip 
                    contentStyle={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}
                  />
                  <Bar dataKey="internal_marks" name="Internal Marks" radius={[6, 6, 0, 0]} fill="var(--primary)">
                    {marks.slice(-6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.internal_marks >= 40 ? 'var(--primary)' : 'var(--destructive)'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bento-card col-span-12 lg:col-span-6">
            <SectionTitle title="Recommended Actions" copy="Priority steps generated from your current academic signals." />
            <div className="space-y-3 mt-6">
              {commandCenter?.recommended_actions?.map((action) => (
                <div key={action.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card/60 p-4">
                  <div className={`mt-0.5 rounded-xl p-2 ${
                    action.tone === 'critical'
                      ? 'bg-destructive/10 text-destructive'
                      : action.tone === 'warning'
                        ? 'bg-amber-500/10 text-amber-500'
                        : action.tone === 'positive'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-primary/10 text-primary'
                  }`}>
                    {action.tone === 'critical' ? <AlertTriangle size={16} /> : action.tone === 'positive' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{action.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{action.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card col-span-12 lg:col-span-6">
            <SectionTitle title="Recent Result Flow" copy="Latest result entries and attempt history." />
            <div className="space-y-3 mt-6">
              {commandCenter?.recent_results?.slice(0, 6).map((item, index) => (
                <div key={`${item.subject_code || 'subject'}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-4">
                  <div>
                    <p className="text-sm font-bold">{item.subject_title || item.subject_code}</p>
                    <p className="text-xs text-muted-foreground">Sem {item.semester || '-'} | Attempt {item.attempt || 1}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right text-xs">
                    <div>
                      <p className="font-black">{fmt(item.grade)}</p>
                      <p className="text-muted-foreground">Grade</p>
                    </div>
                    <div>
                      <p className="font-black">{fmt(item.internal_marks)}</p>
                      <p className="text-muted-foreground">Internal</p>
                    </div>
                    <div>
                      <p className="font-black">{fmt(item.marks)}</p>
                      <p className="text-muted-foreground">Marks</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card col-span-12 lg:col-span-6">
            <SectionTitle title="Semester Focus" copy="Your most recent semester snapshots." />
            <div className="space-y-3 mt-6">
              {commandCenter?.semester_focus?.map((item) => (
                <div key={item.semester} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-4">
                  <div>
                    <p className="text-sm font-bold">Semester {item.semester}</p>
                    <p className="text-xs text-muted-foreground">{item.subject_count} subjects | {item.backlog_count} backlog(s)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-right text-xs">
                    <div>
                      <p className="font-black">{num(item.average_grade_points)}</p>
                      <p className="text-muted-foreground">SGPA</p>
                    </div>
                    <div>
                      <p className="font-black">{num(item.average_internal)}</p>
                      <p className="text-muted-foreground">Internal Avg</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card col-span-12 lg:col-span-6">
            <SectionTitle title="Record Health" copy="Keep your record complete for reviews, scholarships, and placements." />
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-center justify-between text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  <span>Profile Completion</span>
                  <span>{commandCenter?.record_health?.completion_percentage ?? 0}%</span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${commandCenter?.record_health?.completion_percentage ?? 0}%` }} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Available</p>
                  <p className="mt-3 text-sm">{commandCenter?.record_health?.available_sections?.join(', ') || 'No sections yet'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Missing</p>
                  <p className="mt-3 text-sm">{commandCenter?.record_health?.missing_sections?.join(', ') || 'No gaps detected'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Performance' && (
        <div className="space-y-6">
          <div className="bento-card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <SectionTitle title="Subject Repository" copy="Full academic record with advanced filtering and drill-down." />
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                  <input 
                    className="pl-10 pr-4 py-2 bg-muted/50 rounded-xl border border-border focus:ring-2 ring-primary/20 outline-none transition-all w-64"
                    placeholder="Search subject..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
                <select className="px-4 py-2 bg-muted/50 rounded-xl border border-border outline-none text-sm" value={semFilter} onChange={(e) => setSemFilter(e.target.value)}>
                  <option value="ALL">All Semesters</option>
                  {[...new Set(marks.map(m => String(m.semester)))].sort().map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
                <select className="px-4 py-2 bg-muted/50 rounded-xl border border-border outline-none text-sm" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                  <option value="ALL">All Grades</option>
                  {[...new Set(marks.map(m => m.grade))].filter(Boolean).sort().map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/30">
                    <SortHeader label="Code" field="code" currentSort={sortBy} currentDir={sortDir} onSort={setSortBy} />
                    <SortHeader label="Subject" field="subject" currentSort={sortBy} currentDir={sortDir} onSort={setSortBy} />
                    <SortHeader label="Sem" field="semester" currentSort={sortBy} currentDir={sortDir} onSort={setSortBy} />
                    <SortHeader label="Grade" field="grade" currentSort={sortBy} currentDir={sortDir} onSort={setSortBy} />
                    <SortHeader label="Internal" field="internal" currentSort={sortBy} currentDir={sortDir} onSort={setSortBy} />
                    <SortHeader label="Total" field="total" currentSort={sortBy} currentDir={sortDir} onSort={setSortBy} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedMarks.map((mark) => (
                    <tr key={mark.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-4 font-mono font-bold text-primary">{mark.subject?.course_code}</td>
                      <td className="px-4 py-4 font-medium">{mark.subject?.name}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded-md bg-muted text-xs font-bold text-muted-foreground">Sem {mark.semester}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-black ${['U', 'F', 'FAIL'].includes(mark.grade) ? 'text-destructive' : 'text-foreground'}`}>
                          {mark.grade || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{mark.internal_marks || '-'}</td>
                      <td className="px-4 py-4 font-bold">{mark.total_marks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bento-card">
              <SectionTitle title="Subject Mastery Distribution" />
              <div className="h-64 mt-4 text-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gradeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8}>
                      {gradeDistribution.map((entry, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '12px', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bento-card overflow-hidden">
               <SectionTitle title="Intelligence: Weak Areas" />
               <div className="space-y-3 mt-6">
                 {intelligence?.weaknesses?.length ? intelligence.weaknesses.map((w, i) => (
                   <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                     <div className="p-2 rounded-lg bg-destructive/10 text-destructive"><Info size={16} /></div>
                     <div>
                       <p className="text-sm font-bold">{w.subject_title || w.subject_code}</p>
                       <p className="text-xs text-muted-foreground">Recorded {w.grade_point} GP in Sem {w.semester}. Refinement critical.</p>
                     </div>
                   </div>
                 )) : (
                   <p className="text-muted-foreground text-sm italic">No significant academic risks detected.</p>
                 )}
               </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bento-card overflow-hidden">
              <SectionTitle title="Strength Subjects" copy="Subjects where your current signal is strongest." />
              <div className="space-y-3 mt-6">
                {commandCenter?.analytics?.strength_subjects?.map((item, index) => (
                  <div key={`${item.course_code}-${index}`} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                    <div>
                      <p className="text-sm font-bold">{item.subject}</p>
                      <p className="text-xs text-muted-foreground">{item.course_code} | Sem {item.semester}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{item.score}</p>
                      <p className="text-xs text-muted-foreground">Composite score</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bento-card overflow-hidden">
              <SectionTitle title="Priority Watchlist" copy="Subjects that need the earliest attention." />
              <div className="space-y-3 mt-6">
                {commandCenter?.analytics?.risk_subjects?.length ? commandCenter.analytics.risk_subjects.map((item, index) => (
                  <div key={`${item.course_code}-${index}`} className="flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                    <div>
                      <p className="text-sm font-bold">{item.subject}</p>
                      <p className="text-xs text-muted-foreground">{item.course_code} | {item.risk_reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{item.grade}</p>
                      <p className="text-xs text-muted-foreground">Grade</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-sm italic">No urgent watchlist subjects detected.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Profile' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bento-card">
            <SectionTitle title="Profile Information" copy="Update your public profile and academic identifiers." />
            <form className="mt-8 space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              updateProfileMutation.mutate(Object.fromEntries(formData));
            }}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Full Name</label>
                  <input name="name" className="input-field w-full" defaultValue={user?.name} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Email Address</label>
                  <input name="email" type="email" className="input-field w-full" defaultValue={user?.email} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Batch</label>
                  <input name="batch" className="input-field w-full" defaultValue={user?.batch} />
                </div>
              </div>
              <button type="submit" disabled={updateProfileMutation.isPending} className="btn-primary w-fit">
                {updateProfileMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                <span>Save Profile Changes</span>
              </button>
            </form>
          </div>
          <div className="bento-card">
            <SectionTitle title="Account Status" />
            <div className="mt-8 space-y-4">
              <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">Reg Number</span>
                <span className="font-bold">{user?.reg_no || '-'}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">Program</span>
                <span className="font-bold">{user?.program_name || '-'}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">Current Sem</span>
                <span className="font-bold">{user?.current_semester || '-'}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">Class Rank</span>
                <span className="font-bold">{commandCenter?.class_rank || user?.rank || '-'}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-muted-foreground">Risk Level</span>
                <span className="font-bold">{commandCenter?.risk?.risk_level || intelligence?.riskLevel || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Security' && (
        <div className="max-w-2xl mx-auto bento-card">
          <SectionTitle title="Security Protocols" copy="Maintain the integrity of your academic command center." />
          <form className="mt-8 space-y-6" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            if (data.new_password !== data.confirm_password) return alert('Passwords do not match');
            changePasswordMutation.mutate(data);
          }}>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground">Current Password</label>
              <input name="current_password" type="password" className="input-field w-full" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground">New Password</label>
              <input name="new_password" type="password" className="input-field w-full" required minLength={6} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground">Confirm New Password</label>
              <input name="confirm_password" type="password" className="input-field w-full" required />
            </div>
            <button type="submit" disabled={changePasswordMutation.isPending} className="btn-primary w-full justify-center">
              {changePasswordMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
              <span>Update Security Access</span>
            </button>
            {changePasswordMutation.isSuccess && <p className="text-emerald-500 text-center text-sm font-bold">Access updated successfully.</p>}
          </form>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowSyncModal(false)} />
          <div className="bento-card max-w-md w-full relative z-10 shadow-2xl ring-1 ring-border animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Shield className="text-primary" size={24} /> Verify Identity
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your Date of Birth (DDMMYYYY) to authenticate with external records for roll <span className="text-foreground font-bold">{rollNo}</span>.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              syncMutation.mutate(syncDob);
            }}>
              <input 
                autoFocus
                className="input-field w-full text-center text-xl font-mono tracking-widest mb-6"
                placeholder="DDMMYYYY"
                maxLength={8}
                value={syncDob}
                onChange={(e) => setSyncDob(e.target.value.replace(/\D/g, ''))}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSyncModal(false)} className="flex-1 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted font-bold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={syncMutation.isPending} className="flex-1 btn-primary justify-center">
                  {syncMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <span>Verify & Sync</span>}
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
