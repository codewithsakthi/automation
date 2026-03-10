export interface Course {
  code: string;
  title: string;
  category?: string;
}

export interface SemesterSyllabus {
  semester: number;
  courses: Course[];
}

export const syllabusData: SemesterSyllabus[] = [
  {
    semester: 1,
    courses: [
      { code: "24FC101", title: "Probability and Statistics", category: "Foundation Course" },
      { code: "24MC102", title: "Advanced Database Technology", category: "Professional Core" },
      { code: "24MC103", title: "Python Programming", category: "Professional Core" },
      { code: "24MC104", title: "Object Oriented Software Engineering", category: "Professional Core" },
      { code: "24MC105", title: "Modern Operating Systems", category: "Professional Core" },
      { code: "24RM101", title: "Research Methodology and IPR", category: "Research Methodology" },
      { code: "24MC1L1", title: "Python Programming Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC1L2", title: "Advanced Database Technology Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC1L3", title: "Communication Skills Laboratory-I", category: "Employability Enhancement" },
    ]
  },
  {
    semester: 2,
    courses: [
      { code: "24MC201", title: "Internet of Things", category: "Professional Core" },
      { code: "24MC202", title: "Data Structures and Algorithms", category: "Professional Core" },
      { code: "24MC203", title: "Machine Learning", category: "Professional Core" },
      { code: "24MC204", title: "Advanced JAVA", category: "Professional Core" },
      { code: "PEC-I", title: "Professional Elective - I", category: "Professional Elective" },
      { code: "PEC-II", title: "Professional Elective - II", category: "Professional Elective" },
      { code: "24MC2L1", title: "Data Structures and Algorithms Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC2L2", title: "Advanced JAVA Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC2L3", title: "Machine Learning Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC2L4", title: "Communication Skills Laboratory- II", category: "Employability Enhancement" },
    ]
  },
  {
    semester: 3,
    courses: [
      { code: "24MC301", title: "Artificial Intelligence", category: "Professional Core" },
      { code: "24MC302", title: "Cloud Computing", category: "Professional Core" },
      { code: "24MC303", title: "Foundations of Data Science", category: "Professional Core" },
      { code: "24MC304", title: "Security in Computing", category: "Professional Core" },
      { code: "PEC-III", title: "Professional Elective - III", category: "Professional Elective" },
      { code: "OEC-I", title: "Open Elective - I", category: "Open Elective" },
      { code: "24MC3L1", title: "Full Stack Development Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC3L2", title: "Cloud Computing Laboratory", category: "Professional Core (Practical)" },
      { code: "24MC3L3", title: "Mini Project", category: "Employability Enhancement" },
    ]
  },
  {
    semester: 4,
    courses: [
      { code: "24MC4L1", title: "Project Work", category: "Employability Enhancement" },
    ]
  }
];

export const electives: Course[] = [
  // Professional Electives
  { code: "24MC2E1", title: "Fundamentals of Virtual Reality", category: "PEC" },
  { code: "24MC2E2", title: "Mobile Computing", category: "PEC" },
  { code: "24MC2E3", title: "Accounting and Financial Management", category: "PEC" },
  { code: "24MC2E4", title: "Soft Computing Techniques", category: "PEC" },
  { code: "24MC2E5", title: "Computer Organization and Architecture", category: "PEC" },
  { code: "24MC2E6", title: "Operations Research", category: "PEC" },
  { code: "24MC2E7", title: "Service Oriented Architecture", category: "PEC" },
  { code: "24MC2E8", title: "Business Data Analytics", category: "PEC" },
  { code: "24MC3E1", title: "Software Testing and Quality Assurance", category: "PEC" },
  { code: "24MC3E2", title: "Full Stack Development", category: "PEC" },
  { code: "24MC3E3", title: "Professional Ethics in IT", category: "PEC" },
  { code: "24MC3E4", title: "DevOps and Micro services", category: "PEC" },
  
  // Open Electives
  { code: "24MCOE1", title: "Software Project Management", category: "OEC" },
  { code: "24MCOE2", title: "Crypto Currency and Block Chain Technologies", category: "OEC" },
  { code: "24MCOE3", title: "Data Warehousing and Data Mining", category: "OEC" },
  { code: "24MCOE4", title: "Big Data Analytics", category: "OEC" },
];

export const getAllCourses = () => {
  const all = [
    ...syllabusData.flatMap(s => s.courses),
    ...electives
  ];
  return all;
};

export const getCoursesForSemester = (sem: number): Course[] => {
  const regular = syllabusData.find(s => s.semester === sem)?.courses || [];
  
  let relevantElectives: Course[] = [];

  if (sem === 2) {
    // Semester 2: Regular + PE-I + PE-II
    // PE-I: 24MC2E1 - 24MC2E4
    // PE-II: 24MC2E5 - 24MC2E8
    relevantElectives = electives.filter(c => 
      ['24MC2E1', '24MC2E2', '24MC2E3', '24MC2E4', 
       '24MC2E5', '24MC2E6', '24MC2E7', '24MC2E8'].includes(c.code)
    );
  } else if (sem === 3) {
    // Semester 3: Regular + PE-III + OE-I
    // PE-III: 24MC3E1 - 24MC3E4
    // OE-I: 24MCOE1 - 24MCOE4
    relevantElectives = electives.filter(c => 
      ['24MC3E1', '24MC3E2', '24MC3E3', '24MC3E4',
       '24MCOE1', '24MCOE2', '24MCOE3', '24MCOE4'].includes(c.code)
    );
  }

  return [
    ...regular,
    ...relevantElectives
  ];
};
