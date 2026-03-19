export type RiskLevel = 'Critical' | 'High' | 'Moderate' | 'Low';

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface DepartmentHealth {
  overall_health_score: number;
  active_students: number;
  at_risk_count: number;
  average_attendance: number;
  average_gpa: number;
  department_name: string;
  daily_briefing: string;
  semester_trends: Array<Record<string, unknown>>;
  top_critical_subjects: Array<Record<string, unknown>>;
}

export interface SubjectBottleneckItem {
  subject_code: string;
  subject_name: string;
  semester?: number | null;
  attempts: number;
  failure_rate: number;
  marks_stddev: number;
  current_average_marks: number;
  historical_five_year_average: number;
  drift_from_history: number;
  faculty_context?: string | null;
}

export interface FacultyImpactMatrixItem {
  faculty_id: number;
  faculty_name: string;
  subject_code: string;
  subject_name: string;
  student_count: number;
  failure_rate: number;
  subject_failure_rate: number;
  cohort_delta: number;
  average_marks: number;
  impact_label: string;
}

export interface PlacementCandidate {
  roll_no: string;
  student_name: string;
  batch?: string | null;
  current_semester?: number | null;
  cgpa: number;
  active_arrears: number;
  coding_subject_score: number;
  attendance_percentage: number;
  placement_ready: boolean;
}

export interface SpotlightResult {
  entity_type: 'student' | 'faculty' | 'subject';
  entity_id: string;
  label: string;
  sublabel?: string | null;
}

export interface AdminRiskSummary {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

export interface AdminPlacementSummary {
  ready_count: number;
  almost_ready_count: number;
  blocked_count: number;
  avg_coding_score: number;
}

export interface AdminLeaderboardSnapshot {
  subject_code: string;
  subject_name: string;
  semester?: number | null;
  attempts: number;
  top_score: number;
  median_score: number;
  score_spread: number;
}

export interface AdminSubjectCoverage {
  semester: number;
  total_subjects: number;
  ranked_subjects: number;
  total_records: number;
}

export interface AdminCohortAction {
  title: string;
  detail: string;
  metric: string;
  tone: 'positive' | 'warning' | 'critical' | 'info';
}

export interface AdminDirectoryStudent {
  roll_no: string;
  reg_no?: string | null;
  name: string;
  city?: string | null;
  email?: string | null;
  phone_primary?: string | null;
  batch?: string | null;
  current_semester?: number | null;
  section?: string | null;
  marks_count: number;
  attendance_count: number;
  attendance_percentage: number;
  average_grade_points: number;
  average_internal_percentage: number;
  backlogs: number;
  rank?: number | null;
  is_initial_password: boolean;
}

export interface AdminDirectoryPage {
  items: AdminDirectoryStudent[];
  pagination: PaginationMeta;
}

export interface ContactInfoRecord {
  address?: string | null;
  pincode?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  phone_tertiary?: string | null;
  email?: string | null;
  city?: string | null;
}

export interface FamilyDetailsRecord {
  parent_guardian_name?: string | null;
  occupation?: string | null;
  parent_phone?: string | null;
  emergency_name?: string | null;
  emergency_address?: string | null;
  emergency_phone?: string | null;
  emergency_email?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  parent_occupation?: string | null;
  parent_address?: string | null;
  parent_email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
}

export interface PreviousAcademicRecord {
  qualification?: string | null;
  school_name?: string | null;
  passing_year?: string | null;
  percentage?: number | null;
  level?: string | null;
  institution?: string | null;
  year_passing?: string | null;
}

export interface CounselorDiaryRecord {
  semester?: number | null;
  meeting_date?: string | null;
  remark_category?: string | null;
  remarks?: string | null;
  action_planned?: string | null;
  follow_up_date?: string | null;
  counselor_name?: string | null;
  created_at?: string | null;
}

export interface SemesterGradeRecord {
  semester?: number | null;
  subject_code?: string | null;
  subject_title?: string | null;
  grade?: string | null;
  marks?: number | null;
  internal_marks?: number | null;
  attempt?: number | null;
  remarks?: string | null;
  grade_point?: number | null;
}

export interface StudentRecordHealth {
  completion_percentage: number;
  available_sections: string[];
  missing_sections: string[];
  last_counselor_update?: string | null;
  latest_activity_year?: string | null;
}

export interface StudentAcademicSnapshot {
  semesters_tracked: number;
  grade_entries: number;
  internal_tests: number;
  previous_qualifications: number;
  cgpa_proxy: number;
  best_grade?: string | null;
  needs_attention: boolean;
}

export interface FullStudentRecord {
  roll_no: string;
  core_profile?: AdminDirectoryStudent | null;
  contact_info?: ContactInfoRecord | null;
  family_details?: FamilyDetailsRecord | null;
  previous_academics: PreviousAcademicRecord[];
  counselor_diary: CounselorDiaryRecord[];
  semester_grades: SemesterGradeRecord[];
  record_health?: StudentRecordHealth | null;
  academic_snapshot?: StudentAcademicSnapshot | null;
}

export interface AdminCommandCenterResponse {
  daily_briefing: string;
  department_health: DepartmentHealth;
  alerts: string[];
  bottlenecks: SubjectBottleneckItem[];
  faculty_impact: FacultyImpactMatrixItem[];
  placement_ready: PlacementCandidate[];
  spotlight_results: SpotlightResult[];
  top_performers: Array<Record<string, unknown>>;
  attendance_defaulters: Array<Record<string, unknown>>;
  internal_defaulters: Array<Record<string, unknown>>;
  backlog_clusters: Array<Record<string, unknown>>;
  opportunity_students: Array<Record<string, unknown>>;
  watchlist_students: RiskRegistryResponse['items'];
  batch_health: Array<Record<string, unknown>>;
  semester_pulse: Array<Record<string, unknown>>;
  risk_summary: AdminRiskSummary;
  placement_summary: AdminPlacementSummary;
  leaderboard_snapshots: AdminLeaderboardSnapshot[];
  subject_coverage: AdminSubjectCoverage[];
  action_queue: AdminCohortAction[];
  quick_actions: string[];
  subject_catalog: SubjectCatalogItem[];
}

export interface LeaderboardEntry {
  roll_no: string;
  student_name: string;
  batch?: string | null;
  current_semester?: number | null;
  subject_code: string;
  subject_name: string;
  total_marks: number;
  internal_marks: number;
  grade?: string | null;
  class_rank: number;
  batch_rank: number;
  percentile: number;
}

export interface SubjectLeaderboardResponse {
  subject_code: string;
  subject_name: string;
  top_leaderboard: LeaderboardEntry[];
  bottom_leaderboard: LeaderboardEntry[];
  pagination: PaginationMeta;
}

export interface SubjectCatalogItem {
  subject_code: string;
  subject_name: string;
  semester?: number | null;
  records: number;
}

export interface StudentSkillDomainScore {
  domain: string;
  score: number;
}

export interface StudentSubjectHighlight {
  subject_code: string;
  subject_name: string;
  semester: number;
  grade?: string | null;
  total_marks: number;
  internal_marks: number;
  score: number;
  note: string;
}

export interface StudentPeerBenchmark {
  cohort_size: number;
  class_rank: number;
  percentile: number;
  cohort_avg_gpa: number;
  gap_from_cohort: number;
}

export interface StudentRiskDriver {
  label: string;
  value: number;
  status: 'positive' | 'warning' | 'critical' | 'neutral';
}

export interface StudentSemesterVelocity {
  semester: number;
  sgpa: number;
  previous_sgpa?: number | null;
  velocity?: number | null;
  attendance_pct: number;
  internal_avg: number;
}

export interface Student360Profile {
  roll_no: string;
  reg_no?: string | null;
  student_name: string;
  batch?: string | null;
  section?: string | null;
  current_semester?: number | null;
  overall_gpa: number;
  attendance_percentage: number;
  gpa_trend: 'Rising' | 'Stable' | 'Falling';
  gpa_velocity: number;
  attendance_marks_correlation: number;
  active_arrears: number;
  risk_level: RiskLevel;
  attendance_band: string;
  placement_signal: string;
  skill_domains: StudentSkillDomainScore[];
  semester_velocity: StudentSemesterVelocity[];
  strongest_subjects: StudentSubjectHighlight[];
  support_subjects: StudentSubjectHighlight[];
  peer_benchmark: StudentPeerBenchmark;
  risk_drivers: StudentRiskDriver[];
  recommended_actions: string[];
}

export interface RiskRegistryResponse {
  items: Array<{
    roll_no: string;
    name: string;
    risk_score: number;
    attendance_factor: number;
    internal_marks_factor: number;
    gpa_drop_factor: number;
    is_at_risk: boolean;
    risk_level: RiskLevel;
    alerts: string[];
  }>;
  pagination: PaginationMeta;
}
