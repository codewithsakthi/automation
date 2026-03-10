-- PostgreSQL Schema for Student Performance Analysis
-- Follows 1NF, 2NF, and 3NF normalization
-- Includes Role-Based Authentication (RBAC)

-- 1. Create Roles Table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Initial Roles
INSERT INTO roles (name) VALUES ('admin'), ('staff'), ('student');

-- 2. Create Users Table (Authentication)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL, -- roll_no for students
    password_hash VARCHAR(255) NOT NULL,    -- default: dob (DD/MM/YYYY)
    role_id INTEGER REFERENCES roles(id),
    is_initial_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Programs Table (Normalization: 2NF, 3NF - avoids redundancy in students table)
CREATE TABLE programs (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL, -- e.g., MCA
    name VARCHAR(100) NOT NULL
);

-- 4. Create Students Table
CREATE TABLE students (
    id INTEGER PRIMARY KEY REFERENCES users(id),
    roll_no VARCHAR(20) UNIQUE NOT NULL,
    reg_no VARCHAR(20) UNIQUE,
    name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    email VARCHAR(255),
    batch VARCHAR(20), -- e.g., 2024-2026
    program_id INTEGER REFERENCES programs(id),
    current_semester INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Staff Table
CREATE TABLE staff (
    id INTEGER PRIMARY KEY REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Subjects Table (Normalization: 2NF, 3NF)
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 24MC301
    name VARCHAR(255) NOT NULL,
    credits INTEGER DEFAULT 0,
    program_id INTEGER REFERENCES programs(id),
    semester INTEGER -- The semester this subject belongs to in the curriculum
);

-- 7. Create Student Marks Table (3NF)
CREATE TABLE student_marks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    subject_id INTEGER REFERENCES subjects(id),
    semester INTEGER NOT NULL,
    cit1_marks NUMERIC(5,2),
    cit2_marks NUMERIC(5,2),
    cit3_marks NUMERIC(5,2),
    semester_exam_marks NUMERIC(5,2),
    internal_marks NUMERIC(5,2) GENERATED ALWAYS AS (
        (COALESCE(cit1_marks, 0) + COALESCE(cit2_marks, 0) + COALESCE(cit3_marks, 0)) / 3.0
    ) STORED, -- Example calculation for internal marks
    total_marks NUMERIC(5,2),
    grade VARCHAR(2), -- O, A+, A, B+, B, etc.
    result_status VARCHAR(10), -- Pass, Fail, Absent
    UNIQUE(student_id, subject_id, semester)
);

-- 8. Create Attendance Table (1NF, 2NF, 3NF)
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    date DATE NOT NULL,
    hours_per_day INTEGER DEFAULT 7,
    status_array CHAR(1)[] NOT NULL, -- Array of 'P' (Present), 'A' (Absent), 'O' (On Duty), etc.
    total_present INTEGER,
    total_hours INTEGER,
    UNIQUE(student_id, date)
);

-- Helper to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Indexing for performance
CREATE INDEX idx_student_marks_student_id ON student_marks(student_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);

-- Comment on Normalization:
-- 1NF: All attributes are atomic (status_array handles multiple hours but as a single type/array).
-- 2NF: No partial dependencies. All non-prime attributes are fully functionally dependent on the primary key.
-- 3NF: No transitive dependencies. E.g., student info is in students table, program info is in programs table.
