import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { AlertTriangle, ArrowUp, BadgeCheck, Download, RefreshCw, ShieldAlert, Target, Trophy, Users, Zap } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import ThemeToggle from '../components/ThemeToggle';
import SpotlightSearch from '../components/SpotlightSearch';
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

// Prob drilling removed in favor of Zustand stores

// API_BASE removed - using standardized axios instance

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
    <button type="button" onClick={() => onOpen(item.roll_no)} className="row-card w-full text-left">
      <div>
        <p className="text-sm font-semibold text-foreground">{item.name}</p>
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
  const token = localStorage.getItem('auth-storage'); // Adjusted for Zustand persistence
  const parsed = token ? JSON.parse(token) : null;
  const accessToken = parsed?.state?.token;
  
  return fetch(`${api.defaults.baseURL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
}

export default function AdminDashboard() {
  const { logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedRollNo, setSelectedRollNo] = useState<string | null>(null);
  const [placementSearch, setPlacementSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOffset, setStudentOffset] = useState(0);
  const [studentSemesterFilter, setStudentSemesterFilter] = useState<string>('ALL');
  const [studentRiskOnly, setStudentRiskOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'cgpa', desc: true }]);
  const [riskLevel, setRiskLevel] = useState<'Critical' | 'High' | 'Moderate' | 'Low' | ''>('Critical');

  const { data, isLoading, refetch, isFetching } = useQuery<AdminCommandCenterResponse>({
    queryKey: ['admin-command-center'],
    queryFn: () => api.get('/api/admin/command-center'),
    staleTime: 60_000,
  });

  const { data: leaderboard } = useQuery<SubjectLeaderboardResponse>({
    queryKey: ['subject-leaderboard', selectedSubjectCode],
    queryFn: () => api.get(`/api/admin/subject-leaderboard/${selectedSubjectCode}?limit=5&offset=0`),
    enabled: Boolean(selectedSubjectCode),
    staleTime: 60_000,
  });

  const { data: subjectCatalog } = useQuery<SubjectCatalogItem[]>({
    queryKey: ['subject-catalog'],
    queryFn: () => api.get('/api/admin/subject-catalog'),
    staleTime: 300_000,
  });

  const { data: riskRegistry } = useQuery<RiskRegistryResponse>({
    queryKey: ['risk-registry', riskLevel],
    queryFn: () => api.get(`/api/admin/risk-registry?limit=8&offset=0${riskLevel ? `&risk_level=${riskLevel}` : ''}`),
    staleTime: 30_000,
  });

  const { data: studentDirectory, isFetching: isStudentsFetching } = useQuery<AdminDirectoryPage>({
    queryKey: ['admin-students-paginated', studentSearch, studentOffset, studentSemesterFilter, studentRiskOnly],
    queryFn: () =>
      api.get(
        `/api/admin/students/paginated?limit=10&offset=${studentOffset}&sort_by=rank&sort_dir=asc${studentSearch ? `&search=${encodeURIComponent(studentSearch)}` : ''}${studentSemesterFilter !== 'ALL' ? `&semester=${studentSemesterFilter}` : ''}${studentRiskOnly ? '&risk_only=true' : ''}`,
      ),
    staleTime: 30_000,
  });

  const placementColumns = useMemo<ColumnDef<PlacementCandidate>[]>(
    () => [
      {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }) => (
          <button type="button" className="text-left font-semibold text-foreground" onClick={() => setSelectedRollNo(row.original.roll_no)}>
            {row.original.student_name}
          </button>
        ),
      },
      { accessorKey: 'roll_no', header: 'Roll No' },
      { accessorKey: 'cgpa', header: 'CGPA' },
      { accessorKey: 'coding_subject_score', header: 'Coding Score' },
      { accessorKey: 'attendance_percentage', header: 'Attendance' },
      {
        accessorKey: 'placement_ready',
        header: 'Ready',
        cell: ({ getValue }) => ((getValue<boolean>()) ? 'Yes' : 'No'),
      },
    ],
    [],
  );

  const placementData = data?.placement_ready ?? [];
  const table = useReactTable({
    data: placementData,
    columns: placementColumns,
    state: {
      sorting,
      globalFilter: placementSearch,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setPlacementSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const trendData = useMemo(
    () =>
      (data?.department_health.semester_trends || []).map((point) => ({
        label: `Sem ${String(point.semester ?? '')}`,
        average_gpa: Number(point.average_gpa ?? 0) * 10,
        average_attendance: Number(point.average_attendance ?? 0),
      })),
    [data],
  );

  const leaderboardSpread = useMemo(
    () => (leaderboard?.top_leaderboard || []).map((entry) => ({ student: entry.student_name.split(' ')[0], marks: entry.total_marks })),
    [leaderboard],
  );

  const onSpotlightSelect = (result: SpotlightResult) => {
    if (result.entity_type === 'student') setSelectedRollNo(result.entity_id);
    if (result.entity_type === 'subject') setSelectedSubjectCode(result.entity_id);
  };

  const semesterOptions = useMemo(() => {
    const values = new Set<number>();
    (subjectCatalog || []).forEach((subject) => {
      if (typeof subject.semester === 'number') values.add(subject.semester);
    });
    return Array.from(values).sort((a, b) => a - b);
  }, [subjectCatalog]);

  const filteredSubjects = useMemo(() => {
    if (!subjectCatalog) return [];
    if (selectedSemester === 'ALL') return subjectCatalog;
    return subjectCatalog.filter((subject) => String(subject.semester ?? '') === selectedSemester);
  }, [selectedSemester, subjectCatalog]);

  const semesterSubjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (subjectCatalog || []).forEach((subject) => {
      const key = subject.semester ? `Semester ${subject.semester}` : 'Unassigned';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [subjectCatalog]);

  React.useEffect(() => {
    if (!selectedSubjectCode && subjectCatalog?.length) {
      const firstWithRecords = subjectCatalog.find((item) => item.records > 0) || subjectCatalog[0];
      setSelectedSubjectCode(firstWithRecords.subject_code);
    }
  }, [selectedSubjectCode, subjectCatalog]);

  React.useEffect(() => {
    if (!filteredSubjects.length) return;
    const subjectStillVisible = filteredSubjects.some((subject) => subject.subject_code === selectedSubjectCode);
    if (!subjectStillVisible) {
      const firstWithRecords = filteredSubjects.find((item) => item.records > 0) || filteredSubjects[0];
      setSelectedSubjectCode(firstWithRecords.subject_code);
    }
  }, [filteredSubjects, selectedSubjectCode]);

  React.useEffect(() => {
    setStudentOffset(0);
  }, [studentSearch, studentSemesterFilter, studentRiskOnly]);

  const studentPageCount = studentDirectory ? Math.ceil(studentDirectory.pagination.total / studentDirectory.pagination.limit) : 0;
  const currentStudentPage = studentDirectory ? Math.floor(studentDirectory.pagination.offset / studentDirectory.pagination.limit) + 1 : 1;

  return (
    <div className="hod-shell pb-24 lg:pb-10">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-[0_18px_50px_rgba(15,23,42,0.24)] backdrop-blur md:right-8"
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <ArrowUp size={18} />
      </button>

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
          <SpotlightSearch onSelect={onSpotlightSelect} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} className="!bg-white/10 !border-white/15 !text-white hover:!bg-white/15" />
          <button type="button" className="hero-button" onClick={() => exportWithToken('/api/admin/exports/batch-summary.xlsx', 'mca-batch-summary.xlsx')}>
            <Download size={16} />
            Excel Summary
          </button>
          <button type="button" className="hero-button" onClick={() => refetch()}>
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button" className="hero-button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <div className="skeleton h-40 rounded-[1.75rem]" />
            <div className="skeleton h-40 rounded-[1.75rem]" />
            <div className="skeleton h-40 rounded-[1.75rem]" />
            <div className="skeleton h-40 rounded-[1.75rem]" />
          </>
        ) : (
          <>
            <Metric label="Health Score" value={`${data?.department_health.overall_health_score ?? 0}%`} hint="Composite derived from GPA, attendance, and red-zone density." />
            <Metric label="Active Students" value={String(data?.department_health.active_students ?? 0)} hint="Current MCA population in the command center." />
            <Metric label="At Risk" value={String(data?.department_health.at_risk_count ?? 0)} hint="High-risk students above the intervention threshold." />
            <Metric label="Average GPA" value={String(data?.department_health.average_gpa ?? 0)} hint="Current semester CGPA proxy." />
          </>
        )}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Risk Radar</p>
              <p className="text-sm text-muted-foreground">Full cohort risk segmentation instead of only red-zone rows.</p>
            </div>
            <ShieldAlert size={18} className="text-primary" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Critical" value={String(data?.risk_summary.critical ?? 0)} hint="Immediate intervention needed." />
            <Metric label="High" value={String(data?.risk_summary.high ?? 0)} hint="Escalate before the next cycle." />
            <Metric label="Moderate" value={String(data?.risk_summary.moderate ?? 0)} hint="Good recovery window." />
            <Metric label="Low" value={String(data?.risk_summary.low ?? 0)} hint="Healthy monitoring bucket." />
          </div>
        </article>

        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Placement Pipeline</p>
              <p className="text-sm text-muted-foreground">Ready, almost-ready, and blocked cohorts for recruiter planning.</p>
            </div>
            <Target size={18} className="text-primary" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Ready" value={String(data?.placement_summary.ready_count ?? 0)} hint="Can be pushed to placement drives." />
            <Metric label="Almost Ready" value={String(data?.placement_summary.almost_ready_count ?? 0)} hint="Best candidates for a finishing push." />
            <Metric label="Blocked" value={String(data?.placement_summary.blocked_count ?? 0)} hint="Arrears or GPA below threshold." />
            <Metric label="Avg Coding" value={String(data?.placement_summary.avg_coding_score ?? 0)} hint="Portfolio strength across coding subjects." />
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Hardest Subjects vs Historical Baseline</p>
              <p className="text-sm text-muted-foreground">Failure rate and five-year drift for subject bottlenecks.</p>
            </div>
            <button type="button" className="tab-chip" onClick={() => setSelectedSubjectCode(data?.bottlenecks[0]?.subject_code || subjectCatalog?.[0]?.subject_code || selectedSubjectCode)}>
              Focus Bottleneck
            </button>
          </div>
          <div className="h-80" style={{ minHeight: 320 }}>
            {isLoading ? (
              <div className="skeleton h-full rounded-[1.5rem]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.bottlenecks || []}>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="subject_code" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--panel)' }} />
                  <Bar dataKey="failure_rate" fill="var(--chart-3)" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Red-Zone Alerts</p>
              <p className="text-sm text-muted-foreground">Students with 2+ failures or steep GPA drop are surfaced first.</p>
            </div>
            <select className="input-field !py-2" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
              <option value="Low">Low</option>
              <option value="">All</option>
            </select>
          </div>
          <div className="space-y-3">
            {riskRegistry?.items.map((item) => (
              <button key={item.roll_no} type="button" onClick={() => setSelectedRollNo(item.roll_no)} className="row-card w-full text-left">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.roll_no}</p>
                </div>
                <div className="text-right">
                  <div className={`risk-badge risk-${item.risk_level.toLowerCase()}`}>{item.risk_level}</div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.risk_score}</p>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Subject Leaderboard Engine</p>
              <p className="text-sm text-muted-foreground">Class rank, batch rank, and percentile are computed with PostgreSQL window functions.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className="input-field !py-2" value={selectedSemester} onChange={(event) => setSelectedSemester(event.target.value)}>
                <option value="ALL">All Semesters</option>
                {semesterOptions.map((semester) => (
                  <option key={semester} value={String(semester)}>
                    Semester {semester}
                  </option>
                ))}
              </select>
              <select className="input-field !py-2" value={selectedSubjectCode} onChange={(event) => setSelectedSubjectCode(event.target.value)}>
                {filteredSubjects.map((subject) => (
                  <option key={subject.subject_code} value={subject.subject_code}>
                    {subject.subject_code} | {subject.subject_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trophy size={16} className="text-amber-500" />
                Top Performers
              </div>
              <div className="space-y-3">
                {leaderboard?.top_leaderboard?.length ? leaderboard.top_leaderboard.map((entry) => (
                  <button key={entry.roll_no} type="button" onClick={() => setSelectedRollNo(entry.roll_no)} className="row-card w-full text-left">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.student_name}</p>
                      <p className="text-xs text-muted-foreground">{entry.roll_no}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black text-foreground">{entry.total_marks}</p>
                      <p className="text-muted-foreground">#{entry.class_rank} class</p>
                    </div>
                  </button>
                )) : <div className="empty-card text-sm text-muted-foreground">No ranked attempts are available for this subject yet.</div>}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle size={16} className="text-rose-500" />
                Bottom 10 Trend
              </div>
              <div className="space-y-3">
                {leaderboard?.bottom_leaderboard?.length ? leaderboard.bottom_leaderboard.map((entry) => (
                  <button key={entry.roll_no} type="button" onClick={() => setSelectedRollNo(entry.roll_no)} className="row-card w-full text-left">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.student_name}</p>
                      <p className="text-xs text-muted-foreground">{entry.roll_no}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black text-foreground">{entry.total_marks}</p>
                      <p className="text-muted-foreground">{entry.percentile}% pct</p>
                    </div>
                  </button>
                )) : <div className="empty-card text-sm text-muted-foreground">No bottom-trend data is available until results are populated.</div>}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {semesterSubjectCounts.map(([label, count]) => (
              <div key={label} className="rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                {label} | {count} subjects
              </div>
            ))}
          </div>

          <div className="mt-5 h-48" style={{ minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboardSpread}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="student" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--panel)' }} />
                <Bar dataKey="marks" fill="var(--chart-2)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Faculty Impact Matrix</p>
              <p className="text-sm text-muted-foreground">Separate subject difficulty from teaching cohort effect.</p>
            </div>
            <BadgeCheck size={18} className="text-primary" />
          </div>
          <div className="space-y-3">
            {data?.faculty_impact?.length ? data.faculty_impact.map((item) => (
              <div key={`${item.faculty_id}-${item.subject_code}`} className="row-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.faculty_name}</p>
                  <p className="text-xs text-muted-foreground">{item.subject_code} | {item.subject_name}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-xs">
                  <div>
                    <p className="font-black text-foreground">{item.failure_rate}%</p>
                    <p className="text-muted-foreground">Cohort</p>
                  </div>
                  <div>
                    <p className="font-black text-foreground">{item.subject_failure_rate}%</p>
                    <p className="text-muted-foreground">Subject</p>
                  </div>
                  <div>
                    <p className={`font-black ${item.cohort_delta <= -8 ? 'text-emerald-600' : item.cohort_delta >= 8 ? 'text-rose-600' : 'text-foreground'}`}>
                      {item.cohort_delta}
                    </p>
                    <p className="text-muted-foreground">Delta</p>
                  </div>
                </div>
              </div>
            )) : <div className="empty-card text-sm text-muted-foreground">No faculty assignments are mapped yet. Populate `faculty_subject_assignments` to unlock this matrix.</div>}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Top Performers</p>
              <p className="text-sm text-muted-foreground">Highest GPA and attendance balance across the department.</p>
            </div>
            <Trophy size={18} className="text-amber-500" />
          </div>
          <div className="space-y-3">
            {data?.top_performers?.slice(0, 6).map((item) => (
              <StudentStrip key={String(item.roll_no)} item={item} onOpen={setSelectedRollNo} />
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Intervention Watchlist</p>
              <p className="text-sm text-muted-foreground">Moderate-risk students who can still be recovered early.</p>
            </div>
            <AlertTriangle size={18} className="text-primary" />
          </div>
          <div className="space-y-3">
            {data?.watchlist_students?.length ? data.watchlist_students.map((item) => (
              <button key={item.roll_no} type="button" onClick={() => setSelectedRollNo(item.roll_no)} className="row-card w-full text-left">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.roll_no}</p>
                </div>
                <div className="text-right">
                  <div className={`risk-badge risk-${item.risk_level.toLowerCase()}`}>{item.risk_level}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{item.alerts[0] || 'Monitoring recommended'}</p>
                </div>
              </button>
            )) : <div className="empty-card text-sm text-muted-foreground">No moderate watchlist students are active right now.</div>}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Leaderboard Intelligence</p>
            <p className="text-sm text-muted-foreground">Most data-rich subjects for quick topper and spread analysis.</p>
          </div>
          <div className="space-y-3">
            {data?.leaderboard_snapshots?.map((item) => (
              <div key={`${item.subject_code}-${item.semester ?? 'x'}`} className="row-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.subject_code}</p>
                  <p className="text-xs text-muted-foreground">{item.subject_name} | Sem {item.semester ?? '-'}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-xs">
                  <div>
                    <p className="font-black text-foreground">{item.attempts}</p>
                    <p className="text-muted-foreground">Attempts</p>
                  </div>
                  <div>
                    <p className="font-black text-foreground">{item.median_score}</p>
                    <p className="text-muted-foreground">Median</p>
                  </div>
                  <div>
                    <p className="font-black text-foreground">{item.score_spread}</p>
                    <p className="text-muted-foreground">Spread</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Subject Coverage Map</p>
            <p className="text-sm text-muted-foreground">Which semesters are fully populated and ready for ranking analysis.</p>
          </div>
          <div className="space-y-3">
            {data?.subject_coverage?.map((item) => (
              <div key={item.semester} className="row-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">Semester {item.semester}</p>
                  <p className="text-xs text-muted-foreground">{item.ranked_subjects}/{item.total_subjects} subjects have records</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right text-xs">
                  <div>
                    <p className="font-black text-foreground">{item.ranked_subjects}</p>
                    <p className="text-muted-foreground">Ranked</p>
                  </div>
                  <div>
                    <p className="font-black text-foreground">{item.total_records}</p>
                    <p className="text-muted-foreground">Rows</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Attendance Defaulters</p>
            <p className="text-sm text-muted-foreground">Students with the weakest attendance signal.</p>
          </div>
          <div className="space-y-3">
            {data?.attendance_defaulters?.slice(0, 5).map((item) => (
              <StudentStrip key={String(item.roll_no)} item={item} onOpen={setSelectedRollNo} />
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Internal Defaulters</p>
            <p className="text-sm text-muted-foreground">Students with the lowest internal assessment averages.</p>
          </div>
          <div className="space-y-3">
            {data?.internal_defaulters?.slice(0, 5).map((item) => (
              <StudentStrip key={String(item.roll_no)} item={item} onOpen={setSelectedRollNo} />
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Backlog Clusters</p>
            <p className="text-sm text-muted-foreground">Students carrying the heaviest active backlog load.</p>
          </div>
          <div className="space-y-3">
            {data?.backlog_clusters?.length ? data.backlog_clusters.slice(0, 5).map((item) => (
              <StudentStrip key={String(item.roll_no)} item={item} onOpen={setSelectedRollNo} />
            )) : <div className="empty-card text-sm text-muted-foreground">No active backlog clusters detected.</div>}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Opportunity Students</p>
            <p className="text-sm text-muted-foreground">High-attendance students whose GPA can likely be lifted quickly.</p>
          </div>
          <div className="space-y-3">
            {data?.opportunity_students?.length ? data.opportunity_students.slice(0, 6).map((item) => (
              <StudentStrip key={String(item.roll_no)} item={item} onOpen={setSelectedRollNo} />
            )) : <div className="empty-card text-sm text-muted-foreground">No opportunity students are currently flagged.</div>}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Quick Actions</p>
            <p className="text-sm text-muted-foreground">Admin playbook shortcuts generated from current signals.</p>
          </div>
          <div className="space-y-3">
            {data?.quick_actions?.map((action) => (
              <div key={action} className="brief-card">
                <Zap size={16} className="text-primary" />
                <p className="text-sm leading-6 text-foreground">{action}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6">
        <article className="panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-foreground">Student Registry</p>
              <p className="text-sm text-muted-foreground">Paginated master list for browsing the full MCA cohort without clipping the dataset.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                className="input-field !py-2"
                placeholder="Search student, roll, email, batch"
              />
              <select className="input-field !py-2" value={studentSemesterFilter} onChange={(event) => setStudentSemesterFilter(event.target.value)}>
                <option value="ALL">All Semesters</option>
                {semesterOptions.map((semester) => (
                  <option key={`registry-${semester}`} value={String(semester)}>
                    Semester {semester}
                  </option>
                ))}
              </select>
              <button type="button" className={`tab-chip ${studentRiskOnly ? '!bg-primary !text-primary-foreground' : ''}`} onClick={() => setStudentRiskOnly((value) => !value)}>
                Risk Only
              </button>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[1.5rem] border border-border/70 lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Rank', 'Student', 'Batch', 'Sem', 'GPA', 'Internal', 'Attendance', 'Backlogs'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentDirectory?.items.map((item) => (
                  <tr key={item.roll_no} className="border-t border-border/60 bg-card/70">
                    <td className="px-4 py-3 text-foreground">{item.rank ?? '-'}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="text-left" onClick={() => setSelectedRollNo(item.roll_no)}>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.roll_no} | {item.email || 'No email'}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-foreground">{item.batch || '-'}</td>
                    <td className="px-4 py-3 text-foreground">{item.current_semester ?? '-'}</td>
                    <td className="px-4 py-3 text-foreground">{item.average_grade_points}</td>
                    <td className="px-4 py-3 text-foreground">{item.average_internal_percentage}</td>
                    <td className="px-4 py-3 text-foreground">{item.attendance_percentage}%</td>
                    <td className="px-4 py-3 text-foreground">{item.backlogs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {studentDirectory?.items.map((item) => (
              <StudentStrip key={`mobile-${item.roll_no}`} item={item} onOpen={setSelectedRollNo} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div>
              {isStudentsFetching ? 'Refreshing registry...' : `${studentDirectory?.pagination.total ?? 0} students found`} | Page {currentStudentPage} of {Math.max(studentPageCount, 1)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="tab-chip"
                disabled={!studentDirectory || studentDirectory.pagination.offset === 0}
                onClick={() => setStudentOffset((value) => Math.max(0, value - (studentDirectory?.pagination.limit || 10)))}
              >
                Previous
              </button>
              <button
                type="button"
                className="tab-chip"
                disabled={!studentDirectory || studentDirectory.pagination.offset + studentDirectory.pagination.limit >= studentDirectory.pagination.total}
                onClick={() => setStudentOffset((value) => value + (studentDirectory?.pagination.limit || 10))}
              >
                Next
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">HOD Action Queue</p>
              <p className="text-sm text-muted-foreground">Prioritized actions generated from live analytics signals.</p>
            </div>
            <Zap size={18} className="text-primary" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {data?.action_queue?.map((item) => (
              <ActionCard key={`${item.title}-${item.metric}`} item={item} />
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Command Alerts</p>
              <p className="text-sm text-muted-foreground">Automated briefing lines that deserve follow-up.</p>
            </div>
            <AlertTriangle size={18} className="text-primary" />
          </div>
          <div className="space-y-3">
            {data?.alerts?.length ? data.alerts.map((alert) => (
              <div key={alert} className="brief-card">
                <AlertTriangle size={16} className="text-primary" />
                <p className="text-sm leading-6 text-foreground">{alert}</p>
              </div>
            )) : <div className="empty-card text-sm text-muted-foreground">No immediate command alerts are active right now.</div>}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Department Trendline</p>
              <p className="text-sm text-muted-foreground">Pass rate and SGPA shape for the HOD briefing.</p>
            </div>
            <Zap size={18} className="text-primary" />
          </div>
          <div className="h-72" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--panel)' }} />
                <Line type="monotone" dataKey="average_attendance" stroke="var(--chart-1)" strokeWidth={3} />
                <Line type="monotone" dataKey="average_gpa" stroke="var(--chart-2)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Batch Health Board</p>
            <p className="text-sm text-muted-foreground">Batch-level GPA, attendance, and backlog pressure.</p>
          </div>
          <div className="space-y-3">
            {data?.batch_health?.map((batch: any) => (
              <div key={String(batch.batch)} className="row-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">{batch.batch}</p>
                  <p className="text-xs text-muted-foreground">{batch.at_risk_count} backlog students</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right text-xs">
                  <div>
                    <p className="font-black text-foreground">{batch.average_gpa}</p>
                    <p className="text-muted-foreground">Avg GPA</p>
                  </div>
                  <div>
                    <p className="font-black text-foreground">{batch.average_attendance}%</p>
                    <p className="text-muted-foreground">Attendance</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Semester Pulse</p>
            <p className="text-sm text-muted-foreground">Operational summary by current semester cohort.</p>
          </div>
          <div className="space-y-3">
            {data?.semester_pulse?.map((semester: any) => (
              <div key={String(semester.semester)} className="row-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">Semester {semester.semester}</p>
                  <p className="text-xs text-muted-foreground">{semester.student_count} students | {semester.at_risk_count} backlog students</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right text-xs">
                  <div>
                    <p className="font-black text-foreground">{semester.average_gpa}</p>
                    <p className="text-muted-foreground">Avg GPA</p>
                  </div>
                  <div>
                    <p className="font-black text-foreground">{semester.average_attendance}%</p>
                    <p className="text-muted-foreground">Attendance</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6">
        <article className="panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">Placement Readiness Engine</p>
              <p className="text-sm text-muted-foreground">CGPA, arrears, attendance, and coding-subject performance in one grid.</p>
            </div>
            <input
              value={placementSearch}
              onChange={(event) => setPlacementSearch(event.target.value)}
              className="input-field !py-2"
              placeholder="Search placements"
            />
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/60 bg-card/70">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users size={16} />
              {table.getFilteredRowModel().rows.length} candidates visible
            </div>
            <button type="button" className="tab-chip" onClick={() => exportWithToken('/api/admin/export/batch-summary', 'mca-batch-summary.xlsx')}>
              Export Excel
            </button>
          </div>
        </article>
      </section>

      <StudentProfile360 rollNo={selectedRollNo} onClose={() => setSelectedRollNo(null)} />
    </div>
  );
}
