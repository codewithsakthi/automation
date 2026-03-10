import requests
import os
import re
import json
import csv
import getpass
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import glob
from concurrent.futures import ThreadPoolExecutor

# Ensure output directories exist
os.makedirs('data', exist_ok=True)
os.makedirs('profiles', exist_ok=True)

# Backend Sync Configuration
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8000')
BACKEND_TOKEN = os.environ.get('BACKEND_TOKEN', None)

def parse_student_info_string(info_str):
    """
    Parses a string like:
    'KAVIYA  G(248307)           # Reg. No. 910624301025          # Department : MCA          # Batch : 2024 - 2026'
    into separate components.
    """
    details = {
        "Name": "N/A",
        "RollNo": "N/A",
        "RegNo": "N/A",
        "Department": "N/A",
        "Batch": "N/A"
    }
    
    if not info_str:
        return details
        
    # Split by '#'
    parts = [p.strip() for p in info_str.split('#')]
    
    # First part contains Name and Roll No: 'KAVIYA  G(248307)'
    if len(parts) > 0:
        first_part = parts[0]
        # Use regex to extract Name and RollNo: Name(RollNo)
        match = re.search(r'([^(]+)\(([^)]+)\)', first_part)
        if match:
            details["Name"] = match.group(1).strip()
            details["RollNo"] = match.group(2).strip()
        else:
            details["Name"] = first_part
        
    # Other parts: 'Reg. No. 910624301025', 'Department : MCA', 'Batch : 2024 - 2026'
    for part in parts[1:]:
        if 'Reg. No.' in part:
            details["RegNo"] = part.replace('Reg. No.', '').strip()
        elif 'Department' in part:
            details["Department"] = part.split(':')[-1].strip() if ':' in part else part.replace('Department', '').strip()
        elif 'Batch' in part:
            details["Batch"] = part.split(':')[-1].strip() if ':' in part else part.replace('Batch', '').strip()
            
    return details

def cleanup_old_files():
    print("\nCleaning up old files and temporary debug files...")
    # Patterns for files to remove from root
    patterns = [
        "*_data.json",
        "*_profile.jpg",
        "*.html",
        "*.log",
        "debug_*.html"
    ]
    for pattern in patterns:
        for f in glob.glob(pattern):
            try:
                os.remove(f)
                # print(f"Removed: {f}")
            except Exception as e:
                print(f"Error removing {f}: {e}")

def read_students_from_csv(file_path):
    print(f"\nReading students from {file_path}...")
    students = []
    try:
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Clean up keys and values
                clean_row = {k.strip(): v.strip() for k, v in row.items()}
                students.append(clean_row)
    except Exception as e:
        print(f"Error reading CSV: {e}")
    return students

def save_student_data(roll_no, data):
    filename = os.path.join("data", f"{roll_no}_data.json")
    print(f"Saving data to {filename}...")
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving data for {roll_no}: {e}")

def sync_with_backend(roll_no, data):
    """
    Pushes consolidated student data to the backend API.
    """
    global BACKEND_TOKEN
    
    if not BACKEND_URL:
        return
        
    print(f"Syncing {roll_no} with backend at {BACKEND_URL}...")
    
    url = f"{BACKEND_URL}/api/sync/student/{roll_no}"
    headers = {'Content-Type': 'application/json'}
    
    if BACKEND_TOKEN:
        headers['Authorization'] = f"Bearer {BACKEND_TOKEN}"
        
    try:
        resp = requests.post(url, json=data, headers=headers)
        if resp.status_code == 401:
            print(f"Authentication failed for backend sync. Please set BACKEND_TOKEN environment variable.")
            # We don't want to block multi-threaded execution with input() if possible
            return False
        elif resp.status_code >= 400:
            print(f"Backend sync failed for {roll_no}: {resp.status_code} - {resp.text}")
            return False
        else:
            print(f"Successfully synced {roll_no} with backend.")
            return True
    except Exception as e:
        print(f"Communication error with backend during sync of {roll_no}: {e}")
        return False

def get_attendance_details(session, base_url, headers):
    print("\nStep 4: Extracting Consolidated Attendance Details...")
    try:
        resp = session.get(urljoin(base_url, "Students/StudentHome.aspx"), headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        attendance_data = []
        tables = soup.find_all('table')
        unwanted_keywords = ["FEES", "CAUTION DEPOSIT", "REGISTRATION", "FEE", "EXAMINATION", "TRAINING", "SCHOLARSHIP"]
        for table in tables:
            rows = table.find_all('tr')
            if len(rows) < 2: continue
            
            header_text = table.text.lower()
            if "working hours" in header_text or "present hours" in header_text or "percentage" in header_text:
                for row in rows:
                    cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                    if len(cells) >= 5 and cells[0].isdigit():
                        row_text = " ".join(cells).upper()
                        if any(kw in row_text for kw in unwanted_keywords):
                            continue
                            
                        attendance_data.append({
                            "Semester": cells[1],
                            "Working": cells[2],
                            "Present": cells[3],
                            "Percentage": cells[4]
                        })
                if attendance_data: break
        
        if attendance_data:
            print(f"{'Sem':<5} | {'Working':<10} | {'Present':<10} | {'%':<10}")
            print("-" * 45)
            for entry in attendance_data:
                print(f"{entry['Semester']:<5} | {entry['Working']:<10} | {entry['Present']:<10} | {entry['Percentage']:<10}")
        else:
            print("No hours-based attendance found.")
        return attendance_data
    except Exception as e:
        print(f"Error fetching attendance: {e}")
        return []

    return detailed_data

def get_detailed_attendance_parent_portal(session, base_soup, url, headers):
    print("\nStep 5b: Extracting Detailed Attendance & Summary from Parent Portal...")
    detailed_attendance = {}
    summary_attendance = []
    
    # We'll try semesters 1, 2, 3
    for sem in range(1, 4):
        print(f"  - Fetching attendance for Semester {sem}...")
        
        vs = base_soup.find('input', {'id': '__VIEWSTATE'})
        vsg = base_soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
        ev = base_soup.find('input', {'id': '__EVENTVALIDATION'})
        
        payload = {
            '__VIEWSTATE': vs.get('value', '') if vs else '',
            '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
            '__EVENTVALIDATION': ev.get('value', '') if ev else '',
            'ctl00$BodyContent$studentInformationTab$AttendanceDetails$Semester': str(sem),
            'ctl00$BodyContent$studentInformationTab$AttendanceDetails$GetAttBut': 'Get Attendance',
            'ctl00_BodyContent_studentInformationTab_ClientState': '{"ActiveTabIndex":1,"TabState":[true,true,true,true,true]}'
        }
        
        try:
            resp = session.post(url, data=payload, headers=headers)
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            att_div = soup.find('div', id=lambda x: x and 'AttendanceDetails_StudentAttDiv' in x)
            if att_div:
                table = att_div.find('table')
                if table:
                    rows = table.find_all('tr')
                    import re
                    date_pattern = re.compile(r'\d{2}-\d{2}-\d{4}')
                    sem_detailed = []
                    
                    working_hrs = "N/A"
                    present_hrs = "N/A"
                    percentage = "N/A"

                    for row in rows:
                        row_text = row.text.lower()
                        cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                        if not cells: continue
                        
                        # Detailed row
                        if len(cells) >= 9 and date_pattern.match(cells[0]):
                            sem_detailed.append({
                                "Date": cells[0],
                                "HoursPerDay": cells[1],
                                "Status": cells[2:9]
                            })
                        # Summary rows (usually at the bottom)
                        elif "working hours" in row_text:
                            # Parse "No. of working Hours = 504    No.of Hour(s) Present = 448"
                            match_w = re.search(r'working\s*hours\s*=\s*(\d+)', row_text)
                            if match_w: working_hrs = match_w.group(1)
                            match_p = re.search(r'present\s*=\s*(\d+)', row_text)
                            if match_p: present_hrs = match_p.group(1)
                            
                        elif "percentage" in row_text:
                            # Robust percentage extraction using regex to find \d+\.?\d*%
                            m = re.search(r'(\d+\.?\d*\s*%)', row_text)
                            if m: percentage = m.group(1)
                            elif len(cells) >= 2:
                                # Fallback to checking cells
                                for c in cells:
                                    if '%' in c:
                                        percentage = c.strip()
                                        break

                    if sem_detailed:
                        detailed_attendance[f"Semester_{sem}"] = sem_detailed
                        summary_attendance.append({
                            "Semester": str(sem),
                            "Working": working_hrs,
                            "Present": present_hrs,
                            "Percentage": percentage
                        })
                        print(f"    - Extracted {len(sem_detailed)} days and summary for Sem {sem}.")
                        base_soup = soup
                else:
                    print(f"    - No table found for Sem {sem}")
            else:
                print(f"    - Attendance div not found for Sem {sem}")
        except Exception as e:
            print(f"    - Error for Sem {sem}: {e}")
            
    return detailed_attendance, summary_attendance, base_soup

def get_parent_portal_cit_marks(session, base_soup, url, headers):
    print("\nStep 5c: Extracting CIT Marks from Parent Portal...")
    all_cit_marks = {}
    acad_years = ['36', '35', '34']

    for sem in range(1, 4):
        all_cit_marks[f"Semester_{sem}"] = {}
        print(f"  - Fetching CIT marks for Semester {sem}...")
        
        for test_no in range(1, 4):  # CIT 1, 2, 3
            data_found_for_test = False
            for ay_id in acad_years:
                vs = base_soup.find('input', {'id': '__VIEWSTATE'})
                vsg = base_soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
                ev = base_soup.find('input', {'id': '__EVENTVALIDATION'})

                payload = {
                    '__VIEWSTATE': vs.get('value', '') if vs else '',
                    '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
                    '__EVENTVALIDATION': ev.get('value', '') if ev else '',
                    'semesterno': str(sem),
                    'internaltypeid': '9',  # CIT
                    'assessmentno': str(test_no),
                    'acadyearid': ay_id,
                    'ctl00$BodyContent$studentInformationTab$InternalMarkDetails$IntMarkCmd': 'Submit',
                    'ctl00_BodyContent_studentInformationTab_ClientState': '{"ActiveTabIndex":2,"TabState":[true,true,true,true,true]}'
                }

                try:
                    resp = session.post(url, data=payload, headers=headers)
                    soup = BeautifulSoup(resp.text, 'html.parser')

                    # PRIMARY: Look inside the confirmed report div
                    table = None
                    report_div = soup.find('div', id=lambda x: x and 'InternalMarkDetails_IntMarkReportDiv' in x)
                    if report_div:
                        table = report_div.find('table')

                    # FALLBACK 1: known table IDs
                    if not table:
                        table = soup.find('table', id=lambda x: x and 'InternalMarkDetails_GridView1' in x)
                    if not table:
                        table = soup.find('table', id='Table_01')

                    # FALLBACK 2: find by header text
                    if not table:
                        for tag_name in ['th', 'td', 'font']:
                            header_tag = soup.find(tag_name, string=lambda t: t and 'Centralised Internal Test' in t)
                            if header_tag:
                                table = header_tag.find_parent('table')
                                break

                    if table:
                        rows = table.find_all('tr')
                        test_marks = []
                        for row in rows:
                            cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                            if not cells:
                                continue

                            if cells[0].isdigit():
                                # Table columns: SlNo | Spacer | Date | Spacer | Subject | Spacer | Marks(%)
                                sl_no   = cells[0]
                                date_str = cells[2] if len(cells) > 2 else ""
                                subject  = cells[4] if len(cells) > 4 else ""
                                marks    = cells[6] if len(cells) > 6 else ""

                                if not re.match(r'\d{2}-\d{2}-\d{4}', date_str):
                                    continue

                                test_marks.append({
                                    "SlNo": sl_no,
                                    "Date": date_str,
                                    "Subject": subject,
                                    "Marks": marks
                                })
                            elif cells and "total" in cells[0].lower():
                                # Robustly find the total value by searching backward for the first cell with a digit
                                total_val = "N/A"
                                for cell in reversed(cells):
                                    m = re.search(r'(\d+\.?\d*)', cell)
                                    if m:
                                        total_val = m.group(1)
                                        break
                                test_marks.append({"Total": total_val})

                        if test_marks:
                            all_cit_marks[f"Semester_{sem}"][f"Test_{test_no}"] = test_marks
                            print(f"    - Found CIT {test_no} for Sem {sem} (AY: {ay_id}): {len(test_marks)} subjects")
                            base_soup = soup
                            data_found_for_test = True
                            break
                    else:
                        if "Centralised Internal Test" in resp.text:
                            # Table exist but BeautifulSoup couldn't find it via div ID
                            # Fallback to any table in the page
                            potential_tables = soup.find_all('table')
                            for t in potential_tables:
                                if "Subject Name" in t.text and "Mark (%)" in t.text:
                                    table = t
                                    # Rerun extraction logic (simplified for fallback)
                                    rows = table.find_all('tr')
                                    # ... (could repeat, but usually find_all by content works)
                                    break
                except Exception as e:
                    pass

            if not data_found_for_test:
                all_cit_marks[f"Semester_{sem}"][f"Test_{test_no}"] = []


    return all_cit_marks, base_soup

def get_parent_portal_university_marks(session, soup):
    print("\nStep 5d: Extracting University Mark Details from Parent Portal...")
    uni_marks = []
    try:
        # Locate the table with id 'table-alt' inside the UniversityMarkDetails section
        report_div = soup.find('div', id=lambda x: x and 'UniversityMarkDetails_UniversityMarksDiv' in x)
        table = None
        if report_div:
            table = report_div.find('table', class_='table-alt') or report_div.find('table')
        
        if not table:
            # Fallback: search the whole soup for a table with 'Paper Code' or 'Grade Point'
            for t in soup.find_all('table'):
                header_text = t.text.lower()
                if "paper code" in header_text and "grade point" in header_text:
                    table = t
                    break
        
        if table:
            rows = table.find_all('tr')
            for row in rows:
                cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                if not cells or not cells[0].isdigit():
                    continue
                
                # Expected columns: Sl.No | Semester | Paper Code | Paper Name | Credit | Grade | Grade Point
                if len(cells) >= 7:
                    uni_marks.append({
                        "SlNo": cells[0],
                        "Semester": cells[1],
                        "PaperCode": cells[2],
                        "PaperName": cells[3],
                        "Credit": cells[4],
                        "Grade": cells[5],
                        "GradePoint": cells[6]
                    })
            print(f"    - Found {len(uni_marks)} university mark records.")
        else:
            print("    - University Mark table not found or empty.")
            
    except Exception as e:
        print(f"    - Error extracting university marks: {e}")
        
    return uni_marks


def get_parent_portal_info(roll_no, dob):
    print("\nStep 5: Extracting Student Info from Parent Portal...")
    session = requests.Session()
    url = "https://www.klnce.edu/Parent/StudentInformation.aspx"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        resp = session.get(url, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        vs = soup.find('input', {'id': '__VIEWSTATE'})
        vsg = soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
        ev = soup.find('input', {'id': '__EVENTVALIDATION'})

        # Format DOB if it's in DDMMYYYY format
        if len(dob) == 8 and dob.isdigit():
            dob_formatted = f"{dob[:2]}/{dob[2:4]}/{dob[4:]}"
        else:
            dob_formatted = dob

        payload = {
            '__VIEWSTATE': vs.get('value', '') if vs else '',
            '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
            '__EVENTVALIDATION': ev.get('value', '') if ev else '',
            'ctl00$BodyContent$StudentCode': roll_no,
            'ctl00$BodyContent$DOB': dob_formatted,
            'ctl00$BodyContent$GetAtt': 'Get The Informations'
        }
        
        resp = session.post(url, data=payload, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        student_info = {}
        name_tag = soup.find(id=lambda x: x and 'StudentName' in x)
        if name_tag:
            raw_info = name_tag.text.strip()
            parsed_info = parse_student_info_string(raw_info)
            student_info.update(parsed_info)
            print(f"Student Name: {student_info['Name']}")
        
        # Extract Semester
        semester_tag = soup.find(id=lambda x: x and 'Branch' in x) # Often Branch contains 'Semester X' content or similar
        # Fallback to searching text
        semester = "N/A"
        if "Semester" in resp.text:
            import re
            match = re.search(r'Semester\s*:\s*(\d+)', resp.text)
            if match:
                semester = match.group(1)
            else:
                # Look for it in the table
                pass
        
        print(f"Current Semester: {semester}")

        # Extract marks from the GridView or any result table
        marks = []
        tables = soup.find_all('table')
        
        # Keywords that indicate a fee/receipt table instead of results
        unwanted_keywords = ["FEES", "CAUTION DEPOSIT", "REGISTRATION", "FEE", "EXAMINATION", "TRAINING", "SCHOLARSHIP"]
        valid_grades = ["PASS", "FAIL", "A", "A+", "O", "B", "B+", "C", "D", "E", "S", "U", "W", "I"]
        
        for table in tables:
            rows = table.find_all('tr')
            if not rows: continue
            
            header_cells = [th.text.strip().lower() for th in rows[0].find_all(['th', 'td'])]
            # Specifically check for Subject Code-Subject Name to target the right table
            if any("subject code" in h for h in header_cells) and "grade" in header_cells:
                for row in rows[1:]:
                    cells = [td.text.strip() for td in row.find_all('td')]
                    if len(cells) >= 4:
                        sem = cells[1]
                        subject_desc = cells[2]
                        grade = cells[3]
                        
                        # VALIDATION:
                        # 1. Semester should be a simple digit (e.g., '1', '2')
                        if not (sem.isdigit() and len(sem) <= 2):
                            continue
                            
                        # 2. Description should not contain fee keywords
                        row_text = " ".join(cells).upper()
                        if any(kw in row_text for kw in unwanted_keywords):
                            # Special case: 'EXAMINATION' might be in a subject name, 
                            # but usually fee data has more keywords or specific formats.
                            if "FEES" in row_text or "DATE" in row_text or "RECEIPT" in row_text:
                                continue
                        
                        # 3. Grade should be one of the known grade values
                        clean_grade = grade.upper().split()[0] if grade else ""
                        if clean_grade not in valid_grades:
                            continue
                            
                        marks.append({
                            "Sem": sem,
                            "Subject": subject_desc,
                            "Grade": grade
                        })
                if marks: break
        
        if marks:
            print(f"\n{'Sem':<5} | {'Subject Name':<60} | {'Grade':<10}")
            print("-" * 80)
            for m in marks:
                print(f"{m['Sem']:<5} | {m['Subject']:<60} | {m['Grade']:<10}")
            student_info['Semester'] = marks[0]['Sem']
        else:
            print("No marks (Grade/Result) found in parent portal yet.")
        
        # 2. Extract detailed attendance (updates session state/tab context)
        detailed_att, summary_att, latest_soup = get_detailed_attendance_parent_portal(session, soup, url, headers)
        
        # 3. Extract CIT marks using the latest soup (prevents state reset from fresh GET)
        cit_marks, _ = get_parent_portal_cit_marks(session, latest_soup, url, headers)
        
        # 4. Extract University Marks
        uni_marks = get_parent_portal_university_marks(session, soup)
        
        # 5. Extract University Results from COE portal
        coe_results = get_university_results(roll_no, dob)
        
        return student_info, marks, detailed_att, summary_att, cit_marks, uni_marks, coe_results
    except Exception as e:
        print(f"Error in Parent Portal: {e}")
        return {}, [], {}, [], {}, [], []

def get_university_results(roll_no, dob):
    print("\nStep 6: Extracting University Results from COE Portal...")
    session = requests.Session()
    url = "https://www.klnce.edu/COEresult/StudentInformation.aspx"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    all_results = []
    try:
        resp = session.get(url, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        vs = soup.find('input', {'id': '__VIEWSTATE'})
        vsg = soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
        ev = soup.find('input', {'id': '__EVENTVALIDATION'})

        if len(dob) == 8 and dob.isdigit():
            dob_formatted = f"{dob[:2]}/{dob[2:4]}/{dob[4:]}"
        else:
            dob_formatted = dob
            
        payload = {
            '__VIEWSTATE': vs.get('value', '') if vs else '',
            '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
            '__EVENTVALIDATION': ev.get('value', '') if ev else '',
            'ctl00_BodyContent_studentInformationTab_ClientState': '{"ActiveTabIndex":3,"TabState":[true]}',
            'ctl00$BodyContent$StudentCode': roll_no,
            'ctl00$BodyContent$DOB': dob_formatted,
            'ctl00$BodyContent$GetAtt': 'Get The Result'
        }
        
        resp = session.post(url, data=payload, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        result_table = soup.find('table', id=lambda x: x and 'GridView1' in x)
        if result_table:
            rows = result_table.find_all('tr')
            for row in rows[1:]:
                cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                if len(cells) >= 3:
                    all_results.append({
                        "Sl.No": cells[0],
                        "Subject": cells[1],
                        "Grade": cells[2]
                    })
        
        if all_results:
            print(f"{'SlNo':<5} | {'Subject Name':<65} | {'Grade':<10}")
            print("-" * 85)
            for r in all_results:
                print(f"{r['Sl.No']:<5} | {r['Subject']:<65} | {r['Grade']:<10}")
        else:
            print("No University results found in COE portal.")
            
        return all_results
    except Exception as e:
        print(f"Error accessing COE portal: {e}")
        return []

def get_all_cit_marks(roll_no, password):
    if not password:
        print(f"No password provided for roll {roll_no}. Skipping Student Portal.")
        return {}, []

    session = requests.Session()
    url = "https://klnce.edu/Default.aspx"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

    print("Step 1: Logging in to Student Portal...")
    try:
        login_page = session.get(url, headers=headers)
        soup = BeautifulSoup(login_page.text, 'html.parser')
        
        login_payload = {
            '__VIEWSTATE': soup.find('input', {'id': '__VIEWSTATE'}).get('value', ''),
            '__VIEWSTATEGENERATOR': soup.find('input', {'id': '__VIEWSTATEGENERATOR'}).get('value', ''),
            '__EVENTVALIDATION': soup.find('input', {'id': '__EVENTVALIDATION'}).get('value', ''),
            'ctl00$BodyContent$NBALetter_ClientState': 'true',
            'ctl00$BodyContent$Studentlogin_ClientState': 'false',
            'ctl00$BodyContent$StaffLogin_ClientState': 'true',
            'ctl00$BodyContent$CodeofConduct_ClientState': 'true',
            'ctl00$BodyContent$StudentCode': roll_no,
            'ctl00$BodyContent$StuPassword': password,
            'ctl00$BodyContent$StudentLoginBut': 'Login'
        }
        
        dash_resp = session.post(url, data=login_payload, headers=headers, allow_redirects=True)
        current_soup = BeautifulSoup(dash_resp.text, 'html.parser')

        if "Default.aspx" in dash_resp.url:
            print(f"Login failed for roll {roll_no}. Check credentials.")
            return [], []

        print("Step 2: Extracting and saving profile picture...")
        img_tag = current_soup.find('img', id=lambda x: x and ('StudentImage' in x))
        if img_tag:
            img_url = img_tag.get('src')
            if not img_url.startswith('http'):
                img_url = urljoin(dash_resp.url, img_url)
            
            img_resp = session.get(img_url, headers=headers)
            if img_resp.status_code == 200:
                file_name = os.path.join("profiles", f"{roll_no}_profile.jpg")
                with open(file_name, 'wb') as f:
                    f.write(img_resp.content)
                print(f"Successfully saved profile picture as {file_name}")
        
        all_cit_marks = {}
        print("\nStep 3: Extracting CIT Marks (Sems 1-3, Tests 1-3)...")
        
        # Possible academic year IDs to try (36=25-26, 35 might be 24-25, etc.)
        # We'll try the current one first, and if no marks found for older sems, try others.
        acad_years = ['36', '35', '34'] 

        for sem in range(1, 4):
            all_cit_marks[f"Semester_{sem}"] = {}
            for test in range(1, 4):
                test_results = []
                data_found = False
                
                # Fetch fresh tokens for each request
                vs = current_soup.find('input', {'id': '__VIEWSTATE'})
                vsg = current_soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
                ev = current_soup.find('input', {'id': '__EVENTVALIDATION'})
                if not vs: break

                # Try academic years until we find data or run out of years
                for ay_id in acad_years:
                    marks_payload = {
                        '__EVENTTARGET': '',
                        '__EVENTARGUMENT': '',
                        '__VIEWSTATE': vs.get('value', ''),
                        '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
                        '__EVENTVALIDATION': ev.get('value', '') if ev else '',
                        'ctl00_mainContent_TabContainer1_ClientState': '{"ActiveTabIndex":2,"TabState":[true,true,true,true,true,true,true,true]}',
                        'semesterno': str(sem),
                        'internaltypeid': '9', # Centralised Internal Test
                        'assessmentno': str(test),
                        'acadyearid': ay_id, 
                        'ctl00$mainContent$TabContainer1$InternalMarksReport$IntMarkCmd': 'Submit'
                    }
                    
                    marks_resp = session.post(dash_resp.url, data=marks_payload, headers=headers)
                    current_soup = BeautifulSoup(marks_resp.text, 'html.parser')
                    
                    # Check for data in the newly updated current_soup
                    seen_sl_nos = set()
                    temp_results = []
                    marks_found_in_ay = False
                    
                    for row in current_soup.find_all('tr'):
                        cells = [cell.text.strip() for cell in row.find_all(['td', 'th'])]
                        cells = [c for c in cells if c]
                        
                        if not cells: continue
                        if len(cells) >= 4 and "Sl.No" in cells[0] and "Date of Test" in cells[1]:
                            marks_found_in_ay = True
                        elif marks_found_in_ay and cells[0].isdigit() and len(cells) >= 4:
                            if cells[0] not in seen_sl_nos:
                                temp_results.append({
                                    "SlNo": cells[0],
                                    "Date": cells[1],
                                    "Subject": cells[2],
                                    "Marks": cells[3]
                                })
                                seen_sl_nos.add(cells[0])
                        elif marks_found_in_ay and "Total" in cells[0]:
                            temp_results.append({"Total": cells[-1]})
                            break
                    
                    if temp_results:
                        test_results = temp_results
                        data_found = True
                        print(f"  - Sem {sem} Test {test}: Found data (AY: {ay_id})")
                        break # Found data for this test, move to next test
                
                if not data_found:
                    print(f"  - Sem {sem} Test {test}: No data found.")
                
                all_cit_marks[f"Semester_{sem}"][f"Test_{test}"] = test_results

        attendance = get_attendance_details(session, url, headers)
        return all_cit_marks, attendance

    except Exception as e:
        print(f"Error in student portal: {e}")
        return {}, []

def process_student(student_record):
    roll = student_record.get('Roll No')
    dob = student_record.get('Date Of Birth')
    print(f"\n{'*'*80}")
    print(f"Processing Student: {student_record.get('Name')} ({roll})")
    print(f"{'*'*80}")

    all_data = {
        "StudentInfo": student_record,
        "ParentPortal": {},
        "COEResults": [],
        "StudentPortal": {
            "CITMarks": {},
            "Attendance": []
        }
    }

    # 1. Parent Portal Extraction (now includes COE)
    info, parent_marks, detailed_attendance, summary_attendance, cit_marks, uni_marks, coe_results = get_parent_portal_info(roll, dob)
    all_data["ParentPortal"] = {
        "Info": info,
        "Marks": parent_marks,
        "DetailedAttendance": detailed_attendance,
        "AttendanceSummary": summary_attendance,
        "CITMarks": cit_marks,
        "UniversityMarks": uni_marks
    }

    # 2. COE Portal Extraction (redundant but kept for structure, already fetched in step 1 if using get_parent_portal_info)
    all_data["COEResults"] = coe_results

    # 3. Student Portal Extraction (Skipped as passwords are not available)
    # cit_marks, attendance = get_all_cit_marks(roll, password)
    # all_data["StudentPortal"]["CITMarks"] = cit_marks
    # all_data["StudentPortal"]["Attendance"] = attendance

    # 4. Save consolidated data
    save_student_data(roll, all_data)
    
    # 5. Sync with Backend
    sync_with_backend(roll, all_data)
    
    print(f"\nCompleted Processing for {roll}")

if __name__ == '__main__':
    # Initial cleanup
    cleanup_old_files()
    
    csv_file = "40members.csv"
    if not os.path.exists(csv_file):
        print(f"CSV file {csv_file} not found.")
    else:
        students = read_students_from_csv(csv_file)
        print(f"Found {len(students)} students in CSV.")
        
        # Process students in parallel using multithreading
        with ThreadPoolExecutor(max_workers=5) as executor:
            executor.map(process_student, students)
            
        print("\nAll students processed. Extraction Complete.")