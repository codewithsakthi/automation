import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { Activity, AlertTriangle, ArrowUp, BookOpenCheck, Download, ShieldCheck, Target, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { FullStudentRecord, Student360Profile } from '../types/enterprise';

interface StudentProfile360Props {
  rollNo: string | null;
  onClose: () => void;
}

// API_BASE removed - using api.defaults.baseURL

function downloadWithToken(path: string, filename: string) {
  const token = useAuthStore.getState().token;
  return fetch(`${api.defaults.baseURL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (response) => {
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

export default function StudentProfile360({ rollNo, onClose }: StudentProfile360Props) {
  const drawerRef = React.useRef<HTMLElement | null>(null);
  const { data, isLoading } = useQuery<Student360Profile>({
    queryKey: ['student-360', rollNo],
    queryFn: () => api.get(`/api/admin/student-360/${rollNo}`),
    enabled: Boolean(rollNo),
  });
  const { data: record, isLoading: isRecordLoading } = useQuery<FullStudentRecord>({
    queryKey: ['student-record', rollNo],
    queryFn: () => api.get(`/api/admin/student-record/${rollNo}`),
    enabled: Boolean(rollNo),
    staleTime: 60_000,
  });

  if (!rollNo) return null;

  return (
    <aside ref={drawerRef} className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-border/70 bg-[var(--panel-strong)] p-6 shadow-[0_0_40px_rgba(2,6,23,0.25)]">
      <button
        type="button"
        onClick={() => drawerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-[0_18px_50px_rgba(15,23,42,0.24)] backdrop-blur md:right-8"
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <ArrowUp size={18} />
      </button>

      <button
        type="button"
        onClick={onClose}
        className="fixed bottom-5 right-5 z-[60] rounded-full border border-border bg-card/95 px-4 py-3 text-sm font-semibold text-foreground shadow-[0_18px_50px_rgba(15,23,42,0.24)] backdrop-blur md:right-8"
      >
        Close Student 360
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">Student 360</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{data?.student_name || rollNo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{data?.batch || 'Batch pending'} | Sem {data?.current_semester || '-'} | {rollNo}</p>
        </div>
        <button type="button" onClick={onClose} className="tab-chip">Close</button>
      </div>

      {isLoading || isRecordLoading ? (
        <div className="mt-8 space-y-4">
          <div className="skeleton h-28 rounded-[1.5rem]" />
          <div className="skeleton h-64 rounded-[1.5rem]" />
          <div className="skeleton h-64 rounded-[1.5rem]" />
        </div>
      ) : data ? (
        <div className="mt-8 space-y-5 pb-24">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="panel">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">GPA Velocity</p>
                {data.gpa_velocity >= 0 ? <TrendingUp className="text-emerald-500" size={18} /> : <TrendingDown className="text-rose-500" size={18} />}
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{data.gpa_velocity}</p>
              <p className="mt-2 text-sm text-muted-foreground">{data.gpa_trend} trajectory.</p>
            </article>

            <article className="panel">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Correlation</p>
                <Activity className="text-primary" size={18} />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{data.attendance_marks_correlation}</p>
              <p className="mt-2 text-sm text-muted-foreground">Attendance vs marks signal.</p>
            </article>

            <article className="panel">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Attendance Band</p>
                <ShieldCheck className="text-primary" size={18} />
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{data.attendance_band}</p>
              <p className="mt-2 text-sm text-muted-foreground">{data.attendance_percentage}% attendance.</p>
            </article>

            <article className="panel">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Placement Signal</p>
                <Target className="text-primary" size={18} />
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{data.placement_signal}</p>
              <p className="mt-2 text-sm text-muted-foreground">CGPA, arrears, and attendance blended.</p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Peer Benchmark</p>
                <p className="text-sm text-muted-foreground">Where this student stands against the current-semester cohort.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border/70 bg-card/70 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Class Rank</p>
                  <p className="mt-3 text-3xl font-semibold text-foreground">#{data.peer_benchmark.class_rank}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Across {data.peer_benchmark.cohort_size} peers in the same semester.</p>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-card/70 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Percentile</p>
                  <p className="mt-3 text-3xl font-semibold text-foreground">{data.peer_benchmark.percentile}%</p>
                  <p className="mt-2 text-sm text-muted-foreground">Gap vs cohort GPA: {data.peer_benchmark.gap_from_cohort >= 0 ? '+' : ''}{data.peer_benchmark.gap_from_cohort}</p>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Risk Driver Stack</p>
                <p className="text-sm text-muted-foreground">Main positive and negative levers behind the current risk posture.</p>
              </div>
              <div className="space-y-3">
                {data.risk_drivers.map((driver) => (
                  <div key={driver.label} className="rounded-[1.25rem] border border-border/70 bg-card/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{driver.label}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${
                          driver.status === 'positive'
                            ? 'bg-emerald-500/12 text-emerald-700'
                            : driver.status === 'critical'
                              ? 'bg-rose-500/12 text-rose-700'
                              : driver.status === 'warning'
                                ? 'bg-amber-500/12 text-amber-700'
                                : 'bg-slate-500/12 text-slate-700'
                        }`}
                      >
                        {driver.status}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.max(8, Math.min(driver.value, 100))}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Signal score: {driver.value}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Profile Intelligence</p>
                <p className="text-sm text-muted-foreground">Directory, record-completion, and contact readiness in one view.</p>
              </div>
              <div className="space-y-3">
                <div className="row-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Primary Contact</p>
                    <p className="text-xs text-muted-foreground">{record?.contact_info?.email || 'Email not available'}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-black text-foreground">{record?.contact_info?.phone_primary || 'No phone'}</p>
                    <p className="text-muted-foreground">{record?.contact_info?.city || 'City pending'}</p>
                  </div>
                </div>
                <div className="row-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Parent / Guardian</p>
                    <p className="text-xs text-muted-foreground">{record?.family_details?.parent_guardian_name || record?.family_details?.father_name || 'Not recorded'}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-black text-foreground">{record?.family_details?.parent_phone || record?.family_details?.emergency_phone || 'No phone'}</p>
                    <p className="text-muted-foreground">{record?.family_details?.occupation || record?.family_details?.parent_occupation || 'Occupation pending'}</p>
                  </div>
                </div>
                <div className="row-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Record Health</p>
                    <p className="text-xs text-muted-foreground">{record?.record_health?.available_sections?.join(', ') || 'No sections detected'}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-black text-foreground">{record?.record_health?.completion_percentage ?? 0}%</p>
                    <p className="text-muted-foreground">Completion</p>
                  </div>
                </div>
                <div className="row-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Academic Snapshot</p>
                    <p className="text-xs text-muted-foreground">{record?.academic_snapshot?.grade_entries ?? 0} grade entries across {record?.academic_snapshot?.semesters_tracked ?? 0} semesters</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-black text-foreground">{record?.academic_snapshot?.best_grade || '-'}</p>
                    <p className="text-muted-foreground">Best grade</p>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Recent Grade Ledger</p>
                <p className="text-sm text-muted-foreground">Latest subject-level performance with internals and attempts.</p>
              </div>
              <div className="space-y-3">
                {(record?.semester_grades || []).slice(0, 8).map((grade, index) => (
                  <div key={`${grade.subject_code || 'subject'}-${grade.semester || 'sem'}-${index}`} className="row-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{grade.subject_title || grade.subject_code || 'Subject pending'}</p>
                      <p className="text-xs text-muted-foreground">{grade.subject_code || 'No code'} | Sem {grade.semester || '-'}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-right text-xs">
                      <div>
                        <p className="font-black text-foreground">{grade.marks ?? '-'}</p>
                        <p className="text-muted-foreground">Marks</p>
                      </div>
                      <div>
                        <p className="font-black text-foreground">{grade.internal_marks ?? '-'}</p>
                        <p className="text-muted-foreground">Internal</p>
                      </div>
                      <div>
                        <p className="font-black text-foreground">{grade.grade || '-'}</p>
                        <p className="text-muted-foreground">Grade</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!record?.semester_grades?.length ? <div className="empty-card text-sm text-muted-foreground">Semester grade history is not available for this student yet.</div> : null}
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Academic Background</p>
                <p className="text-sm text-muted-foreground">Previous qualifications and preparation signal.</p>
              </div>
              <div className="space-y-3">
                {(record?.previous_academics || []).slice(0, 4).map((item, index) => (
                  <div key={`${item.qualification || item.level || 'previous'}-${index}`} className="row-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.qualification || item.level || 'Qualification pending'}</p>
                      <p className="text-xs text-muted-foreground">{item.school_name || item.institution || 'Institution pending'}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black text-foreground">{item.percentage ?? '-'}</p>
                      <p className="text-muted-foreground">{item.passing_year || item.year_passing || 'Year pending'}</p>
                    </div>
                  </div>
                ))}
                {!record?.previous_academics?.length ? <div className="empty-card text-sm text-muted-foreground">Previous academic records are not yet available.</div> : null}
              </div>
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Counselor Timeline</p>
                <p className="text-sm text-muted-foreground">Latest interventions, remarks, and follow-up actions.</p>
              </div>
              <div className="space-y-3">
                {(record?.counselor_diary || []).slice(0, 5).map((entry, index) => (
                  <div key={`${entry.created_at || entry.meeting_date || 'diary'}-${index}`} className="brief-card">
                    <BookOpenCheck size={16} className="text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.remark_category || 'General note'}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{entry.remarks || entry.action_planned || 'No remark recorded.'}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {entry.meeting_date || entry.created_at || 'No date'} {entry.counselor_name ? `| ${entry.counselor_name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {!record?.counselor_diary?.length ? <div className="empty-card text-sm text-muted-foreground">No counselor diary entries have been recorded for this student yet.</div> : null}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-foreground">Skill Domain Radar</p>
                <p className="text-sm text-muted-foreground">Theory, programming, lab, and attendance mapped into one profile.</p>
              </div>
              <button type="button" className="hero-button !text-foreground !border-border !bg-card" onClick={() => downloadWithToken(`/api/admin/exports/grade-sheet/${data.roll_no}.pdf`, `${data.roll_no}-grade-sheet.pdf`)}>
                <Download size={16} />
                PDF Grade Sheet
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data.skill_domains}>
                  <PolarGrid stroke="rgba(148,163,184,0.22)" />
                  <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--color-foreground)', fontSize: 12 }} />
                  <Radar dataKey="score" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} />
                  <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--panel)' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <article className="panel">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">Semester Momentum</p>
                  <p className="text-sm text-muted-foreground">Attendance and internal trend by semester.</p>
                </div>
                <div className={`risk-badge risk-${data.risk_level.toLowerCase()}`}>{data.risk_level}</div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.semester_velocity}>
                    <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--panel)' }} />
                    <Line type="monotone" dataKey="attendance_pct" stroke="var(--chart-1)" strokeWidth={3} />
                    <Line type="monotone" dataKey="internal_avg" stroke="var(--chart-2)" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {data.active_arrears > 0 ? (
                <div className="mt-4 flex items-center gap-3 rounded-[1.25rem] bg-rose-500/10 p-4 text-sm text-rose-700">
                  <AlertTriangle size={16} />
                  {data.active_arrears} active arrears still require intervention before placement readiness.
                </div>
              ) : null}
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">SGPA Snapshot</p>
                <p className="text-sm text-muted-foreground">Small-sample friendly semester SGPA chart.</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.semester_velocity}>
                    <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} domain={[0, 10]} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--panel)' }} />
                    <Bar dataKey="sgpa" fill="var(--chart-4)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Strongest Subjects</p>
                <p className="text-sm text-muted-foreground">Best-performing papers by combined grade and internal signal.</p>
              </div>
              <div className="space-y-3">
                {data.strongest_subjects.length ? data.strongest_subjects.map((subject) => (
                  <div key={`${subject.subject_code}-${subject.semester}`} className="row-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{subject.subject_name}</p>
                      <p className="text-xs text-muted-foreground">{subject.subject_code} | Sem {subject.semester} | Grade {subject.grade || '-'}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black text-foreground">{subject.score}</p>
                      <p className="text-muted-foreground">{subject.note}</p>
                    </div>
                  </div>
                )) : <div className="empty-card text-sm text-muted-foreground">Strength highlights will appear once enough graded subjects exist.</div>}
              </div>
            </article>

            <article className="panel">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Support Subjects</p>
                <p className="text-sm text-muted-foreground">Papers that need the fastest intervention.</p>
              </div>
              <div className="space-y-3">
                {data.support_subjects.length ? data.support_subjects.map((subject) => (
                  <div key={`${subject.subject_code}-${subject.semester}`} className="row-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{subject.subject_name}</p>
                      <p className="text-xs text-muted-foreground">{subject.subject_code} | Sem {subject.semester} | Grade {subject.grade || '-'}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black text-rose-600">{subject.score}</p>
                      <p className="text-muted-foreground">{subject.note}</p>
                    </div>
                  </div>
                )) : <div className="empty-card text-sm text-muted-foreground">No current support subjects were detected.</div>}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="mb-4">
              <p className="text-lg font-semibold text-foreground">Recommended Actions</p>
              <p className="text-sm text-muted-foreground">Auto-generated next steps for the HOD or counselor.</p>
            </div>
            <div className="space-y-3">
              {data.recommended_actions.map((action) => (
                <div key={action} className="brief-card">
                  <AlertTriangle size={16} className="text-primary" />
                  <p className="text-sm leading-6 text-foreground">{action}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
