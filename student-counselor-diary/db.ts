import { Pool } from 'pg';

const DB_CONFIG = {
  user: "avnadmin",
  password: "AVNS_EDm2HpaxXEaH-sggyHi",
  host: "pg-acb89ae-spark-db.a.aivencloud.com",
  port: 24087,
  database: "defaultdb",
  ssl: {
      rejectUnauthorized: true,
      ca: `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIUO+T9RfFjVQfNZ7YKRE1AmS/uS+wwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvZTA2MjMyOTYtNDMzNy00ODgwLTgxZDEtMmJhMTEzMjMw
ZGQ5IFByb2plY3QgQ0EwHhcNMjYwMzA3MDcxMTM1WhcNMzYwMzA0MDcxMTM1WjA6
MTgwNgYDVQQDDC9lMDYyMzI5Ni00MzM3LTQ4ODAtODFkMS0yYmExMTMyMzBkZDkg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBALFZOhw7
lOHyABndAff+q7k37SVNEG/IXm4WCkda4Wq4uce6DEd+Ah61KoEGRandAPoVIkP0
kbpKBxUSXkAI0jaUHeqr8B1b6vkGnQgMQN/XzgM3LK/r+FN59o2ZkJRDAxt6bDMs
fhPgg52edxSKn/VD4si5+kO9Zqoy6sTTkf6RSCdatAE8ncIkWm5rmGxI8DPjtPaq
rVc5IhED1STnan7TckTUiQACpjaKRVcxB+ZsfjCtQfI0eHRFDHVfZslTZvwI7RYa
d/SYpMhxx/C0mAHkN5sfjm7BWxmUdflT/KbZuQQ+a/T9ldLvOIh9o6DixUR3H0hf
/O5zBmaZ39jJdApC+1SFq8pj2Iz3cN68izFAaNsIRDNcVc4PqjIxOmXQV1r7IIbm
8F0XLCLpQZoA2b4Bk+O7jvrUct7DMm/7alW/XsFEm0aE9+S5zP5TzfoZl1pNwY0e
zIvhHD//cPLGMFJ/XKTgf5RpLJ1tCOQFLhJz7toocLIHLHw6rD0Ktde5awIDAQAB
o0IwQDAdBgNVHQ4EFgQUDO24B28P9tfPx1AZCav3uuAV1E4wEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBABrmwaq54xmv
m/L2+CH+dgbMiZHKbT1kXdllsC04ZLcmQV81UZwmc4rwoiQyDyA/YbbgBWkA9TKS
ntW31qGKCq0Pjbf7ZDgLyUmVlkKC3ko+lq2f6GC2zNogDXgvkYH41czD9/J957D3
3CdUdsdn6dM7qTNkPhyHdbjPU2OoqVnytpxJBgPP2ZnnYjaW4Yif/7hUWIQ9/2gs
mwkVLzmMpzy7jQctDBE0+oMdQGCkA/Kmgslnq7dooYdPgXGNPodblyDqfDeomSqX
FsrlAdhAE0clw2e7gVlN7npoLjY2FxC74B/wllJcEsIV/MvsqsXttK+d/u99Ev6O
+vpY6LkowpRCgID79QsFm8AJHiFhmGWlo7eLng2nI1lQLn3PMfszdYxR2iCwAk1z
9WFtkfbD+qfFWMoa/erAN0JEfw1KBsvlcAqFwU3YGxAqyiBCql7vAmPlaNhXDbsi
EYnMxfejSQkZwyZgoxKKlluXEiqIwU0PQUFvgr9bjckyO1VXQ2Wjag==
-----END CERTIFICATE-----`,
  },
};

const pool = new Pool(DB_CONFIG);

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Core Student Information
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        roll_no TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        klnce_reg_no TEXT UNIQUE,
        batch TEXT,
        date_of_birth DATE,
        sex TEXT,
        blood_group TEXT,
        height_cm NUMERIC,
        weight_kg NUMERIC,
        admission_date DATE,
        ug_background TEXT,
        ug_percentage NUMERIC,
        photo TEXT,
        profile_pic_path TEXT DEFAULT '/assets/profiles/default.png',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add photo column if it doesn't exist (migration)
    try {
      await client.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS photo TEXT');
    } catch (e) {
      console.log('Column photo might already exist in students');
    }

    // Add profile_pic_path column if it doesn't exist (migration)
    try {
      await client.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_pic_path TEXT DEFAULT '/assets/profiles/default.png'");
    } catch (e) {
      console.log('Column profile_pic_path might already exist in students');
    }

    // Subjects Table (for mapping)
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL
      )
    `);

    // 2. Academic Performance Tracking
    // Table: internal_marks
    await client.query(`
      CREATE TABLE IF NOT EXISTS internal_marks (
        id SERIAL PRIMARY KEY,
        roll_no TEXT NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
        subject_code TEXT NOT NULL,
        subject_title TEXT, -- Added for UI consistency
        semester INTEGER NOT NULL,
        test_number INTEGER NOT NULL, -- 1, 2, 3
        percentage NUMERIC
      )
    `);
    
    // Add subject_title column if it doesn't exist (migration)
    try {
      await client.query('ALTER TABLE internal_marks ADD COLUMN IF NOT EXISTS subject_title TEXT');
    } catch (e) {
      console.log('Column subject_title might already exist in internal_marks');
    }

    // Table: semester_grades
    await client.query(`
      CREATE TABLE IF NOT EXISTS semester_grades (
        id SERIAL PRIMARY KEY,
        roll_no TEXT NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
        subject_code TEXT NOT NULL,
        subject_title TEXT, -- Added to persist title
        semester INTEGER NOT NULL,
        grade TEXT,
        internal_marks NUMERIC,
        marks NUMERIC, -- Added for external/total marks
        attempt INTEGER,
        remarks TEXT
      )
    `);

    // Add subject_title column if it doesn't exist (migration)
    try {
      await client.query('ALTER TABLE semester_grades ADD COLUMN IF NOT EXISTS subject_title TEXT');
    } catch (e) {
      console.log('Column subject_title might already exist in semester_grades');
    }

    // Add marks column if it doesn't exist (migration)
    try {
      await client.query('ALTER TABLE semester_grades ADD COLUMN IF NOT EXISTS marks NUMERIC');
    } catch (e) {
      console.log('Column marks might already exist in semester_grades');
    }

    // 3. Support and Personal History Tables
    
    // Table: identification_marks
    await client.query(`
      CREATE TABLE IF NOT EXISTS identification_marks (
        id SERIAL PRIMARY KEY,
        roll_no TEXT NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
        description TEXT NOT NULL
      )
    `);

    // Table: contact_info
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_info (
        roll_no TEXT PRIMARY KEY REFERENCES students(roll_no) ON DELETE CASCADE,
        address TEXT,
        city TEXT,
        pincode TEXT,
        phone_primary TEXT,
        phone_secondary TEXT,
        email TEXT
      )
    `);

    // Table: family_details
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_details (
        roll_no TEXT PRIMARY KEY REFERENCES students(roll_no) ON DELETE CASCADE,
        father_name TEXT,
        mother_name TEXT,
        parent_occupation TEXT,
        parent_address TEXT,
        parent_phone TEXT,
        parent_email TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        emergency_contact_relation TEXT
      )
    `);

    // Table: previous_academics
    await client.query(`
      CREATE TABLE IF NOT EXISTS previous_academics (
        id SERIAL PRIMARY KEY,
        roll_no TEXT NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
        level TEXT NOT NULL, -- SSLC, HSC, UG
        institution TEXT,
        year_passing TEXT,
        percentage NUMERIC,
        board_university TEXT
      )
    `);

    // Table: extra_curricular
    await client.query(`
      CREATE TABLE IF NOT EXISTS extra_curricular (
        id SERIAL PRIMARY KEY,
        roll_no TEXT NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
        activity_type TEXT,
        description TEXT,
        year TEXT
      )
    `);

    // Table: counselor_diary
    await client.query(`
      CREATE TABLE IF NOT EXISTS counselor_diary (
        id SERIAL PRIMARY KEY,
        roll_no TEXT NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        remarks TEXT,
        category TEXT,
        counselor_name TEXT
      )
    `);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default { query };
