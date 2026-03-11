from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    pass


class Role(RoleBase):
    id: int

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str
    role_id: int


class User(UserBase):
    id: int
    role_id: int
    is_initial_password: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CurrentUser(User):
    role: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    roll_no: Optional[str] = None
    reg_no: Optional[str] = None
    batch: Optional[str] = None
    current_semester: Optional[int] = None
    program_name: Optional[str] = None
    rank: Optional[int] = None


class ProfileUpdate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    batch: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class MessageResponse(BaseModel):
    message: str


class BulkImportStudentResult(BaseModel):
    roll_no: str
    name: Optional[str] = None
    username: str
    initial_password: Optional[str] = None
    file_name: str


class BulkImportError(BaseModel):
    file_name: str
    error: str


class BulkImportResponse(BaseModel):
    message: str
    imported_count: int
    error_count: int
    imported_students: List[BulkImportStudentResult] = Field(default_factory=list)
    errors: List[BulkImportError] = Field(default_factory=list)


class AdminStudentCredential(BaseModel):
    roll_no: str
    username: str
    has_account: bool = True
    is_initial_password: bool
    initial_password_hint: Optional[str] = None
    dob_masked: Optional[str] = None
    note: Optional[str] = None


class StudentBase(BaseModel):
    roll_no: str
    reg_no: Optional[str]
    name: str
    dob: date
    email: Optional[EmailStr]
    batch: Optional[str]
    program_id: Optional[int]
    current_semester: Optional[int]


class StudentCreate(StudentBase):
    user_id: int


class Student(StudentBase):
    id: int

    class Config:
        from_attributes = True


class MarkBase(BaseModel):
    semester: int
    cit1_marks: Optional[float]
    cit2_marks: Optional[float]
    cit3_marks: Optional[float]
    semester_exam_marks: Optional[float]
    grade: Optional[str]
    result_status: Optional[str]


class Mark(MarkBase):
    id: int
    student_id: int
    subject_id: int
    internal_marks: Optional[float]
    total_marks: Optional[float]

    class Config:
        from_attributes = True


class Subject(BaseModel):
    id: int
    course_code: str
    name: str
    credits: int = 0
    semester: Optional[int] = None

    class Config:
        from_attributes = True


class StudentMark(Mark):
    subject: Optional[Subject] = None


class AttendanceBase(BaseModel):
    date: date
    hours_per_day: int
    status_array: List[str]


class Attendance(AttendanceBase):
    id: int
    student_id: int
    total_present: int
    total_hours: int

    class Config:
        from_attributes = True


class Program(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class StudentPerformance(Student):
    program: Optional[Program] = None
    marks: List[StudentMark] = Field(default_factory=list)
    attendance: List[Attendance] = Field(default_factory=list)


class GradeDistributionItem(BaseModel):
    grade: str
    count: int


class SemesterPerformanceItem(BaseModel):
    semester: int
    subject_count: int
    average_internal: float
    average_grade_points: float
    backlog_count: int


class RiskSubjectItem(BaseModel):
    subject: str
    course_code: str
    semester: int
    grade: str
    internal_marks: float
    risk_reason: str


class StrengthSubjectItem(BaseModel):
    subject: str
    course_code: str
    semester: int
    grade: str
    score: float


class AttendanceInsight(BaseModel):
    total_present: int
    total_hours: int
    percentage: float
    recent_streak_days: int
    absent_days: int


class AnalyticsSummary(BaseModel):
    average_grade_points: float
    average_internal: float
    total_backlogs: int
    total_subjects: int
    grade_distribution: List[GradeDistributionItem] = Field(default_factory=list)
    semester_performance: List[SemesterPerformanceItem] = Field(default_factory=list)
    risk_subjects: List[RiskSubjectItem] = Field(default_factory=list)
    strength_subjects: List[StrengthSubjectItem] = Field(default_factory=list)
    attendance: AttendanceInsight


class AdminStudentSnapshot(BaseModel):
    roll_no: str
    reg_no: Optional[str] = None
    name: str
    batch: Optional[str] = None
    program_name: Optional[str] = None
    current_semester: Optional[int] = None
    average_grade_points: float
    attendance_percentage: float
    backlogs: int
    is_initial_password: bool


class AdminOverview(BaseModel):
    total_students: int
    total_staff: int
    total_admins: int
    students_needing_attention: int
    average_attendance: float
    average_grade_points: float
    recent_students: List[AdminStudentSnapshot] = Field(default_factory=list)
    top_performers: List[AdminStudentSnapshot] = Field(default_factory=list)
    attention_required: List[AdminStudentSnapshot] = Field(default_factory=list)


class AdminDirectoryStudent(BaseModel):
    roll_no: str
    reg_no: Optional[str] = None
    name: str
    city: Optional[str] = None
    email: Optional[str] = None
    phone_primary: Optional[str] = None
    batch: Optional[str] = None
    current_semester: Optional[int] = None
    marks_count: int = 0
    attendance_count: int = 0
    attendance_percentage: float = 0.0
    average_grade_points: float = 0.0
    average_internal_percentage: float = 0.0
    backlogs: int = 0
    rank: Optional[int] = None


class AdminDirectoryInsightItem(BaseModel):
    label: str
    count: int


class AdminDirectoryInsights(BaseModel):
    total_records: int
    risk_students: int
    cities: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    batches: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    semesters: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    missing_email_count: int = 0
    missing_phone_count: int = 0
    missing_batch_count: int = 0


class AdminRiskBreakdown(BaseModel):
    critical: int = 0
    warning: int = 0
    healthy: int = 0
    missing_data: int = 0


class AdminAnalyticsResponse(BaseModel):
    risk_breakdown: AdminRiskBreakdown
    batch_distribution: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    semester_distribution: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    city_distribution: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    attendance_bands: List[AdminDirectoryInsightItem] = Field(default_factory=list)
    gpa_bands: List[AdminDirectoryInsightItem] = Field(default_factory=list)


class ContactInfoRecord(BaseModel):
    address: Optional[str] = None
    pincode: Optional[str] = None
    phone_primary: Optional[str] = None
    phone_secondary: Optional[str] = None
    phone_tertiary: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None


class FamilyDetailsRecord(BaseModel):
    parent_guardian_name: Optional[str] = None
    occupation: Optional[str] = None
    parent_phone: Optional[str] = None
    emergency_name: Optional[str] = None
    emergency_address: Optional[str] = None
    emergency_phone: Optional[str] = None
    emergency_email: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    parent_occupation: Optional[str] = None
    parent_address: Optional[str] = None
    parent_email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_address: Optional[str] = None
    emergency_contact_email: Optional[str] = None


class PreviousAcademicRecord(BaseModel):
    qualification: Optional[str] = None
    school_name: Optional[str] = None
    passing_year: Optional[str] = None
    percentage: Optional[float] = None
    level: Optional[str] = None
    institution: Optional[str] = None
    year_passing: Optional[str] = None
    board_university: Optional[str] = None


class ExtraCurricularRecord(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    year: Optional[str] = None
    activity_type: Optional[str] = None


class CounselorDiaryRecord(BaseModel):
    semester: Optional[int] = None
    meeting_date: Optional[date] = None
    remark_category: Optional[str] = None
    remarks: Optional[str] = None
    action_planned: Optional[str] = None
    follow_up_date: Optional[date] = None
    counselor_name: Optional[str] = None
    created_at: Optional[datetime] = None


class SemesterGradeRecord(BaseModel):
    semester: Optional[int] = None
    subject_code: Optional[str] = None
    subject_title: Optional[str] = None
    grade: Optional[str] = None
    marks: Optional[float] = None
    internal_marks: Optional[float] = None
    attempt: Optional[int] = None
    remarks: Optional[str] = None
    grade_point: Optional[float] = None


class InternalMarkRecord(BaseModel):
    semester: Optional[int] = None
    test_number: Optional[int] = None
    percentage: Optional[float] = None
    subject_code: Optional[str] = None
    subject_title: Optional[str] = None


class StudentRecordHealth(BaseModel):
    completion_percentage: float
    available_sections: List[str] = Field(default_factory=list)
    missing_sections: List[str] = Field(default_factory=list)
    last_counselor_update: Optional[date] = None
    latest_activity_year: Optional[str] = None


class StudentAcademicSnapshot(BaseModel):
    semesters_tracked: int
    grade_entries: int
    internal_tests: int
    previous_qualifications: int
    cgpa_proxy: float
    best_grade: Optional[str] = None
    needs_attention: bool


class FullStudentRecord(BaseModel):
    roll_no: str
    core_profile: Optional[AdminDirectoryStudent] = None
    contact_info: Optional[ContactInfoRecord] = None
    family_details: Optional[FamilyDetailsRecord] = None
    previous_academics: List[PreviousAcademicRecord] = Field(default_factory=list)
    extra_curricular: List[ExtraCurricularRecord] = Field(default_factory=list)
    counselor_diary: List[CounselorDiaryRecord] = Field(default_factory=list)
    semester_grades: List[SemesterGradeRecord] = Field(default_factory=list)
    internal_marks: List[InternalMarkRecord] = Field(default_factory=list)
    record_health: Optional[StudentRecordHealth] = None
    academic_snapshot: Optional[StudentAcademicSnapshot] = None


class ScrapeInfo(BaseModel):
    Name: str
    RollNo: str
    RegNo: str
    Department: str
    Batch: str
    Semester: Optional[str] = None


class ScrapedMark(BaseModel):
    Sem: str
    Subject: str
    Grade: str


class AttendanceSummary(BaseModel):
    Semester: str
    Working: str
    Present: str
    Percentage: str


class DetailedAttendanceDay(BaseModel):
    Date: str
    HoursPerDay: str
    Status: List[str] = Field(default_factory=list)


class CitMarkEntry(BaseModel):
    SlNo: Optional[str] = None
    Date: Optional[str] = None
    Subject: Optional[str] = None
    Marks: Optional[str] = None
    Total: Optional[str] = None


class CitTestGroup(BaseModel):
    test_name: str
    entries: List[CitMarkEntry] = Field(default_factory=list)


class SemesterCitMarks(BaseModel):
    semester: str
    tests: List[CitTestGroup] = Field(default_factory=list)


class UniversityMark(BaseModel):
    SlNo: str
    Semester: str
    PaperCode: str
    PaperName: str
    Credit: str
    Grade: str
    GradePoint: str


class SyncMeta(BaseModel):
    attempts: int
    timeouts: List[int] = Field(default_factory=list)
    duration_seconds: float
    warnings: List[str] = Field(default_factory=list)
    used_cached_data: bool = False


class ScrapeResponse(BaseModel):
    status: str
    message: str
    info: Optional[ScrapeInfo] = None
    marks: List[ScrapedMark] = Field(default_factory=list)
    attendance_summary: List[AttendanceSummary] = Field(default_factory=list)
    detailed_attendance: List[DetailedAttendanceDay] = Field(default_factory=list)
    cit_marks: List[SemesterCitMarks] = Field(default_factory=list)
    university_marks: List[UniversityMark] = Field(default_factory=list)
    coe_results: List[dict] = Field(default_factory=list)
    meta: SyncMeta


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
