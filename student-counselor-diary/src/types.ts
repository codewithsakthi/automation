export interface Student {
  roll_no: string;
  name: string;
  klnce_reg_no?: string;
  batch?: string;
  date_of_birth?: string;
  sex?: 'Male' | 'Female' | 'Other';
  blood_group?: string;
  height_cm?: string;
  weight_kg?: string;
  admission_date?: string;
  ug_background?: string;
  ug_percentage?: string;
  photo?: string;
  profile_pic_path?: string;
  
  contact_info?: ContactInfo;
  family_details?: FamilyDetails;
  identification_marks?: IdentificationMark[];
  previous_academics?: PreviousAcademic[];
  extra_curricular?: ExtraCurricular[];
  counselor_diary?: CounselorDiaryEntry[];
  test_marks?: TestMark[];
  exam_marks?: ExamMark[];
}

export interface ContactInfo {
  address?: string;
  city?: string;
  pincode?: string;
  phone_primary?: string;
  phone_secondary?: string;
  email?: string;
}

export interface FamilyDetails {
  father_name?: string;
  mother_name?: string;
  parent_occupation?: string;
  parent_address?: string;
  parent_phone?: string;
  parent_email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

export interface IdentificationMark {
  id?: number;
  roll_no?: string;
  description: string;
}

export interface PreviousAcademic {
  id?: number;
  roll_no?: string;
  level: string;
  institution: string;
  year_passing: string;
  percentage: string;
  board_university?: string;
}

export interface ExtraCurricular {
  id?: number;
  roll_no?: string;
  activity_type: string;
  description: string;
  year?: string;
}

export interface CounselorDiaryEntry {
  id?: number;
  roll_no?: string;
  date: string;
  remarks: string;
  category?: string;
  counselor_name?: string;
}

export interface TestMark {
  id?: number;
  roll_no?: string;
  semester: number;
  subject_code_name: string;
  test1?: string;
  test2?: string;
  test3?: string;
}

export interface ExamMark {
  id?: number;
  roll_no?: string;
  semester: number;
  subject_code: string;
  subject_title: string;
  internal_marks?: string;
  marks?: string;
  grade?: string;
  attempt?: string;
  remarks?: string;
}
