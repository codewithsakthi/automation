import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { AlertTriangle, ArrowUp, BadgeCheck, Download, RefreshCw, ShieldAlert, Target, Trophy, Users, Zap, ChevronRight, Search } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import StudentProfile360 from '../components/StudentProfile360';
import type {
  AdminCohortAction,
  AdminCommandCenterResponse,
  AdminDirectoryPage,
  PlacementCandidate,
  RiskRegistryResponse,
  SpotlightResult,
  SubjectCatalogItem,
  SubjectLeaderboardResponse,
} from '../types/enterprise';

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="metric-card">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </article>
  );
}

function StudentStrip({ item, onOpen }: { item: any; onOpen: (rollNo: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.roll_no)} className="row-card w-full text-left group">
      <div>
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.roll_no} | Sem {item.current_semester || '-'} | Batch {item.batch || '-'}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-right text-xs">
        <div>
          <p className="font-black text-foreground">{item.average_grade_points}</p>
          <p className="text-muted-foreground">GPA</p>
        </div>
        <div>
          <p className="font-black text-foreground">{item.attendance_percentage}%</p>
          <p className="text-muted-foreground">Attn</p>
        </div>
        <div>
          <p className={`font-black ${item.backlogs > 0 ? 'text-rose-600' : 'text-foreground'}`}>{item.backlogs}</p>
          <p className="text-muted-foreground">Backlogs</p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({ item }: { item: AdminCohortAction }) {
  const toneClass =
    item.tone === 'critical'
      ? 'bg-rose-500/12 text-rose-700'
      : item.tone === 'warning'
        ? 'bg-amber-500/12 text-amber-700'
        : item.tone === 'positive'
          ? 'bg-emerald-500/12 text-emerald-700'
          : 'bg-slate-500/12 text-slate-700';

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${toneClass}`}>{item.tone}</span>
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-primary">{item.metric}</p>
    </div>
  );
}

function exportWithToken(path: string, filename: string) {
  const token = localStorage.getItem('auth-storage');
  const parsed = token ? JSON.parse(token) : null;
  const accessToken = parsed?.state?.token;
  
  return fetch(`${api.defaults.baseURL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch((error) => console.error('Export error:', error));
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'Overview';
  const urlRollNo = searchParams.get('rollNo');
  const queryClient = useQueryClient();

  const assignSectionsMutation = useMutation({
    mutationFn: async (batch: string) => {
      const response = await api.post(`admin/assign-sections?batch=${encodeURIComponent(batch)}`);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Sections assigned:', data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-students-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-command-center'] });
    },
  });

  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedRollNo, setSelectedRollNo] = useState<string | null>(null);

  // Scroll to anchor on activeTab changes or direct link clicks
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && activeTab === 'Overview') {
      const element = document.getElementById(hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  const scrollToAnchor = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  const [placementSearch, setPlacementSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOffset, setStudentOffset] = useState(0);
  const [studentSemesterFilter, setStudentSemesterFilter] = useState<string>('ALL');
  const [studentBatchFilter, setStudentBatchFilter] = useState<string>('ALL');
  const [studentSectionFilter, setStudentSectionFilter] = useState<string>('ALL');
  const [studentRiskOnly, setStudentRiskOnly] = useState(false);
  const [studentSortBy, setStudentSortBy] = useState<'rank' | 'name' | 'roll_no'>('rank');
  const [studentSortDir, setStudentSortDir] = useState<'asc' | 'desc'>('asc');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'cgpa', desc: true }]);
  const [riskLevel, setRiskLevel] = useState<'Critical' | 'High' | 'Moderate' | 'Low' | ''>('Critical');

  // Sync selectedRollNo with URL for spotlight search
  useEffect(() => {
    if (urlRollNo) {
      setSelectedRollNo(urlRollNo);
    }
  }, [urlRollNo]);

  const handleCloseProfile = () => {
    setSelectedRollNo(null);
    if (urlRollNo) {
      const params = new URLSearchParams(searchParams);
      params.delete('rollNo');
      setSearchParams(params);
    }
  };

  const { data, isLoading, refetch, isFetching } = useQuery<AdminCommandCenterResponse>({
    queryKey: ['admin-command-center'],
    queryFn: () => api.get('admin/command-center'),
    staleTime: 60_000,
  });



  const { data: riskRegistry } = useQuery<RiskRegistryResponse>({
    queryKey: ['admin-risk-registry', riskLevel],
    queryFn: () => api.get(`admin/risk/registry?level=${riskLevel}`),
    staleTime: 30_000,
  });

  const { data: studentDirectory, isFetching: isStudentsFetching } = useQuery<AdminDirectoryPage>({
    queryKey: ['admin-students-paginated', studentSearch, studentOffset, studentSemesterFilter, studentBatchFilter, studentSectionFilter, studentRiskOnly, studentSortBy, studentSortDir],
    queryFn: () =>
      api.get(
        `admin/students/paginated?limit=10&offset=${studentOffset}&sort_by=${studentSortBy}&sort_dir=${studentSortDir}${studentSearch ? `&search=${encodeURIComponent(studentSearch)}` : ''}${studentSemesterFilter !== 'ALL' ? `&semester=${studentSemesterFilter}` : ''}${studentBatchFilter !== 'ALL' ? `&batch=${encodeURIComponent(studentBatchFilter)}` : ''}${studentSectionFilter !== 'ALL' ? `&section=${encodeURIComponent(studentSectionFilter)}` : ''}${studentRiskOnly ? '&risk_only=true' : ''}`,
      ),
    staleTime: 30_000,
  });

  const { data: leaderboard } = useQuery<SubjectLeaderboardResponse>({
    queryKey: ['admin-subject-leaderboard', selectedSubjectCode],
    queryFn: () => api.get(`admin/subject-leaderboard/${selectedSubjectCode}`),
    enabled: !!selectedSubjectCode,
    staleTime: 30_000,
  });

  // Subject catalog comes from the command-center bundle — no separate request needed
  const subjectCatalog = data?.subject_catalog;

  const semesterOptions = useMemo(() => {
    if (!subjectCatalog) return [];
    return Array.from(new Set(subjectCatalog.map((s) => s.semester).filter((s): s is number => s != null))).sort((a, b) => a - b);
  }, [subjectCatalog]);

  const filteredSubjects = useMemo(() => {
    if (!subjectCatalog) return [];
    if (selectedSemester === 'ALL') return subjectCatalog;
    return subjectCatalog.filter((s) => String(s.semester) === selectedSemester);
  }, [subjectCatalog, selectedSemester]);

  useEffect(() => {
    if (filteredSubjects.length > 0 && !selectedSubjectCode) {
      setSelectedSubjectCode(filteredSubjects[0].subject_code);
    }
  }, [filteredSubjects, selectedSubjectCode]);

  const columns = useMemo<ColumnDef<PlacementCandidate>[]>(() => [
    { accessorKey: 'student_name', header: 'Student' },
    { accessorKey: 'batch', header: 'Batch' },
    { accessorKey: 'cgpa', header: 'CGPA' },
    { accessorKey: 'coding_subject_score', header: 'Coding Score' },
    {
      accessorKey: 'placement_ready',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
          row.original.placement_ready ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600'
        }`}>
          {row.original.placement_ready ? 'Ready' : 'In Progress'}
        </span>
      ),
    },
  ], []);

  const table = useReactTable({
    data: data?.placement_ready || [],
    columns,
    state: { sorting, globalFilter: placementSearch },
    onSortingChange: setSorting,
    onGlobalFilterChange: setPlacementSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // grade letter → 0-100 score (matches backend GRADE_POINT_CASE * 10)
  const gradeToScore = (grade?: string | null): number => {
    const g = (grade ?? '').toUpperCase();
    const map: Record<string, number> = { O: 100, S: 100, 'A+': 90, A: 80, 'B+': 70, B: 60, C: 50, D: 40, E: 30, P: 50, PASS: 50 };
    return map[g] ?? 0;
  };

  // Best available score: total_marks > internal_marks > grade-derived
  const bestScore = (s: { total_marks: number; internal_marks: number; grade?: string | null }) =>
    s.total_marks > 0 ? { value: s.total_marks, label: 'marks' }
    : s.internal_marks > 0 ? { value: s.internal_marks, label: 'internals' }
    : { value: gradeToScore(s.grade), label: 'grade pts' };

  const leaderboardSpread = useMemo(() => {
    if (!leaderboard) return [];
    return [
      ...leaderboard.top_leaderboard.map((s) => ({ student: s.student_name.split(' ')[0], marks: bestScore(s).value })),
      ...leaderboard.bottom_leaderboard.map((s) => ({ student: s.student_name.split(' ')[0], marks: bestScore(s).value })),
    ];
  }, [leaderboard]);

  const studentPageCount = studentDirectory ? Math.ceil(studentDirectory.pagination.total / studentDirectory.pagination.limit) : 0;
  const currentStudentPage = studentDirectory ? Math.floor(studentDirectory.pagination.offset / studentDirectory.pagination.limit) + 1 : 1;

  const batchOptions = useMemo(() => {
    if (!data?.batch_health) return [];
    return data.batch_health.map((b: any) => b.batch);
  }, [data?.batch_health]);

  const toggleSort = (field: 'rank' | 'name' | 'roll_no') => {
    if (studentSortBy === field) {
      setStudentSortDir(studentSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setStudentSortBy(field);
      setStudentSortDir('asc');
    }
  };

  return (
    <div className="w-full pb-24 lg:pb-10">
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <header className="hero-panel">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Enterprise Academic Intelligence</p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                SPARK Command Center
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                {data?.daily_briefing || 'Aggregating ranking, placement, bottleneck, and faculty impact signals.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="hero-button" onClick={() => exportWithToken('admin/exports/batch-summary.xlsx', 'mca-batch-summary.xlsx')}>
                <Download size={16} />
                Excel Summary
              </button>
              <button type="button" className="hero-button" onClick={() => refetch()}>
                <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </header>

          <section id="command-center" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-[1.75rem]" />)
            ) : (
              <>
                <Metric label="Health Score" value={`${data?.department_health.overall_health_score ?? 0}%`} hint="Composite derived from GPA and attendance." />
                <Metric label="Active Students" value={String(data?.department_health.active_students ?? 0)} hint="Current MCA population." />
                <Metric label="At Risk" value={String(data?.department_health.at_risk_count ?? 0)} hint="Students above intervention threshold." />
                <Metric label="Average GPA" value={String(data?.department_health.average_gpa ?? 0)} hint="Current department CGPA." />
              </>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article id="risk-radar" className="panel">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">Risk Segmentation</p>
                  <p className="text-sm text-muted-foreground">Strategic grouping of the cohort by risk status.</p>
                </div>
                <ShieldAlert size={18} className="text-primary" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Critical" value={String(data?.risk_summary.critical ?? 0)} hint="Immediate action." />
                <Metric label="High" value={String(data?.risk_summary.high ?? 0)} hint="Escalation pending." />
                <Metric label="Moderate" value={String(data?.risk_summary.moderate ?? 0)} hint="Monitor closely." />
                <Metric label="Low" value={String(data?.risk_summary.low ?? 0)} hint="Stable monitoring." />
              </div>
            </article>

            <article id="placement-pipeline" className="panel">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">Placement Pipeline</p>
                  <p className="text-sm text-muted-foreground">Ready and blocked cohorts for recruiter planning.</p>
                </div>
                <Target size={18} className="text-primary" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Ready" value={String(data?.placement_summary.ready_count ?? 0)} hint="Drive eligible." />
                <Metric label="Almost" value={String(data?.placement_summary.almost_ready_count ?? 0)} hint="Near threshold." />
                <Metric label="Blocked" value={String(data?.placement_summary.blocked_count ?? 0)} hint="Arrears/low GPA." />
                <Metric label="Avg Code" value={String(data?.placement_summary.avg_coding_score ?? 0)} hint="Coding subject avg." />
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
             <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">HOD Action Queue</p>
                <p className="text-sm text-muted-foreground">Critical interventions pending your approval.</p>
              </div>
              <div className="space-y-3">
                {data?.action_queue?.map((item: AdminCohortAction, i: number) => (
                  <ActionCard key={i} item={item} />
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Command Alerts</p>
                <p className="text-sm text-muted-foreground">System notifications and anomaly detections.</p>
              </div>
              <div className="space-y-3">
                {data?.alerts?.map((alert: string, i: number) => (
                  <div key={i} className="row-card">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-rose-500/10 p-2 text-rose-500">
                        <AlertTriangle size={16} />
                      </div>
                      <p className="text-sm text-foreground">{alert}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Trendline Analysis</p>
                <p className="text-sm text-muted-foreground">Overall department performance trajectory.</p>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(data?.department_health?.semester_trends as any[]) || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="panel">
              <p className="text-lg font-semibold text-foreground">Batch Health</p>
              <div className="mt-4 space-y-3">
                {data?.batch_health?.map((batch: any) => (
                  <div key={batch.batch} className="row-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Batch {batch.batch}</p>
                      <p className="text-xs text-muted-foreground">{batch.student_count} students | {batch.at_risk_count} at risk</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{batch.average_gpa} GPA</p>
                      <p className="text-xs text-muted-foreground">{batch.average_attendance}% Attn</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <p className="text-lg font-semibold text-foreground">Semester Pulse</p>
              <div className="mt-4 space-y-3">
                {data?.semester_pulse?.map((pulse: any) => (
                  <div key={pulse.semester} className="row-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Semester {pulse.semester}</p>
                      <p className="text-xs text-muted-foreground">{pulse.student_count} enrollment | {pulse.at_risk_count} flagging</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{pulse.average_gpa} avg</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      )}

      {activeTab === 'Performance' && (
        <div className="space-y-6">
          <article className="panel">
            <div className="mb-4">
              <p className="text-lg font-semibold text-foreground">Hardest Subjects (Bottlenecks)</p>
              <p className="text-sm text-muted-foreground">Failure rates vs long-term averages.</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.bottlenecks || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis 
                    dataKey="subject_name" 
                    interval={0} 
                    angle={-15} 
                    textAnchor="end" 
                    height={60}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="failure_rate" fill="var(--chart-3)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article id="leaderboard" className="panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">Subject Leaderboard Engine</p>
                <p className="text-sm text-muted-foreground">Comparative performance analysis by subject.</p>
              </div>
              <div className="flex gap-2">
                <select className="input-field !py-2" value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
                  <option value="ALL">All Semesters</option>
                  {semesterOptions.map(s => <option key={s} value={String(s)}>Sem {s}</option>)}
                </select>
                <select className="input-field !py-2" value={selectedSubjectCode} onChange={(e) => setSelectedSubjectCode(e.target.value)}>
                  {filteredSubjects.map(s => <option key={s.subject_code} value={s.subject_code}>{s.subject_name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Top Toppers</p>
                <div className="space-y-2">
                  {leaderboard?.top_leaderboard.map(e => {
                    const { value, label } = bestScore(e);
                    return (
                      <button key={e.roll_no} onClick={() => setSelectedRollNo(e.roll_no)} className="row-card w-full text-left">
                        <div>
                          <p className="text-sm font-semibold">{e.student_name}</p>
                          {e.grade && <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Grade: {e.grade}</p>}
                        </div>
                        <span className="text-xs font-bold text-primary">
                          {value > 0 ? value : '—'}{' '}
                          {value > 0 && <span className="font-normal text-muted-foreground">{label}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Scoring Distribution</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leaderboardSpread}>
                      <Bar dataKey="marks" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-lg font-semibold text-foreground">Subject Coverage Map</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data?.subject_coverage?.map(item => (
                <div key={item.semester} className="row-card">
                  <p className="text-sm font-bold">Sem {item.semester}</p>
                  <p className="text-xs text-muted-foreground">{item.ranked_subjects}/{item.total_subjects} Ranked</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}

      {activeTab === 'Students' && (
        <div className="space-y-6">
          <article className="panel">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">Student Management</p>
                <p className="text-sm text-muted-foreground">Full cohort directory with advanced sorting and batch filters.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="input-field !py-2 pl-9 !w-64"
                    placeholder="Search name, roll, email..."
                  />
                </div>
                <select className="input-field !py-2" value={studentBatchFilter} onChange={(e) => setStudentBatchFilter(e.target.value)}>
                  <option value="ALL">All Batches</option>
                  {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select className="input-field !py-2" value={studentSemesterFilter} onChange={(e) => setStudentSemesterFilter(e.target.value)}>
                  <option value="ALL">All Semesters</option>
                  {semesterOptions.map(s => <option key={s} value={String(s)}>Sem {s}</option>)}
                </select>
                <select className="input-field !py-2" value={studentSectionFilter} onChange={(e) => setStudentSectionFilter(e.target.value)}>
                  <option value="ALL">All Secs</option>
                  <option value="A">Sec A</option>
                  <option value="B">Sec B</option>
                </select>
                <button 
                  onClick={() => setStudentRiskOnly(!studentRiskOnly)}
                  className={`tab-chip ${studentRiskOnly ? '!bg-rose-500 !text-white' : ''}`}
                >
                  Risk Only
                </button>
                <button
                  onClick={() => {
                    const batch = studentBatchFilter !== 'ALL' ? studentBatchFilter : '2025-2027';
                    assignSectionsMutation.mutate(batch);
                  }}
                  disabled={assignSectionsMutation.isPending}
                  className="tab-chip !bg-primary !text-primary-foreground disabled:opacity-50"
                  title="Assign Sections A and B"
                >
                  {assignSectionsMutation.isPending ? 'Assigning...' : 'Assign Sections'}
                </button>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {[
                      { key: 'rank', label: 'Rank' },
                      { key: 'name', label: 'Name' },
                      { key: 'roll_no', label: 'Roll No' },
                      { key: 'batch', label: 'Batch' },
                      { key: 'section', label: 'Sec' },
                      { key: 'sem', label: 'Sem' },
                      { key: 'gpa', label: 'GPA' },
                      { key: 'attendance', label: 'Attn %' },
                      { key: 'backlogs', label: 'Backlogs' }
                    ].map(col => (
                      <th key={col.key} className="px-4 py-3 text-left">
                        <button 
                          onClick={() => ['rank', 'name', 'roll_no'].includes(col.key) && toggleSort(col.key as any)}
                          className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${['rank', 'name', 'roll_no'].includes(col.key) ? 'hover:text-primary transition-colors' : 'text-muted-foreground'}`}
                        >
                          {col.label}
                          {studentSortBy === col.key && (
                            <span className="text-primary">{studentSortDir === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isStudentsFetching ? (
                    Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-4 py-8"><div className="skeleton h-8 w-full" /></td></tr>)
                  ) : studentDirectory?.items.map(item => (
                    <tr key={item.roll_no} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 font-mono font-bold text-primary">#{item.rank || '-'}</td>
                      <td className="px-4 py-4">
                        <button onClick={() => setSelectedRollNo(item.roll_no)} className="text-left group">
                          <p className="font-semibold group-hover:text-primary">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{item.email?.split('@')[0]}</p>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <div>{item.roll_no}</div>
                        {item.reg_no && <div className="text-[10px] opacity-70">Reg: {item.reg_no}</div>}
                      </td>
                      <td className="px-4 py-4"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{item.batch}</span></td>
                      <td className="px-4 py-4 text-muted-foreground">{item.section || '-'}</td>
                      <td className="px-4 py-4 text-muted-foreground">{item.current_semester}</td>
                      <td className="px-4 py-4 font-bold">{Number(item.average_grade_points).toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <span className={`font-medium ${item.attendance_percentage < 75 ? 'text-rose-500' : 'text-emerald-500'}`}>{Number(item.attendance_percentage).toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-4">
                         <span className={`font-bold ${item.backlogs > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>{item.backlogs}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="grid gap-3 sm:hidden">
              {isStudentsFetching ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)
              ) : studentDirectory?.items.map(item => (
                <button
                  key={`m-${item.roll_no}`}
                  onClick={() => setSelectedRollNo(item.roll_no)}
                  className="row-card w-full text-left group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">#{item.rank || '-'}</span>
                      <p className="truncate font-semibold group-hover:text-primary transition-colors">{item.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.roll_no}{item.reg_no ? ` / Reg: ${item.reg_no}` : ''} · Sem {item.current_semester} · <span className="rounded-full bg-muted px-1.5 py-0.5">{item.batch}</span> · Sec {item.section || '-'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    <span className="font-bold">{Number(item.average_grade_points).toFixed(2)} GPA</span>
                    <span className={`font-medium ${item.attendance_percentage < 75 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {Number(item.attendance_percentage).toFixed(1)}% Attn
                    </span>
                    {item.backlogs > 0 && <span className="font-bold text-rose-500">{item.backlogs} backlogs</span>}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted-foreground tracking-wide">
                Showing {studentDirectory?.items.length || 0} of {studentDirectory?.pagination.total || 0} total students
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={studentOffset === 0} 
                  onClick={() => setStudentOffset(o => Math.max(0, o - 10))}
                  className="tab-chip disabled:opacity-30"
                >
                  Previous
                </button>
                <button 
                  disabled={!studentDirectory || studentOffset + 10 >= studentDirectory.pagination.total} 
                  onClick={() => setStudentOffset(o => o + 10)}
                  className="tab-chip disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'Attendance' && (
        <div className="space-y-6">
          <article className="panel">
            <div className="mb-6">
              <p className="text-lg font-semibold text-foreground">Attendance Insight</p>
              <p className="text-sm text-muted-foreground">Department-wide attendance tracking and defaulter analysis.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Metric label="Avg Attendance" value={Number(data?.department_health?.average_attendance || 0).toFixed(1) + '%'} hint="Rollup across all batches" />
              <Metric label="Defaulters" value={String(data?.attendance_defaulters?.length || 0)} hint="Students below 75%" />
              <Metric label="Peak Absences" value="Mon-Fri" hint="Historical peak window" />
              <Metric label="Stability" value="92%" hint="Trend consistency" />
            </div>
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sub-75% Defaulter Review</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data?.attendance_defaulters?.map(item => (
                  <StudentStrip key={item.roll_no} item={item} onOpen={setSelectedRollNo} />
                ))}
              </div>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'Security' && (
        <div className="space-y-6">
          <article className="panel">
            <div className="mb-6">
              <p className="text-lg font-semibold text-foreground">Security & Access</p>
              <p className="text-sm text-muted-foreground">Monitor system access, initial password status, and account security.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-6">
                <p className="text-sm font-bold text-foreground mb-4">Initial Passwords</p>
                <div className="space-y-3">
                  {studentDirectory?.items.filter(s => s.is_initial_password).slice(0, 5).map(s => (
                    <div key={s.roll_no} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{s.roll_no}</span>
                      <span className="text-rose-500 font-bold">Unchanged</span>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-[10px] text-muted-foreground uppercase tracking-widest">Action recommended for {studentDirectory?.items.filter(s => s.is_initial_password).length || 0} students</p>
              </div>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'Profile' && (
        <div className="space-y-6">
          <article className="panel">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Users size={32} />
              </div>
              <p className="text-lg font-semibold text-foreground">Admin Profile Settings</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">Manage your administrative credentials and notification preferences.</p>
              <button className="btn-primary mt-8">Update Credentials</button>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'Placements' && (
        <div className="space-y-6">
          <article className="panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">Placement Readiness Engine</p>
                <p className="text-sm text-muted-foreground">Detailed candidate mapping for upcoming drives.</p>
              </div>
              <input
                value={placementSearch}
                onChange={(e) => setPlacementSearch(e.target.value)}
                className="input-field !py-2 !w-64"
                placeholder="Filter candidates..."
              />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Candidate</th>
                    <th className="px-4 py-3 text-left">CGPA</th>
                    <th className="px-4 py-3 text-left">Coding</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => {
                    const d = row.original as any;
                    return (
                      <tr key={row.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <button onClick={() => setSelectedRollNo(d.roll_no)} className="text-left group">
                            <p className="font-semibold group-hover:text-primary">{d.student_name || d.name}</p>
                            <p className="text-[10px] text-muted-foreground">{d.roll_no} | {d.batch}</p>
                          </button>
                        </td>
                        <td className="px-4 py-4 font-bold">{d.cgpa}</td>
                        <td className="px-4 py-4 text-muted-foreground">{d.coding_score}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${d.status === 'Ready' || d.placement_ready ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600'}`}>
                            {d.status || (d.placement_ready ? 'Ready' : 'In Progress')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`risk-badge risk-${(d.risk_level || 'low').toLowerCase()}`}>{d.risk_level || 'Low'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {/* Profile Modal */}
      <StudentProfile360 rollNo={selectedRollNo} onClose={handleCloseProfile} />
    </div>
  );
}
