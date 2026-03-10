import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import db, { initDb } from './db';

// Initialize Database
initDb().catch(console.error);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  
  // Get all students (summary)
  app.get('/api/students', async (req, res) => {
    try {
      const result = await db.query('SELECT roll_no, name, klnce_reg_no, batch, photo, profile_pic_path FROM students ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get single student with all details
  app.get('/api/students/:roll_no', async (req, res) => {
    try {
      const { roll_no } = req.params;
      
      const studentRes = await db.query('SELECT * FROM students WHERE roll_no = $1', [roll_no]);
      const student = studentRes.rows[0];
      
      if (!student) return res.status(404).json({ error: 'Student not found' });

      const contactInfo = await db.query('SELECT * FROM contact_info WHERE roll_no = $1', [roll_no]);
      const familyDetails = await db.query('SELECT * FROM family_details WHERE roll_no = $1', [roll_no]);
      const identificationMarks = await db.query('SELECT * FROM identification_marks WHERE roll_no = $1', [roll_no]);
      const previousAcademics = await db.query('SELECT * FROM previous_academics WHERE roll_no = $1', [roll_no]);
      const extraCurricular = await db.query('SELECT * FROM extra_curricular WHERE roll_no = $1', [roll_no]);
      const counselorDiary = await db.query('SELECT * FROM counselor_diary WHERE roll_no = $1', [roll_no]);
      
      // Marks need transformation to match UI expectation if we want to keep UI simple
      // Or we send raw data. Let's send raw for now and handle in UI or transform here.
      // Transforming to match the UI's expected "row per subject" format
      
      const internalMarksRes = await db.query('SELECT * FROM internal_marks WHERE roll_no = $1', [roll_no]);
      const semesterGradesRes = await db.query('SELECT * FROM semester_grades WHERE roll_no = $1', [roll_no]);

      // Transform internal marks: Group by subject_code and semester
      const testMarksMap = new Map();
      internalMarksRes.rows.forEach(row => {
        const key = `${row.semester}-${row.subject_code}`;
        if (!testMarksMap.has(key)) {
          testMarksMap.set(key, {
            semester: row.semester,
            subject_code_name: row.subject_title ? `${row.subject_code} - ${row.subject_title}` : row.subject_code,
            test1: '',
            test2: '',
            test3: ''
          });
        }
        const entry = testMarksMap.get(key);
        if (row.test_number === 1) entry.test1 = row.percentage;
        if (row.test_number === 2) entry.test2 = row.percentage;
        if (row.test_number === 3) entry.test3 = row.percentage;
      });

      res.json({
        ...student,
        contact_info: contactInfo.rows[0] || {},
        family_details: familyDetails.rows[0] || {},
        identification_marks: identificationMarks.rows,
        previous_academics: previousAcademics.rows,
        extra_curricular: extraCurricular.rows,
        counselor_diary: counselorDiary.rows,
        test_marks: Array.from(testMarksMap.values()),
        exam_marks: semesterGradesRes.rows.map(r => ({
          semester: r.semester,
          subject_code: r.subject_code,
          subject_title: r.subject_title || '',
          internal_marks: r.internal_marks,
          marks: r.marks, // Not in new schema explicitly? Or is it grade?
          grade: r.grade,
          attempt: r.attempt,
          remarks: r.remarks
        }))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

    // Helper to convert empty strings to null
    const sanitize = (val: any) => (val === '' ? null : val);
    const hasValue = (val: any) => val !== '' && val !== null && val !== undefined;

    // Create new student
    app.post('/api/students', async (req, res) => {
    const client = await db.query('BEGIN'); // Start transaction manually if we had a client, but here we use pool. 
    // We need a client for transaction.
    // Since db.query uses pool directly, we can't easily do transaction across multiple db.query calls if we don't expose client.
    // But for this prototype, we'll just execute sequentially. Ideally, use a client.
    
    try {
      const data = req.body;
      
      // 1. Insert Student
      const insertStudentQuery = `
        INSERT INTO students (
          roll_no, name, klnce_reg_no, batch, date_of_birth, sex, blood_group,
          height_cm, weight_kg, admission_date, ug_background, ug_percentage, photo, profile_pic_path
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
      `;
      
      // Use profile_pic_path if provided, otherwise fallback to photo (if provided), otherwise let DB default handle it (but we are passing $14 so we need a value)
      // Actually, if we pass NULL, the default value might not trigger if we explicitly pass NULL? No, in Postgres DEFAULT is used if the column is omitted from INSERT or if DEFAULT keyword is used.
      // If we pass NULL, it inserts NULL.
      // So we should check if we have a value.
      
      const profilePic = data.profile_pic_path || data.photo || null;

      await db.query(insertStudentQuery, [
        data.roll_no, data.name, data.klnce_reg_no, data.batch, 
        sanitize(data.date_of_birth), data.sex, data.blood_group,
        sanitize(data.height_cm), sanitize(data.weight_kg), sanitize(data.admission_date), 
        data.ug_background, sanitize(data.ug_percentage), data.photo, profilePic
      ]);

      // 2. Contact Info
      if (data.contact_info) {
        await db.query(`
          INSERT INTO contact_info (roll_no, address, city, pincode, phone_primary, phone_secondary, email)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          data.roll_no, data.contact_info.address, data.contact_info.city, data.contact_info.pincode,
          data.contact_info.phone_primary, data.contact_info.phone_secondary, data.contact_info.email
        ]);
      }

      // 3. Family Details
      if (data.family_details) {
        await db.query(`
          INSERT INTO family_details (
            roll_no, father_name, mother_name, parent_occupation, parent_address, parent_phone, parent_email,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          data.roll_no, data.family_details.father_name, data.family_details.mother_name,
          data.family_details.parent_occupation, data.family_details.parent_address,
          data.family_details.parent_phone, data.family_details.parent_email,
          data.family_details.emergency_contact_name, data.family_details.emergency_contact_phone,
          data.family_details.emergency_contact_relation
        ]);
      }

      // 4. Identification Marks
      if (data.identification_marks && Array.isArray(data.identification_marks)) {
        for (const mark of data.identification_marks) {
          await db.query('INSERT INTO identification_marks (roll_no, description) VALUES ($1, $2)', [data.roll_no, mark.description]);
        }
      }

      // 5. Previous Academics
      if (data.previous_academics && Array.isArray(data.previous_academics)) {
        for (const acad of data.previous_academics) {
          await db.query(`
            INSERT INTO previous_academics (roll_no, level, institution, year_passing, percentage, board_university)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [data.roll_no, acad.level, acad.institution, sanitize(acad.year_passing), sanitize(acad.percentage), acad.board_university]);
        }
      }

      // 6. Extra Curricular
      if (data.extra_curricular && Array.isArray(data.extra_curricular)) {
        for (const extra of data.extra_curricular) {
          await db.query(`
            INSERT INTO extra_curricular (roll_no, activity_type, description, year)
            VALUES ($1, $2, $3, $4)
          `, [data.roll_no, extra.activity_type, extra.description, sanitize(extra.year)]);
        }
      }

      // 7. Internal Marks (Transform from UI format)
      if (data.test_marks && Array.isArray(data.test_marks)) {
        for (const test of data.test_marks) {
          // test has subject_code_name, test1, test2, test3
          const parts = test.subject_code_name.split(' - ');
          const subjectCode = parts[0];
          const subjectTitle = parts.length > 1 ? parts.slice(1).join(' - ') : null;
          
          if (hasValue(test.test1)) await db.query('INSERT INTO internal_marks (roll_no, subject_code, subject_title, semester, test_number, percentage) VALUES ($1, $2, $3, $4, 1, $5)', [data.roll_no, subjectCode, subjectTitle, sanitize(test.semester), sanitize(test.test1)]);
          if (hasValue(test.test2)) await db.query('INSERT INTO internal_marks (roll_no, subject_code, subject_title, semester, test_number, percentage) VALUES ($1, $2, $3, $4, 2, $5)', [data.roll_no, subjectCode, subjectTitle, sanitize(test.semester), sanitize(test.test2)]);
          if (hasValue(test.test3)) await db.query('INSERT INTO internal_marks (roll_no, subject_code, subject_title, semester, test_number, percentage) VALUES ($1, $2, $3, $4, 3, $5)', [data.roll_no, subjectCode, subjectTitle, sanitize(test.semester), sanitize(test.test3)]);
        }
      }

      // 8. Semester Grades
      if (data.exam_marks && Array.isArray(data.exam_marks)) {
        for (const exam of data.exam_marks) {
          await db.query(`
            INSERT INTO semester_grades (roll_no, subject_code, subject_title, semester, grade, internal_marks, marks, attempt, remarks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [data.roll_no, exam.subject_code, exam.subject_title, sanitize(exam.semester), exam.grade, sanitize(exam.internal_marks), sanitize(exam.marks), sanitize(exam.attempt), exam.remarks]);
        }
      }

      // 9. Counselor Diary
      if (data.counselor_diary && Array.isArray(data.counselor_diary)) {
        for (const entry of data.counselor_diary) {
          await db.query(`
            INSERT INTO counselor_diary (roll_no, date, remarks, category, counselor_name)
            VALUES ($1, $2, $3, $4, $5)
          `, [data.roll_no, sanitize(entry.date), entry.remarks, entry.category, entry.counselor_name]);
        }
      }

      res.status(201).json({ roll_no: data.roll_no, message: 'Student created successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Update student
  app.put('/api/students/:roll_no', async (req, res) => {
    try {
      const { roll_no } = req.params;
      const data = req.body;

      // Update Student
      const profilePic = data.profile_pic_path || data.photo || null;
      
      await db.query(`
        UPDATE students SET
          name = $1, klnce_reg_no = $2, batch = $3, date_of_birth = $4, sex = $5, 
          blood_group = $6, height_cm = $7, weight_kg = $8, admission_date = $9, 
          ug_background = $10, ug_percentage = $11, photo = $12, profile_pic_path = $13
        WHERE roll_no = $14
      `, [
        data.name, data.klnce_reg_no, data.batch, sanitize(data.date_of_birth), data.sex, 
        data.blood_group, sanitize(data.height_cm), sanitize(data.weight_kg), sanitize(data.admission_date), 
        data.ug_background, sanitize(data.ug_percentage), data.photo, profilePic, roll_no
      ]);

      // Update Contact Info
      await db.query('DELETE FROM contact_info WHERE roll_no = $1', [roll_no]);
      if (data.contact_info) {
        await db.query(`
          INSERT INTO contact_info (roll_no, address, city, pincode, phone_primary, phone_secondary, email)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          roll_no, data.contact_info.address, data.contact_info.city, data.contact_info.pincode,
          data.contact_info.phone_primary, data.contact_info.phone_secondary, data.contact_info.email
        ]);
      }

      // Update Family Details
      await db.query('DELETE FROM family_details WHERE roll_no = $1', [roll_no]);
      if (data.family_details) {
        await db.query(`
          INSERT INTO family_details (
            roll_no, father_name, mother_name, parent_occupation, parent_address, parent_phone, parent_email,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          roll_no, data.family_details.father_name, data.family_details.mother_name,
          data.family_details.parent_occupation, data.family_details.parent_address,
          data.family_details.parent_phone, data.family_details.parent_email,
          data.family_details.emergency_contact_name, data.family_details.emergency_contact_phone,
          data.family_details.emergency_contact_relation
        ]);
      }

      // Update related tables (Delete all and re-insert)
      await db.query('DELETE FROM identification_marks WHERE roll_no = $1', [roll_no]);
      if (data.identification_marks && Array.isArray(data.identification_marks)) {
        for (const mark of data.identification_marks) {
          await db.query('INSERT INTO identification_marks (roll_no, description) VALUES ($1, $2)', [roll_no, mark.description]);
        }
      }

      await db.query('DELETE FROM previous_academics WHERE roll_no = $1', [roll_no]);
      if (data.previous_academics && Array.isArray(data.previous_academics)) {
        for (const acad of data.previous_academics) {
          await db.query(`
            INSERT INTO previous_academics (roll_no, level, institution, year_passing, percentage, board_university)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [roll_no, acad.level, acad.institution, sanitize(acad.year_passing), sanitize(acad.percentage), acad.board_university]);
        }
      }

      await db.query('DELETE FROM extra_curricular WHERE roll_no = $1', [roll_no]);
      if (data.extra_curricular && Array.isArray(data.extra_curricular)) {
        for (const extra of data.extra_curricular) {
          await db.query(`
            INSERT INTO extra_curricular (roll_no, activity_type, description, year)
            VALUES ($1, $2, $3, $4)
          `, [roll_no, extra.activity_type, extra.description, sanitize(extra.year)]);
        }
      }

      await db.query('DELETE FROM internal_marks WHERE roll_no = $1', [roll_no]);
      if (data.test_marks && Array.isArray(data.test_marks)) {
        for (const test of data.test_marks) {
          const parts = test.subject_code_name.split(' - ');
          const subjectCode = parts[0];
          const subjectTitle = parts.length > 1 ? parts.slice(1).join(' - ') : null;

          if (hasValue(test.test1)) await db.query('INSERT INTO internal_marks (roll_no, subject_code, subject_title, semester, test_number, percentage) VALUES ($1, $2, $3, $4, 1, $5)', [roll_no, subjectCode, subjectTitle, sanitize(test.semester), sanitize(test.test1)]);
          if (hasValue(test.test2)) await db.query('INSERT INTO internal_marks (roll_no, subject_code, subject_title, semester, test_number, percentage) VALUES ($1, $2, $3, $4, 2, $5)', [roll_no, subjectCode, subjectTitle, sanitize(test.semester), sanitize(test.test2)]);
          if (hasValue(test.test3)) await db.query('INSERT INTO internal_marks (roll_no, subject_code, subject_title, semester, test_number, percentage) VALUES ($1, $2, $3, $4, 3, $5)', [roll_no, subjectCode, subjectTitle, sanitize(test.semester), sanitize(test.test3)]);
        }
      }

      await db.query('DELETE FROM semester_grades WHERE roll_no = $1', [roll_no]);
      if (data.exam_marks && Array.isArray(data.exam_marks)) {
        for (const exam of data.exam_marks) {
          await db.query(`
            INSERT INTO semester_grades (roll_no, subject_code, subject_title, semester, grade, internal_marks, marks, attempt, remarks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [roll_no, exam.subject_code, exam.subject_title, sanitize(exam.semester), exam.grade, sanitize(exam.internal_marks), sanitize(exam.marks), sanitize(exam.attempt), exam.remarks]);
        }
      }

      await db.query('DELETE FROM counselor_diary WHERE roll_no = $1', [roll_no]);
      if (data.counselor_diary && Array.isArray(data.counselor_diary)) {
        for (const entry of data.counselor_diary) {
          await db.query(`
            INSERT INTO counselor_diary (roll_no, date, remarks, category, counselor_name)
            VALUES ($1, $2, $3, $4, $5)
          `, [roll_no, sanitize(entry.date), entry.remarks, entry.category, entry.counselor_name]);
        }
      }

      res.json({ message: 'Student updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Delete student
  app.delete('/api/students/:roll_no', async (req, res) => {
    try {
      const { roll_no } = req.params;
      await db.query('DELETE FROM students WHERE roll_no = $1', [roll_no]);
      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
