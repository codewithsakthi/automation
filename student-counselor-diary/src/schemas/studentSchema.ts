import { z } from 'zod';

export const studentSchema = z.object({
  // Core Student Information
  roll_no: z.string().min(1, "Roll No is required"),
  name: z.string().min(1, "Name is required"),
  klnce_reg_no: z.string().optional(),
  batch: z.string().optional(),
  date_of_birth: z.string().optional(),
  sex: z.enum(['Male', 'Female', 'Other']).optional(),
  blood_group: z.string().optional(),
  height_cm: z.string().optional(),
  weight_kg: z.string().optional(),
  admission_date: z.string().optional(),
  ug_background: z.string().optional(),
  ug_percentage: z.string().optional(),
  photo: z.string().optional(),
  profile_pic_path: z.string().optional(),

  // Contact Info
  contact_info: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    phone_primary: z.string().optional(),
    phone_secondary: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }).optional(),

  // Family Details
  family_details: z.object({
    father_name: z.string().optional(),
    mother_name: z.string().optional(),
    parent_occupation: z.string().optional(),
    parent_address: z.string().optional(),
    parent_phone: z.string().optional(),
    parent_email: z.string().email().optional().or(z.literal('')),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    emergency_contact_relation: z.string().optional(),
  }).optional(),

  // Identification Marks
  identification_marks: z.array(z.object({
    description: z.string(),
  })).optional(),

  // Previous Academics
  previous_academics: z.array(z.object({
    level: z.string(), // SSLC, HSC, UG
    institution: z.string(),
    year_passing: z.string(),
    percentage: z.string(),
    board_university: z.string().optional(),
  })).optional(),

  // Extra Curricular
  extra_curricular: z.array(z.object({
    activity_type: z.string(),
    description: z.string(),
    year: z.string().optional(),
  })).optional(),

  // Counselor Diary
  counselor_diary: z.array(z.object({
    date: z.string(),
    remarks: z.string(),
    category: z.string().optional(),
    counselor_name: z.string().optional(),
  })).optional(),

  // Test Marks (Internal)
  test_marks: z.array(z.object({
    semester: z.union([z.string(), z.number()]).transform(val => Number(val)),
    subject_code_name: z.string(),
    test1: z.string().optional(),
    test2: z.string().optional(),
    test3: z.string().optional(),
  })).optional(),

  // Exam Marks (Semester Grades)
  exam_marks: z.array(z.object({
    semester: z.union([z.string(), z.number()]).transform(val => Number(val)),
    subject_code: z.string(),
    subject_title: z.string(),
    internal_marks: z.string().optional(),
    marks: z.string().optional(),
    grade: z.string().optional(),
    attempt: z.string().optional(),
    remarks: z.string().optional(),
  })).optional(),
});

export type StudentFormData = z.infer<typeof studentSchema>;
