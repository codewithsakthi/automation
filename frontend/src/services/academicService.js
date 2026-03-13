const FAIL_GRADES = new Set(['U', 'FAIL', 'F', 'W', 'I', 'AB']);

export const CHART_COLORS = ['#38bdf8', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#f97316'];

export const fmt = (value, fallback = '-') => (value === null || value === undefined || value === '' ? fallback : value);
export const num = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');

export const GRADE_POINTS = {
  O: 10,
  S: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  D: 4,
  E: 3,
  PASS: 5,
  P: 5,
  FAIL: 0,
  F: 0,
  U: 0,
  W: 0,
  I: 0,
  AB: 0,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const avg = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const normalizeGrade = (grade) => String(grade || '').trim().toUpperCase();
const gradePointFor = (entry) => {
  if (Number.isFinite(Number(entry?.grade_point))) {
    return Number(entry.grade_point);
  }
  return GRADE_POINTS[normalizeGrade(entry?.grade)] ?? 0;
};

const groupSemesterTrend = (semesterGrades = []) => {
  const grouped = semesterGrades.reduce((acc, item) => {
    const semester = Number(item.semester || 0);
    if (!semester) return acc;

    if (!acc[semester]) {
      acc[semester] = { gradePoints: [], internals: [], failures: 0, entries: 0 };
    }

    acc[semester].gradePoints.push(gradePointFor(item));
    if (item.internal_marks !== null && item.internal_marks !== undefined) {
      acc[semester].internals.push(Number(item.internal_marks));
    }
    if (FAIL_GRADES.has(normalizeGrade(item.grade))) {
      acc[semester].failures += 1;
    }
    acc[semester].entries += 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([semester, values]) => ({
      semester: Number(semester),
      label: `Sem ${semester}`,
      averageGradePoints: round(avg(values.gradePoints)),
      averageInternal: round(avg(values.internals)),
      failCount: values.failures,
      passCount: values.entries - values.failures,
      entries: values.entries,
    }))
    .sort((a, b) => a.semester - b.semester);
};

const buildStudentStrengths = (record) => {
  const semesterGrades = record?.semester_grades || [];
  const ordered = [...semesterGrades].sort((a, b) => gradePointFor(b) - gradePointFor(a));
  const strong = ordered.filter((item) => gradePointFor(item) >= 8).slice(0, 3);
  const weak = [...semesterGrades]
    .filter((item) => gradePointFor(item) <= 5 || FAIL_GRADES.has(normalizeGrade(item.grade)))
    .sort((a, b) => gradePointFor(a) - gradePointFor(b))
    .slice(0, 3);

  return { strong, weak };
};

export const buildStudentIntelligence = (student, record) => {
  // Use pre-calculated semester performance from backend
  const semesterTrend = (record?.semester_performance || []).sort((a, b) => a.semester - b.semester);
  const latest = semesterTrend[semesterTrend.length - 1];
  const previous = semesterTrend[semesterTrend.length - 2];
  
  const averageGpa = record?.average_grade_points || student?.average_grade_points || 0;
  const gpaDrop = (previous && latest) ? round(previous.average_grade_points - latest.average_grade_points) : 0;
  const failCount = record?.total_backlogs || 0;
  const attendance = Number(record?.attendance?.percentage || student?.attendance_percentage || 0);
  
  // Calculate a simplified risk score for the frontend visualization
  const riskScore = record?.risk?.risk_score || clamp(
    round(
      Math.max(0, 7.0 - averageGpa) * 15 +
      failCount * 12 +
      Math.max(0, gpaDrop) * 20 +
      Math.max(0, 75 - attendance) * 1.0,
      0,
    ),
    0,
    100,
  );

  const failureProbability = clamp(round(0.12 + (riskScore / 115), 2), 0, 0.99);
  const predictedGpa = clamp(round((latest?.average_grade_points || averageGpa) - Math.max(0, gpaDrop) * 0.35 - (failCount > 0 ? 0.1 : 0) + (attendance >= 85 ? 0.12 : 0), 2), 0, 10);
  const placementReadiness = record?.metrics?.find(m => m.label === "Placement Readiness")?.value || 0;
  
  const trendDirection = gpaDrop > 0.3 ? 'declining' : (latest && previous && latest.average_grade_points > previous.average_grade_points) ? 'improving' : 'stable';
  const riskLevel = record?.risk?.risk_level || (riskScore >= 75 ? 'Critical' : riskScore >= 55 ? 'High' : riskScore >= 35 ? 'Moderate' : 'Low');

  const reasons = [
    averageGpa < 6.5 ? `Average GPA is ${num(averageGpa)}.` : null,
    failCount > 0 ? `${failCount} failed subject${failCount > 1 ? 's' : ''} recorded.` : null,
    gpaDrop > 0.4 ? `GPA dropped by ${num(gpaDrop)} between recent semesters.` : null,
    attendance < 75 ? `Attendance is below threshold at ${num(attendance)}%.` : null,
  ].filter(Boolean);

  const { strong, weak } = buildStudentStrengths(record);

  return {
    rollNo: student?.roll_no || record?.roll_no,
    studentName: student?.name || record?.core_profile?.name || 'Student',
    averageGpa,
    gpaDrop,
    failCount,
    attendance,
    riskScore,
    riskLevel,
    failureProbability,
    predictedGpa,
    placementReadiness,
    trendDirection,
    reasons,
    semesterTrend,
    strengths: strong,
    weaknesses: weak,
    failedSubjects: record?.risk_subjects || [],
  };
};

const buildSubjectDifficulty = (records = []) => {
  const subjectMap = {};

  records.forEach((record) => {
    (record?.semester_grades || []).forEach((item) => {
      const key = item.subject_code || item.subject_title;
      if (!key) return;

      if (!subjectMap[key]) {
        subjectMap[key] = {
          code: item.subject_code || key,
          subject: item.subject_title || item.subject_code || key,
          semester: item.semester,
          gradePoints: [],
          internals: [],
          failures: 0,
          count: 0,
        };
      }

      subjectMap[key].gradePoints.push(gradePointFor(item));
      if (item.internal_marks !== null && item.internal_marks !== undefined) {
        subjectMap[key].internals.push(Number(item.internal_marks));
      }
      if (FAIL_GRADES.has(normalizeGrade(item.grade))) {
        subjectMap[key].failures += 1;
      }
      subjectMap[key].count += 1;
    });
  });

  const subjects = Object.values(subjectMap).map((item) => {
    const averageGradePoint = avg(item.gradePoints);
    const mean = averageGradePoint;
    const variance = item.gradePoints.length
      ? item.gradePoints.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / item.gradePoints.length
      : 0;
    const failRate = item.count ? (item.failures / item.count) * 100 : 0;
    const difficultyIndex = round((failRate * 0.55) + ((10 - averageGradePoint) * 4) + (variance * 4));

    return {
      code: item.code,
      subject: item.subject,
      semester: item.semester,
      failRate: round(failRate),
      averageGradePoint: round(averageGradePoint),
      averageInternal: round(avg(item.internals)),
      variance: round(variance),
      difficultyIndex,
      passRate: round(100 - failRate),
    };
  });

  return subjects.sort((a, b) => b.difficultyIndex - a.difficultyIndex);
};

const buildCohorts = (directory = [], riskProfiles = []) => {
  const map = {};

  directory.forEach((student) => {
    const batch = student.batch || 'Unknown';
    if (!map[batch]) {
      map[batch] = { batch, gpas: [], attendance: [], passCount: 0, risk: [], readiness: [], size: 0 };
    }

    const riskProfile = riskProfiles.find((item) => item.rollNo === student.roll_no);
    map[batch].gpas.push(Number(student.average_grade_points || 0));
    map[batch].attendance.push(Number(student.attendance_percentage || 0));
    map[batch].passCount += student.backlogs > 0 ? 0 : 1;
    map[batch].risk.push(riskProfile?.riskScore || 0);
    map[batch].readiness.push(riskProfile?.placementReadiness || 0);
    map[batch].size += 1;
  });

  return Object.values(map).map((cohort) => ({
    batch: cohort.batch,
    students: cohort.size,
    averageGpa: round(avg(cohort.gpas)),
    averageAttendance: round(avg(cohort.attendance)),
    passRate: round(cohort.size ? (cohort.passCount / cohort.size) * 100 : 0),
    averageRisk: round(avg(cohort.risk)),
    readiness: round(avg(cohort.readiness)),
  })).sort((a, b) => String(a.batch).localeCompare(String(b.batch)));
};

const buildClusters = (riskProfiles = []) => {
  const categories = [
    { label: 'High performers', count: 0 },
    { label: 'Average', count: 0 },
    { label: 'Struggling', count: 0 },
    { label: 'Critical risk', count: 0 },
  ];

  riskProfiles.forEach((profile) => {
    if (profile.riskScore >= 75) {
      categories[3].count += 1;
    } else if (profile.averageGpa >= 8 && profile.failCount === 0) {
      categories[0].count += 1;
    } else if (profile.riskScore >= 45 || profile.failCount > 0) {
      categories[2].count += 1;
    } else {
      categories[1].count += 1;
    }
  });

  return categories;
};

const buildHeatmap = (riskProfiles = [], subjectDifficulty = [], records = []) => {
  const targetStudents = [...riskProfiles].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8);
  const targetSubjects = subjectDifficulty.slice(0, 6);

  return targetStudents.map((profile) => {
    const record = records.find((item) => item.roll_no === profile.rollNo);
    const values = targetSubjects.map((subject) => {
      const matches = (record?.semester_grades || []).filter((entry) => (entry.subject_code || entry.subject_title) === subject.code || entry.subject_title === subject.subject);
      const gp = matches.length ? avg(matches.map((entry) => gradePointFor(entry))) : 0;
      return {
        subject: subject.code,
        score: round(gp),
        intensity: gp >= 7.5 ? 'strong' : gp >= 5.5 ? 'average' : 'weak',
      };
    });

    return {
      rollNo: profile.rollNo,
      name: profile.studentName,
      values,
    };
  });
};

const buildAlerts = (riskProfiles = []) => {
  return [...riskProfiles]
    .filter((profile) => profile.riskScore >= 45 || profile.gpaDrop > 0.5 || profile.failCount > 1)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map((profile) => ({
      rollNo: profile.rollNo,
      studentName: profile.studentName,
      severity: profile.riskScore >= 75 ? 'critical' : 'warning',
      summary: profile.reasons[0] || 'Performance requires monitoring.',
      riskScore: profile.riskScore,
    }));
};

const buildInsights = ({ cohorts, subjectDifficulty, riskProfiles, passPercentage, healthScore }) => {
  const insights = [];
  const weakestCohort = [...cohorts].sort((a, b) => a.averageGpa - b.averageGpa)[0];
  const strongestCohort = [...cohorts].sort((a, b) => b.averageGpa - a.averageGpa)[0];
  const hardestSubject = subjectDifficulty[0];
  const riskCount = riskProfiles.filter((item) => item.riskScore >= 55).length;

  if (weakestCohort) {
    insights.push(`Batch ${weakestCohort.batch} is the weakest cohort with ${weakestCohort.averageGpa} GPA and ${weakestCohort.passRate}% pass rate.`);
  }
  if (hardestSubject) {
    insights.push(`${hardestSubject.subject} is currently the hardest subject with ${hardestSubject.failRate}% fail rate and difficulty index ${hardestSubject.difficultyIndex}.`);
  }
  if (strongestCohort && strongestCohort.batch !== weakestCohort?.batch) {
    insights.push(`Batch ${strongestCohort.batch} is leading department performance at ${strongestCohort.averageGpa} GPA.`);
  }
  insights.push(`${riskCount} students are in high or critical risk, and the department pass rate is ${round(passPercentage)}%.`);
  insights.push(`Department health score is ${round(healthScore)} out of 100, blending GPA, attendance, and pass consistency.`);

  return insights;
};

const buildFacultyImpactProxy = (subjectDifficulty = []) => {
  return subjectDifficulty.slice(0, 8).map((subject) => ({
    faculty: `${subject.code} delivery`,
    subject: subject.subject,
    passRate: subject.passRate,
    averageGpa: subject.averageGradePoint,
    impactScore: clamp(round((subject.passRate * 0.55) + (subject.averageGradePoint * 4.5)), 0, 100),
    note: 'Faculty mapping unavailable, using subject delivery performance as a proxy.',
  }));
};

export const buildAcademicControlCenter = (directory = [], records = []) => {
  const riskProfiles = directory.map((student) => buildStudentIntelligence(student, records.find((record) => record.roll_no === student.roll_no)));
  const totalStudents = directory.length;
  const passPercentage = totalStudents ? (directory.filter((student) => Number(student.backlogs || 0) === 0).length / totalStudents) * 100 : 0;
  const averageCgpa = avg(directory.map((student) => Number(student.average_grade_points || 0)));
  const averageAttendance = avg(directory.map((student) => Number(student.attendance_percentage || 0)));
  const healthScore = clamp(round((passPercentage * 0.35) + ((averageCgpa / 10) * 35) + (averageAttendance * 0.2) + (avg(riskProfiles.map((item) => 100 - item.riskScore)) * 0.1)), 0, 100);

  const semesterTrendMap = {};
  records.forEach((record) => {
    groupSemesterTrend(record.semester_grades).forEach((item) => {
      if (!semesterTrendMap[item.semester]) {
        semesterTrendMap[item.semester] = { semester: item.semester, label: item.label, gpas: [], passRates: [] };
      }
      semesterTrendMap[item.semester].gpas.push(item.averageGradePoints);
      semesterTrendMap[item.semester].passRates.push(item.entries ? (item.passCount / item.entries) * 100 : 0);
    });
  });

  const gpaTrend = Object.values(semesterTrendMap)
    .map((item) => ({
      semester: item.label,
      averageGpa: round(avg(item.gpas)),
      passRate: round(avg(item.passRates)),
    }))
    .sort((a, b) => Number(a.semester.replace(/\D/g, '')) - Number(b.semester.replace(/\D/g, '')));

  const subjectDifficulty = buildSubjectDifficulty(records);
  const cohorts = buildCohorts(directory, riskProfiles);
  const clusters = buildClusters(riskProfiles);
  const heatmap = buildHeatmap(riskProfiles, subjectDifficulty, records);
  const alerts = buildAlerts(riskProfiles);
  const placementReadiness = [...riskProfiles]
    .map((item) => ({ rollNo: item.rollNo, name: item.studentName, readiness: item.placementReadiness, predictedGpa: item.predictedGpa }))
    .sort((a, b) => b.readiness - a.readiness);
  const passFailDistribution = [
    { label: 'Pass', value: directory.filter((student) => Number(student.backlogs || 0) === 0).length },
    { label: 'Fail / backlog', value: directory.filter((student) => Number(student.backlogs || 0) > 0).length },
  ];
  const facultyImpactProxy = buildFacultyImpactProxy(subjectDifficulty);

  return {
    metrics: {
      totalStudents,
      passPercentage: round(passPercentage),
      averageCgpa: round(averageCgpa),
      averageAttendance: round(averageAttendance),
      departmentHealthScore: round(healthScore),
      highRiskStudents: riskProfiles.filter((item) => item.riskScore >= 55).length,
    },
    topPerformers: [...riskProfiles].sort((a, b) => b.averageGpa - a.averageGpa).slice(0, 6),
    highRiskStudents: [...riskProfiles].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8),
    gpaTrend,
    passFailDistribution,
    semesterPerformance: gpaTrend,
    subjectDifficulty,
    hardestSubjects: subjectDifficulty.slice(0, 8),
    easiestSubjects: [...subjectDifficulty].sort((a, b) => a.difficultyIndex - b.difficultyIndex).slice(0, 8),
    cohorts,
    clusters,
    riskProfiles,
    alerts,
    heatmap,
    placementReadiness,
    facultyImpactProxy,
    insights: buildInsights({ cohorts, subjectDifficulty, riskProfiles, passPercentage, healthScore }),
  };
};

export const buildStudentComparison = (selectedRolls = [], directory = [], records = []) => {
  return selectedRolls
    .map((rollNo) => {
      const student = directory.find((item) => item.roll_no === rollNo);
      const record = records.find((item) => item.roll_no === rollNo);
      if (!student || !record) return null;
      const intelligence = buildStudentIntelligence(student, record);
      return {
        rollNo,
        name: student.name,
        averageGpa: intelligence.averageGpa,
        riskScore: intelligence.riskScore,
        predictedGpa: intelligence.predictedGpa,
        readiness: intelligence.placementReadiness,
        failCount: intelligence.failCount,
        trend: intelligence.trendDirection,
      };
    })
    .filter(Boolean);
};
