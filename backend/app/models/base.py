from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, Numeric, ARRAY, CHAR, TIMESTAMP, text, Computed, BigInteger, CheckConstraint, UniqueConstraint, Index, func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"))
    is_initial_password = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP"))

    role = relationship("Role")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(String(255), unique=True, index=True, nullable=False) # JTI
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    revoked_at = Column(TIMESTAMP, nullable=True)

    user = relationship("User", back_populates="refresh_tokens")

class Program(Base):
    __tablename__ = "programs"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(100), nullable=False)

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    roll_no = Column(String(20), unique=True, nullable=False)
    reg_no = Column(String(20), unique=True)
    name = Column(String(255), nullable=False)
    dob = Column(Date, nullable=False)
    email = Column(String(255))
    batch = Column(String(20))
    section = Column(String(10))
    program_id = Column(Integer, ForeignKey("programs.id"))
    current_semester = Column(Integer, default=1)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    user = relationship("User")
    program = relationship("Program")
    marks = relationship("StudentMark", back_populates="student")
    attendance = relationship("Attendance", back_populates="student")

class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True)
    department = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    user = relationship("User")
    assignments = relationship("FacultySubjectAssignment", back_populates="faculty")
    timetable = relationship("TimeTable", back_populates="faculty")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String(20), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    credits = Column(Integer, default=0)
    program_id = Column(Integer, ForeignKey("programs.id"))
    semester = Column(Integer)
    faculty_assignments = relationship("FacultySubjectAssignment", back_populates="subject")
    timetable_entries = relationship("TimeTable", back_populates="subject")

class StudentMark(Base):
    __tablename__ = "student_marks"
    
    id = Column(BigInteger, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    semester = Column(Integer, nullable=False)
    
    # Raw Inputs
    cit1_marks = Column(Numeric(5, 2))
    cit2_marks = Column(Numeric(5, 2))
    cit3_marks = Column(Numeric(5, 2))
    semester_exam_marks = Column(Numeric(5, 2))
    
    # Derived Columns (Stored)
    internal_marks = Column(Numeric(5, 2), Computed(
        "GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0))",
        persisted=True
    ))
    total_marks = Column(Numeric(5, 2), Computed(
        "GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)",
        persisted=True
    ))
    grade = Column(String(2), Computed(
        """CASE 
            WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 90 THEN 'O'
            WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 80 THEN 'A+'
            WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 70 THEN 'A'
            WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 60 THEN 'B+'
            WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 50 THEN 'B'
            WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 45 THEN 'C'
            ELSE 'F' 
        END""",
        persisted=True
    ))
    result_status = Column(String(10), Computed(
        "CASE WHEN (GREATEST(COALESCE(cit1_marks, 0), COALESCE(cit2_marks, 0), COALESCE(cit3_marks, 0)) + COALESCE(semester_exam_marks, 0)) >= 50 THEN 'Pass' ELSE 'Fail' END",
        persisted=True
    ))

    # Audit Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Constraints & Indexes
    __table_args__ = (
        UniqueConstraint('student_id', 'subject_id', 'semester', name='uq_student_subject_semester'),
        CheckConstraint('cit1_marks BETWEEN -1 AND 100', name='chk_cit1'),
        CheckConstraint('cit2_marks BETWEEN -1 AND 100', name='chk_cit2'),
        CheckConstraint('cit3_marks BETWEEN -1 AND 100', name='chk_cit3'),
        CheckConstraint('semester_exam_marks BETWEEN 0 AND 100', name='chk_sem'),
        CheckConstraint('semester BETWEEN 1 AND 12', name='chk_semester'),
        Index('idx_sm_student_id', 'student_id'),
        Index('idx_sm_subject_semester', 'subject_id', 'semester'),
        Index('idx_sm_failed', 'student_id', 'semester', postgresql_where=text("result_status = 'Fail'")),
    )

    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    date = Column(Date, nullable=False)
    hours_per_day = Column(Integer, default=7)
    status_array = Column(ARRAY(CHAR(1)), nullable=False)
    total_present = Column(Integer)
    total_hours = Column(Integer)
    semester = Column(Integer)

    student = relationship("Student", back_populates="attendance")


class FacultySubjectAssignment(Base):
    __tablename__ = "faculty_subject_assignments"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    academic_year = Column(String(20))
    section = Column(String(20))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    faculty = relationship("Staff", back_populates="assignments")
    subject = relationship("Subject", back_populates="faculty_assignments")

class TimeTable(Base):
    __tablename__ = "timetable"
    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer) # 0 for Monday, 6 for Sunday
    hour = Column(Integer) # 1 to 7
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    section = Column(String(20))
    semester = Column(Integer)
    academic_year = Column(String(20))

    faculty = relationship("Staff", back_populates="timetable")
    subject = relationship("Subject", back_populates="timetable_entries")

class ContactInfo(Base):
    __tablename__ = "contact_info"
    roll_no = Column(String(255), primary_key=True)
    address = Column(String)
    pincode = Column(String)
    phone_primary = Column(String)
    phone_secondary = Column(String)
    phone_tertiary = Column(String)
    email = Column(String)
    city = Column(String)

class FamilyDetail(Base):
    __tablename__ = "family_details"
    roll_no = Column(String(255), primary_key=True)
    parent_guardian_name = Column(String)
    occupation = Column(String)
    parent_phone = Column(String)
    emergency_name = Column(String)
    emergency_address = Column(String)
    emergency_phone = Column(String)
    emergency_email = Column(String)
    father_name = Column(String)
    mother_name = Column(String)
    parent_occupation = Column(String)
    parent_address = Column(String)
    parent_email = Column(String)
    emergency_contact_name = Column(String)
    emergency_contact_phone = Column(String)
    emergency_contact_relation = Column(String)
    emergency_contact_address = Column(String)
    emergency_contact_email = Column(String)

class PreviousAcademic(Base):
    __tablename__ = "previous_academics"
    id = Column(Integer, primary_key=True)
    roll_no = Column(String(255))
    qualification = Column(String)
    school_name = Column(String)
    passing_year = Column(String)
    percentage = Column(Numeric)
    level = Column(String)
    institution = Column(String)
    year_passing = Column(String)
    board_university = Column(String)

class SemesterGrade(Base):
    __tablename__ = "semester_grades"
    id = Column(Integer, primary_key=True)
    roll_no = Column(String(255))
    semester = Column(Integer)
    subject_code = Column(String)
    subject_title = Column(String)
    grade = Column(String)
    marks = Column(Numeric)
    internal_marks = Column(Numeric)
    attempt = Column(Integer)
    remarks = Column(String)

class InternalMark(Base):
    __tablename__ = "internal_marks"
    id = Column(Integer, primary_key=True)
    roll_no = Column(String(255))
    semester = Column(Integer)
    test_number = Column(Integer)
    percentage = Column(Numeric)
    subject_code = Column(String)
    subject_title = Column(String)

class CounselorDiary(Base):
    __tablename__ = "counselor_diary"
    meeting_id = Column(Integer, primary_key=True)
    roll_no = Column(String(255))
    semester = Column(Integer)
    meeting_date = Column(Date)
    remark_category = Column(String)
    remarks = Column(String)
    action_planned = Column(String)
    follow_up_date = Column(Date)
    counselor_name = Column(String)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class ExtraCurricular(Base):
    __tablename__ = "extra_curricular"
    activity_id = Column(Integer, primary_key=True)
    roll_no = Column(String(255))
    category = Column(String)
    description = Column(String)
    year = Column(String)
    activity_type = Column(String)

class AttendanceSummary(Base):
    __tablename__ = "attendance_summary"
    roll_no = Column(String(255), primary_key=True)
    semester = Column(Integer, primary_key=True)
    present_days = Column(Integer)
    absent_days = Column(Integer)
    leave_days = Column(Integer)
