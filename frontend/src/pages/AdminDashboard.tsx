import React, { useMemo, useState, useEffect } from 'react';
import LeaderboardView from '../features/admin/views/LeaderboardView';
import PlacementView from '../features/admin/views/PlacementView';
import RiskRadarView from '../features/admin/views/RiskRadarView';







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







import { AlertTriangle, ArrowUp, BadgeCheck, Download, RefreshCw, ShieldAlert, Target, Trophy, Users, Zap, ChevronRight, Search, Briefcase, Activity, Plus, Edit3 } from 'lucide-react';







import api from '../api/client';







import { useAuthStore } from '../store/authStore';







import { useThemeStore } from '../store/themeStore';







import StudentProfile360 from '../components/StudentProfile360';
import AICopilot from '../components/AICopilot';







import type {







  AdminCohortAction,







  AdminCommandCenterResponse,







  AdminDirectoryPage,







  PlacementCandidate,







  RiskRegistryResponse,







  SpotlightResult,







  SubjectCatalogItem,







  SubjectLeaderboardResponse,







  FacultyImpactMatrixItem,







  StaffProfile,







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















function FacultyCard({ item }: { item: FacultyImpactMatrixItem }) {







  return (







    <div className="p-4 rounded-2xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors">







      <div className="flex items-start justify-between gap-3">







        <div>







          <p className="text-sm font-semibold text-foreground">{item.faculty_name}</p>







          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{item.subject_code}</p>







        </div>







        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em]">







          {item.impact_label || 'IMPACT'}







        </span>







      </div>







      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.subject_name}</p>







      <div className="mt-3 grid grid-cols-3 gap-3 text-xs font-bold text-foreground">







        <div>







          <p className="text-lg leading-tight">{item.failure_rate?.toFixed?.(1) ?? item.failure_rate}%</p>







          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Fail Rate</p>







        </div>







        <div>







          <p className="text-lg leading-tight">{item.average_marks?.toFixed?.(1) ?? item.average_marks}</p>







          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Marks</p>







        </div>







        <div>







          <p className="text-lg leading-tight">{item.student_count}</p>







          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Students</p>







        </div>







      </div>







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







  const setActiveTab = (tab: string) => {







    const params = new URLSearchParams(searchParams);







    params.set('tab', tab);







    setSearchParams(params);







  };















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







  const createStaffMutation = useMutation({







    mutationFn: async (payload: any) => api.post('admin/staff', payload),







    onSuccess: () => {







      setStaffForm({ username: '', name: '', email: '', department: '', password: '' });







      setEditingStaff(null);







      refetchStaff();







    },







  });







  const updateStaffMutation = useMutation({







    mutationFn: async ({ id, ...payload }: any) => api.patch(`admin/staff/${id}`, payload),







    onSuccess: () => {







      setStaffForm({ username: '', name: '', email: '', department: '', password: '' });







      setEditingStaff(null);







      refetchStaff();







    },







  });







  const deleteStaffMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`admin/staff/${id}`),
    onError: (error: any) => {
      const status = error?.response?.status;
      if (status == 405) {
        alert('Delete is not allowed by the server (405). Please remove this user manually in the backend.');
      }
    },
    onSuccess: (_data, id) => {
      if (editingStaff?.id === id) {
        setEditingStaff(null);
        setStaffForm({ username: '', name: '', email: '', department: '', password: '' });
      }
      refetchStaff();
    },
  });















  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');







  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');







  const [selectedRollNo, setSelectedRollNo] = useState<string | null>(null);















  // Scroll to anchor on activeTab changes or direct link clicks







    useEffect(() => {
    const hash = window.location.hash;
    if (hash && activeTab === 'Overview') {
      const tryScroll = () => {
        const element = document.getElementById(hash.substring(1));
        const mainScroll = document.getElementById('main-scroll');
        if (element && mainScroll) {
          const containerTop = mainScroll.getBoundingClientRect().top;
          const elementTop = element.getBoundingClientRect().top;
          const topOffset = elementTop - containerTop + mainScroll.scrollTop - 60;
          
          mainScroll.scrollTo({
            top: topOffset > 0 ? topOffset : 0,
            behavior: 'smooth'
          });
        }
      };
      
      setTimeout(tryScroll, 100);
      setTimeout(tryScroll, 500);
      setTimeout(tryScroll, 1500);
      setTimeout(tryScroll, 3000);
    }
  }, [activeTab]);















  const scrollToAnchor = (id: string) => {







    const element = document.getElementById(id);







    if (element) {







      element.scrollIntoView({ behavior: 'smooth' });







    }







  };







  







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



  const [staffForm, setStaffForm] = useState({ username: '', name: '', email: '', department: '', password: '' });



  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);



  const [staffSearch, setStaffSearch] = useState('');



  const [staffToDelete, setStaffToDelete] = useState<StaffProfile | null>(null);



  const [staffModalOpen, setStaffModalOpen] = useState(false);











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















  const handleStaffSubmit = () => {



    if (editingStaff) {



      updateStaffMutation.mutate({





        id: editingStaff.id,







        name: staffForm.name,







        email: staffForm.email || null,







        department: staffForm.department || null,







        password: staffForm.password || undefined,







      });







    } else {







      createStaffMutation.mutate({







        username: staffForm.username,







        password: staffForm.password || 'temp123',







        name: staffForm.name,







        email: staffForm.email || null,







        department: staffForm.department || null,



      });



    }



  };



  const handleDeleteStaff = () => {

    if (!staffToDelete) return;

    deleteStaffMutation.mutate(staffToDelete.id, {

      onSettled: () => setStaffToDelete(null),

    });

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















  const { data: staffDirectory, isLoading: loadingStaff, refetch: refetchStaff } = useQuery<StaffProfile[]>({







    queryKey: ['admin-staff'],







    queryFn: () => api.get('admin/staff'),







    enabled: activeTab === 'Staff',







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















  















  















  const staffImpact = useMemo(() => {



    const items = data?.faculty_impact || [];



    const grouped: Record<number, { facultyName: string; subjects: FacultyImpactMatrixItem[] }> = {};



    items.forEach((item) => {



      if (!grouped[item.faculty_id]) grouped[item.faculty_id] = { facultyName: item.faculty_name, subjects: [] };



      grouped[item.faculty_id].subjects.push(item);







    });







    return Object.entries(grouped).map(([id, payload]) => ({



      faculty_id: Number(id),



      faculty_name: payload.facultyName,



      subjects: payload.subjects,



    }));



  }, [data?.faculty_impact]);







  const filteredStaff = useMemo(() => {



    const list = staffDirectory || [];



    const term = staffSearch.trim().toLowerCase();



    if (!term) return list;



    return list.filter((s) => {



      const haystack = `${s.name || ''} ${s.username || ''} ${s.email || ''} ${s.department || ''}`.toLowerCase();



      return haystack.includes(term);



    });



  }, [staffDirectory, staffSearch]);











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







      <div className="flex flex-wrap gap-2 mb-6">







        {['Overview','Performance','Students','Attendance','Placements','Security','Profile','Staff'].map(tab => (







          <button







            key={tab}







            onClick={() => setActiveTab(tab)}







            className={`tab-chip ${activeTab === tab ? '!bg-primary !text-white shadow' : ''}`}







          >







            {tab}







          </button>







        ))}







      </div>







      {activeTab === 'Leaderboard' && <LeaderboardView />}

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

          <AICopilot data={data} leaderboard={leaderboard} />















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















          {/* Faculty impact anchor for sidebar */}
          <section id="faculty-impact" className="panel">







            <div className="mb-4 flex items-center justify-between">







              <div>







                <p className="text-lg font-semibold text-foreground">Staff Impact Board</p>







                <p className="text-sm text-muted-foreground">Faculty performance and load snapshots.</p>







              </div>







              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">







                <Briefcase size={16} className="text-primary" />







                <span>{data?.faculty_impact?.length || 0} entries</span>







              </div>







            </div>







            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">







              {(data?.faculty_impact || []).slice(0, 6).map((item: FacultyImpactMatrixItem) => (







                <FacultyCard key={`${item.faculty_id}-${item.subject_code}`} item={item} />







              ))}







              {(data?.faculty_impact?.length ?? 0) === 0 && (







                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-8 text-center border border-dashed border-border/60 rounded-2xl">







                  <Activity size={20} className="text-muted-foreground" />







                  <p className="text-sm text-muted-foreground">No staff metrics available yet.</p>







                </div>







              )}







            </div>







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
                    interval="preserveStartEnd" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120} 
                    tick={{ fontSize: 10 }} 
                    minTickGap={2} 
                    tickFormatter={(value) => value.length > 25 ? `${value.substring(0, 22)}...` : value} 
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







              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">







                <select className="input-field w-full !py-2 sm:w-40" value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>







                  <option value="ALL">All Semesters</option>







                  {semesterOptions.map(s => <option key={s} value={String(s)}>Sem {s}</option>)}







                </select>







                <select className="input-field w-full !py-2 sm:w-72" value={selectedSubjectCode} onChange={(e) => setSelectedSubjectCode(e.target.value)}>







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







                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {e.class_rank}
                            </span>
                            <p className="text-sm font-semibold">{e.student_name}</p>
                          </div>







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







                    <p className="text-xs text-muted-foreground">{item.roll_no}{item.reg_no ? ` / Reg: ${item.reg_no}` : ''} � Sem {item.current_semester} � <span className="rounded-full bg-muted px-1.5 py-0.5">{item.batch}</span> � Sec {item.section || '-'}</p>







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















      {activeTab === 'Risk' && (
        <RiskRadarView onOpenStudentProfile={setSelectedRollNo} />
      )}

      {activeTab === 'Placements' && (
        <PlacementView onOpenStudentProfile={setSelectedRollNo} />
      )}

      {activeTab === 'Staff' && (

        <div className="space-y-4">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <p className="text-lg font-semibold text-foreground">Staff</p>

              <p className="text-sm text-muted-foreground">Manage faculty access and profiles.</p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <input

                value={staffSearch}

                onChange={(e) => setStaffSearch(e.target.value)}

                className="input-field !py-2 w-56"

                placeholder="Search name, username, dept"

              />

              <button

                className="btn-primary inline-flex items-center gap-2"

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



          <article className="panel space-y-3">

            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/60">

              <table className="w-full text-sm">

                <thead className="bg-muted/40 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">

                  <tr>

                    <th className="px-4 py-3 text-left">Staff</th>

                    <th className="px-4 py-3 text-left">Username / Dept</th>

                    <th className="px-4 py-3 text-left">Email</th>

                    <th className="px-4 py-3 text-left">Subjects</th>

                    <th className="px-4 py-3 text-left">Actions</th>

                  </tr>

                </thead>

                <tbody>

                  {(filteredStaff || []).map((s) => {

                    const impact = staffImpact.find((i) => i.faculty_id === s.id || i.faculty_name.toLowerCase() === (s.name || '').toLowerCase());

                    return (

                      <tr key={s.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors">

                        <td className="px-4 py-3">

                          <div className="flex items-center gap-3">

                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">

                              {s.name?.slice(0, 1) || s.username.slice(0, 1)}

                            </div>

                            <div>

                              <p className="font-semibold text-foreground">{s.name || '�'}</p>

                              <p className="text-[11px] text-muted-foreground">ID: {s.id}</p>

                            </div>

                          </div>

                        </td>

                        <td className="px-4 py-3 text-muted-foreground">

                          <div className="font-mono text-xs text-foreground">{s.username}</div>

                          <div className="text-xs">{s.department || 'Dept NA'}</div>

                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground">

                          {s.email || 'No email'}

                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground">

                          {impact?.subjects?.length ? (

                            <div className="flex flex-wrap gap-1">

                              {impact.subjects.slice(0, 3).map((sub) => (

                                <span key={sub.subject_code} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold">

                                  {sub.subject_code}

                                </span>

                              ))}

                              {impact.subjects.length > 3 && <span className="text-[10px] text-foreground">+{impact.subjects.length - 3}</span>}

                            </div>

                          ) : (

                            <span className="text-[11px]">No subjects</span>

                          )}

                        </td>

                        <td className="px-4 py-3">

                          <div className="flex flex-wrap gap-2">

                            <button

                              className="tab-chip"

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

                              className="tab-chip !bg-rose-500/10 !text-rose-600 hover:!bg-rose-500/20"

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

                      <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={5}>

                        Loading staff...

                      </td>

                    </tr>

                  )}

                  {!loadingStaff && filteredStaff.length === 0 && (

                    <tr>

                      <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={5}>

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



      {staffModalOpen && (
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

        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">

          <div className="w-[min(420px,90vw)] rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border space-y-4">

            <div>

              <p className="text-lg font-semibold text-foreground">Delete staff?</p>

              <p className="text-sm text-muted-foreground">

                This will remove <span className="font-semibold">{staffToDelete.name || staffToDelete.username}</span> and revoke their access.

              </p>

            </div>

            <div className="flex justify-end gap-2">

              <button className="tab-chip" onClick={() => setStaffToDelete(null)} disabled={deleteStaffMutation.isPending}>

                Cancel

              </button>

              <button

                className="tab-chip !bg-rose-500/10 !text-rose-600 hover:!bg-rose-500/20"

                onClick={handleDeleteStaff}

                disabled={deleteStaffMutation.isPending}

              >

                {deleteStaffMutation.isPending ? 'Deleting…' : 'Delete'}

              </button>

            </div>

          </div>

        </div>

      )}



      <StudentProfile360 rollNo={selectedRollNo} onClose={handleCloseProfile} />



    </div>





  );







}









