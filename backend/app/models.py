from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, Numeric, ARRAY, CHAR, TIMESTAMP, text
from sqlalchemy.orm import relationship
from .database import Base

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

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String(20), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    credits = Column(Integer, default=0)
    program_id = Column(Integer, ForeignKey("programs.id"))
    semester = Column(Integer)

class StudentMark(Base):
    __tablename__ = "student_marks"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    semester = Column(Integer, nullable=False)
    cit1_marks = Column(Numeric(5,2))
    cit2_marks = Column(Numeric(5,2))
    cit3_marks = Column(Numeric(5,2))
    semester_exam_marks = Column(Numeric(5,2))
    internal_marks = Column(Numeric(5,2))
    total_marks = Column(Numeric(5,2))
    grade = Column(String(2))
    result_status = Column(String(10))

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

    student = relationship("Student", back_populates="attendance")
