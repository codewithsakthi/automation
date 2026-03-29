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
import time
import random

# Ensure output directories exist
os.makedirs('data', exist_ok=True)
os.makedirs('profiles', exist_ok=True)

# Backend Sync Configuration
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8000')
BACKEND_TOKEN = os.environ.get('BACKEND_TOKEN', None)

# ---------------------------------------------------------
# HUMAN-LIKE BEHAVIOR HELPERS
# ---------------------------------------------------------

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36'
]

def get_random_headers(referer=None):
    """Generates realistic browser headers to mask the script."""
    headers = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin' if referer else 'none',
        'Sec-Fetch-User': '?1'
    }
    if referer:
        headers['Referer'] = referer
    return headers

def human_sleep(min_sec=1.0, max_sec=3.0):
    """Simulates human reading/clicking time between requests."""
    time.sleep(random.uniform(min_sec, max_sec))

# ---------------------------------------------------------

def parse_student_info_string(info_str):
    details = {
        "Name": "N/A",
        "RollNo": "N/A",
        "RegNo": "N/A",
        "Department": "N/A",
        "Batch": "N/A"
    }
    
    if not info_str:
        return details
        
    parts = [p.strip() for p in info_str.split('#')]
    
    if len(parts) > 0:
        first_part = parts[0]
        match = re.search(r'([^(]+)\(([^)]+)\)', first_part)
        if match:
            details["Name"] = match.group(1).strip()
            details["RollNo"] = match.group(2).strip()
        else:
            details["Name"] = first_part
        
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
    patterns = ["*_data.json", "*_profile.jpg", "*.html", "*.log", "debug_*.html"]
    for pattern in patterns:
        for f in glob.glob(pattern):
            try:
                os.remove(f)
            except Exception as e:
                print(f"Error removing {f}: {e}")

def read_students_from_csv(file_path):
    print(f"\nReading students from {file_path}...")
    students = []
    try:
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
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
            print(f"Backend sync skipped for {roll_no} (Unauthorized).")
            return False
        elif resp.status_code >= 400:
            print(f"Backend sync failed for {roll_no}: {resp.status_code}")
            return False
        else:
            print(f"Successfully synced {roll_no} with backend.")
            return True
    except Exception as e:
        print(f"Communication error with backend: {e}")
        return False

def get_attendance_details(session, base_url, headers):
    print("\nStep 4: Extracting Consolidated Attendance Details...")
    human_sleep(1.5, 3.0) # Pause before navigation
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
        
        return attendance_data
    except Exception as e:
        print(f"Error fetching attendance: {e}")
        return []

def get_detailed_attendance_parent_portal(session, base_soup, url, headers):
    print("\nStep 5b: Extracting Detailed Attendance & Summary from Parent Portal...")
    detailed_attendance = {}
    summary_attendance = []
    
    for sem in range(1, 4):
        print(f"  - Fetching attendance for Semester {sem}...")
        human_sleep(1.2, 2.5) # Simulate user selecting a semester from dropdown
        
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
        
        headers['Referer'] = url # Add referer for POST
        
        try:
            resp = session.post(url, data=payload, headers=headers)
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            att_div = soup.find('div', id=lambda x: x and 'AttendanceDetails_StudentAttDiv' in x)
            if att_div:
                table = att_div.find('table')
                if table:
                    rows = table.find_all('tr')
                    date_pattern = re.compile(r'\d{2}-\d{2}-\d{4}')
                    sem_detailed = []
                    
                    working_hrs = "N/A"
                    present_hrs = "N/A"
                    percentage = "N/A"

                    for row in rows:
                        row_text = row.text.lower()
                        cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                        if not cells: continue
                        
                        if len(cells) >= 9 and date_pattern.match(cells[0]):
                            sem_detailed.append({
                                "Date": cells[0],
                                "HoursPerDay": cells[1],
                                "Status": cells[2:9]
                            })
                        elif "working hours" in row_text:
                            match_w = re.search(r'working\s*hours\s*=\s*(\d+)', row_text)
                            if match_w: working_hrs = match_w.group(1)
                            match_p = re.search(r'present\s*=\s*(\d+)', row_text)
                            if match_p: present_hrs = match_p.group(1)
                            
                        elif "percentage" in row_text:
                            m = re.search(r'(\d+\.?\d*\s*%)', row_text)
                            if m: percentage = m.group(1)
                            elif len(cells) >= 2:
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
                        base_soup = soup
        except Exception as e:
            print(f"    - Error for Sem {sem}: {e}")
            
    return detailed_attendance, summary_attendance, base_soup

def get_parent_portal_cit_marks(session, base_soup, url, headers):
    print("\nStep 5c: Extracting CIT Marks from Parent Portal...")
    all_cit_marks = {}
    acad_years = ['36', '35', '34']

    for sem in range(1, 4):
        all_cit_marks[f"Semester_{sem}"] = {}
        
        for test_no in range(1, 4):  
            data_found_for_test = False
            for ay_id in acad_years:
                human_sleep(0.8, 2.0) # Pause between selecting tests
                
                vs = base_soup.find('input', {'id': '__VIEWSTATE'})
                vsg = base_soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
                ev = base_soup.find('input', {'id': '__EVENTVALIDATION'})

                payload = {
                    '__VIEWSTATE': vs.get('value', '') if vs else '',
                    '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
                    '__EVENTVALIDATION': ev.get('value', '') if ev else '',
                    'semesterno': str(sem),
                    'internaltypeid': '9', 
                    'assessmentno': str(test_no),
                    'acadyearid': ay_id,
                    'ctl00$BodyContent$studentInformationTab$InternalMarkDetails$IntMarkCmd': 'Submit',
                    'ctl00_BodyContent_studentInformationTab_ClientState': '{"ActiveTabIndex":2,"TabState":[true,true,true,true,true]}'
                }
                
                headers['Referer'] = url

                try:
                    resp = session.post(url, data=payload, headers=headers)
                    soup = BeautifulSoup(resp.text, 'html.parser')

                    table = None
                    report_div = soup.find('div', id=lambda x: x and 'InternalMarkDetails_IntMarkReportDiv' in x)
                    if report_div: table = report_div.find('table')
                    if not table: table = soup.find('table', id=lambda x: x and 'InternalMarkDetails_GridView1' in x)
                    if not table: table = soup.find('table', id='Table_01')

                    if table:
                        rows = table.find_all('tr')
                        test_marks = []
                        for row in rows:
                            cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                            if not cells: continue

                            if cells[0].isdigit():
                                sl_no   = cells[0]
                                date_str = cells[2] if len(cells) > 2 else ""
                                subject  = cells[4] if len(cells) > 4 else ""
                                marks    = cells[6] if len(cells) > 6 else ""

                                if not re.match(r'\d{2}-\d{2}-\d{4}', date_str): continue

                                test_marks.append({
                                    "SlNo": sl_no,
                                    "Date": date_str,
                                    "Subject": subject,
                                    "Marks": marks
                                })
                            elif cells and "total" in cells[0].lower():
                                total_val = "N/A"
                                for cell in reversed(cells):
                                    m = re.search(r'(\d+\.?\d*)', cell)
                                    if m:
                                        total_val = m.group(1)
                                        break
                                test_marks.append({"Total": total_val})

                        if test_marks:
                            all_cit_marks[f"Semester_{sem}"][f"Test_{test_no}"] = test_marks
                            base_soup = soup
                            data_found_for_test = True
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
        report_div = soup.find('div', id=lambda x: x and 'UniversityMarkDetails_UniversityMarksDiv' in x)
        table = None
        if report_div:
            table = report_div.find('table', class_='table-alt') or report_div.find('table')
        
        if not table:
            for t in soup.find_all('table'):
                header_text = t.text.lower()
                if "paper code" in header_text and "grade point" in header_text:
                    table = t
                    break
        
        if table:
            rows = table.find_all('tr')
            for row in rows:
                cells = [td.text.strip() for td in row.find_all(['td', 'th'])]
                if not cells or not cells[0].isdigit(): continue
                
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
    except Exception as e:
        print(f"    - Error extracting university marks: {e}")
        
    return uni_marks


def get_parent_portal_info(roll_no, dob):
    print("\nStep 5: Extracting Student Info from Parent Portal...")
    session = requests.Session()
    url = "https://www.klnce.edu/Parent/StudentInformation.aspx"
    headers = get_random_headers()
    
    try:
        # Initial page load
        human_sleep(1.0, 2.5)
        resp = session.get(url, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        vs = soup.find('input', {'id': '__VIEWSTATE'})
        vsg = soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
        ev = soup.find('input', {'id': '__EVENTVALIDATION'})

        dob_formatted = f"{dob[:2]}/{dob[2:4]}/{dob[4:]}" if (len(dob) == 8 and dob.isdigit()) else dob

        payload = {
            '__VIEWSTATE': vs.get('value', '') if vs else '',
            '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
            '__EVENTVALIDATION': ev.get('value', '') if ev else '',
            'ctl00$BodyContent$StudentCode': roll_no,
            'ctl00$BodyContent$DOB': dob_formatted,
            'ctl00$BodyContent$GetAtt': 'Get The Informations'
        }
        
        headers['Referer'] = url # Important for POST requests
        human_sleep(2.0, 4.0) # Simulate user typing in roll number/DOB and clicking submit
        resp = session.post(url, data=payload, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        student_info = {}
        name_tag = soup.find(id=lambda x: x and 'StudentName' in x)
        if name_tag:
            raw_info = name_tag.text.strip()
            parsed_info = parse_student_info_string(raw_info)
            student_info.update(parsed_info)
        
        semester = "N/A"
        if "Semester" in resp.text:
            match = re.search(r'Semester\s*:\s*(\d+)', resp.text)
            if match: semester = match.group(1)

        marks = []
        tables = soup.find_all('table')
        unwanted_keywords = ["FEES", "CAUTION DEPOSIT", "REGISTRATION", "FEE", "EXAMINATION", "TRAINING", "SCHOLARSHIP"]
        valid_grades = ["PASS", "FAIL", "A", "A+", "O", "B", "B+", "C", "D", "E", "S", "U", "W", "I"]
        
        for table in tables:
            rows = table.find_all('tr')
            if not rows: continue
            
            header_cells = [th.text.strip().lower() for th in rows[0].find_all(['th', 'td'])]
            if any("subject code" in h for h in header_cells) and "grade" in header_cells:
                for row in rows[1:]:
                    cells = [td.text.strip() for td in row.find_all('td')]
                    if len(cells) >= 4:
                        sem = cells[1]
                        subject_desc = cells[2]
                        grade = cells[3]
                        
                        if not (sem.isdigit() and len(sem) <= 2): continue
                        row_text = " ".join(cells).upper()
                        if any(kw in row_text for kw in unwanted_keywords):
                            if "FEES" in row_text or "DATE" in row_text or "RECEIPT" in row_text:
                                continue
                        
                        clean_grade = grade.upper().split()[0] if grade else ""
                        if clean_grade not in valid_grades: continue
                            
                        marks.append({
                            "Sem": sem,
                            "Subject": subject_desc,
                            "Grade": grade
                        })
                if marks: break
        
        if marks: student_info['Semester'] = marks[0]['Sem']
        
        detailed_att, summary_att, latest_soup = get_detailed_attendance_parent_portal(session, soup, url, headers)
        cit_marks, _ = get_parent_portal_cit_marks(session, latest_soup, url, headers)
        uni_marks = get_parent_portal_university_marks(session, soup)
        coe_results = get_university_results(roll_no, dob)
        
        return student_info, marks, detailed_att, summary_att, cit_marks, uni_marks, coe_results
    except Exception as e:
        print(f"Error in Parent Portal: {e}")
        return {}, [], {}, [], {}, [], []

def get_university_results(roll_no, dob):
    print("\nStep 6: Extracting University Results from COE Portal...")
    session = requests.Session()
    url = "https://www.klnce.edu/COEresult/StudentInformation.aspx"
    headers = get_random_headers()
    
    all_results = []
    try:
        human_sleep(1.0, 2.0)
        resp = session.get(url, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        vs = soup.find('input', {'id': '__VIEWSTATE'})
        vsg = soup.find('input', {'id': '__VIEWSTATEGENERATOR'})
        ev = soup.find('input', {'id': '__EVENTVALIDATION'})

        dob_formatted = f"{dob[:2]}/{dob[2:4]}/{dob[4:]}" if (len(dob) == 8 and dob.isdigit()) else dob
            
        payload = {
            '__VIEWSTATE': vs.get('value', '') if vs else '',
            '__VIEWSTATEGENERATOR': vsg.get('value', '') if vsg else '',
            '__EVENTVALIDATION': ev.get('value', '') if ev else '',
            'ctl00_BodyContent_studentInformationTab_ClientState': '{"ActiveTabIndex":3,"TabState":[true]}',
            'ctl00$BodyContent$StudentCode': roll_no,
            'ctl00$BodyContent$DOB': dob_formatted,
            'ctl00$BodyContent$GetAtt': 'Get The Result'
        }
        
        headers['Referer'] = url
        human_sleep(1.5, 3.5) # Simulate form fill time
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
        return all_results
    except Exception as e:
        print(f"Error accessing COE portal: {e}")
        return []

def process_student(student_record):
    roll = student_record.get('Roll No')
    dob = student_record.get('Date Of Birth')
    print(f"\n{'*'*80}")
    print(f"Processing Student: {student_record.get('Name')} ({roll})")
    print(f"{'*'*80}")

    # Introduce a larger, randomized delay between processing distinct users to 
    # prevent server overload and mimic session swapping.
    human_sleep(3.0, 7.0)

    all_data = {
        "StudentInfo": student_record,
        "ParentPortal": {},
        "COEResults": [],
        "StudentPortal": {
            "CITMarks": {},
            "Attendance": []
        }
    }

    info, parent_marks, detailed_attendance, summary_attendance, cit_marks, uni_marks, coe_results = get_parent_portal_info(roll, dob)
    all_data["ParentPortal"] = {
        "Info": info,
        "Marks": parent_marks,
        "DetailedAttendance": detailed_attendance,
        "AttendanceSummary": summary_attendance,
        "CITMarks": cit_marks,
        "UniversityMarks": uni_marks
    }

    all_data["COEResults"] = coe_results
    save_student_data(roll, all_data)
    sync_with_backend(roll, all_data)
    
    print(f"\nCompleted Processing for {roll}")

if __name__ == '__main__':
    cleanup_old_files()
    
    csv_file = os.path.join(os.path.dirname(__file__), "2025-2027.csv")
    if not os.path.exists(csv_file):
        print(f"CSV file {csv_file} not found.")
    else:
        students = read_students_from_csv(csv_file)
        print(f"Found {len(students)} students in CSV.")
        
        # REDUCED CONCURRENCY: Set max_workers to 1 or 2. 
        # 5 parallel scraping sessions on the same IP is an immediate red flag for WAFs.
        with ThreadPoolExecutor(max_workers=2) as executor:
            executor.map(process_student, students)
            
        print("\nAll students processed. Extraction Complete.")