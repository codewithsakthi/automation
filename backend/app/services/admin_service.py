from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from sqlalchemy.orm import joinedload
from collections import Counter

from .. import models, schemas
from ..core.constants import DIRECTORY_SORT_KEYS, GRADE_POINTS

class AdminService:
    @staticmethod
    def _admin_directory_query_text(credits_cte_values: str):
        return f'''
            with curriculum_credits_map as (
                select * from (values {credits_cte_values}) as t(course_code, credit)
            ), rollups as (
                select distinct roll_no from students
                union select distinct roll_no from contact_info
                union select distinct roll_no from family_details
                union select distinct roll_no from previous_academics
                union select distinct roll_no from semester_grades
                union select distinct roll_no from internal_marks
                union select distinct roll_no from counselor_diary
                union select distinct roll_no from extra_curricular
            ), grade_pts as (
                select sg.roll_no, sg.internal_marks, sg.grade, coalesce(ccm.credit, 0) as credit,
                    (CASE upper(coalesce(sg.grade, ''))
                        WHEN 'O' THEN 10 WHEN 'S' THEN 10
                        WHEN 'A+' THEN 9 WHEN 'A' THEN 8
                        WHEN 'B+' THEN 7 WHEN 'B' THEN 6
                        WHEN 'C' THEN 5 WHEN 'D' THEN 4
                        WHEN 'E' THEN 3 WHEN 'PASS' THEN 5
                        WHEN 'P' THEN 5 WHEN 'FAIL' THEN 0
                        WHEN 'F' THEN 0 WHEN 'U' THEN 0
                        WHEN 'W' THEN 0 WHEN 'I' THEN 0
                        WHEN 'AB' THEN 0 ELSE NULL
                    END) as grade_point
                from semester_grades sg
                left join curriculum_credits_map ccm on sg.subject_code = ccm.course_code
            ), grade_agg as (
                select roll_no,
                       count(*) as marks_count,
                       (case when sum(case when grade_point is not null then credit else 0 end) > 0 
                             then sum(grade_point * credit) / sum(case when grade_point is not null then credit else 0 end) 
                             else 0 end) as average_grade_points,
                       avg(coalesce(internal_marks, 0)) as average_internal_percentage,
                       sum(case when upper(coalesce(grade, '')) in ('U', 'FAIL', 'F', 'W', 'I', 'AB') then 1 else 0 end) as backlogs
                from grade_pts
                group by roll_no
            ), attendance_agg as (
                select s.roll_no,
                       count(a.*) as attendance_count,
                       case when sum(coalesce(a.total_hours, 0)) > 0
                            then (sum(coalesce(a.total_present, 0))::numeric / sum(coalesce(a.total_hours, 0))::numeric) * 100
                            else 0 end as attendance_percentage
                from students s
                left join attendance a on a.student_id = s.id
                group by s.roll_no
            )
            select r.roll_no,
                   coalesce(s.name, ci.email, fd.parent_guardian_name, 'Unknown Student') as name,
                   ci.city,
                   coalesce(ci.email, s.email) as email,
                   ci.phone_primary,
                   s.batch,
                   s.section,
                   s.current_semester,
                   s.current_semester,
                   s.section,
                   coalesce(ga.marks_count, 0) as marks_count,
                   coalesce(aa.attendance_count, 0) as attendance_count,
                   coalesce(aa.attendance_percentage, 0) as attendance_percentage,
                   coalesce(ga.average_grade_points, 0) as average_grade_points,
                   coalesce(ga.average_internal_percentage, 0) as average_internal_percentage,
                   coalesce(ga.backlogs, 0) as backlogs,
                   s.reg_no,
                   rank() over (order by coalesce(ga.average_grade_points, 0) desc, coalesce(aa.attendance_percentage, 0) desc) as rank
            from rollups r
            left join students s on s.roll_no = r.roll_no
            left join contact_info ci on ci.roll_no = r.roll_no
            left join family_details fd on fd.roll_no = r.roll_no
            left join grade_agg ga on ga.roll_no = r.roll_no
            left join attendance_agg aa on aa.roll_no = r.roll_no
        '''

    @classmethod
    async def build_admin_directory(cls, db: AsyncSession, credits_cte_values: str):
        query = text(f'{cls._admin_directory_query_text(credits_cte_values)} order by r.roll_no desc')
        result = await db.execute(query)
        rows = result.mappings().all()
        return [schemas.AdminDirectoryStudent(**dict(row)) for row in rows]

    @staticmethod
    def filter_admin_directory(
        directory: list[schemas.AdminDirectoryStudent],
        search: str = '',
        city: str = '',
        batch: str = '',
        semester: Optional[int] = None,
        section: str = '',
        risk_only: bool = False,
        sort_by: str = 'roll_no',
        sort_dir: str = 'desc',
        limit: int = 200,
    ):
        results = directory
        search_term = search.strip().lower()
        if search_term:
            results = [
                item for item in results
                if search_term in ' '.join([
                    item.roll_no or '',
                    item.name or '',
                    item.email or '',
                    item.city or '',
                ]).lower()
            ]
        if city:
            results = [item for item in results if (item.city or '').lower() == city.strip().lower()]
        if batch:
            results = [item for item in results if (item.batch or '').lower() == batch.strip().lower()]
        if semester is not None:
            results = [item for item in results if item.current_semester == semester]
        if section:
            results = [item for item in results if (item.section or '').lower() == section.strip().lower()]
        if risk_only:
            results = [
                item for item in results
                if item.backlogs > 0
                or item.average_grade_points < 6
                or item.average_internal_percentage < 60
                or item.attendance_percentage < 75
                or item.attendance_count == 0
            ]

        key_fn = DIRECTORY_SORT_KEYS.get(sort_by, DIRECTORY_SORT_KEYS['roll_no'])
        reverse = sort_dir.lower() != 'asc'
        results = sorted(results, key=key_fn, reverse=reverse)
        return results[:max(1, min(limit, 500))]

    @staticmethod
    def build_directory_insights(directory: list[schemas.AdminDirectoryStudent]) -> schemas.AdminDirectoryInsights:
        def make_counter(values):
            counter = Counter([value for value in values if value])
            return [schemas.AdminDirectoryInsightItem(label=label, count=count) for label, count in counter.most_common(12)]

        return schemas.AdminDirectoryInsights(
            total_records=len(directory),
            risk_students=sum(
                1 for item in directory
                if item.backlogs > 0
                or item.average_grade_points < 6
                or item.average_internal_percentage < 60
                or item.attendance_percentage < 75
                or item.attendance_count == 0
            ),
            cities=make_counter(item.city for item in directory),
            batches=make_counter(item.batch for item in directory),
            semesters=make_counter(str(item.current_semester) for item in directory if item.current_semester is not None),
            missing_email_count=sum(1 for item in directory if not item.email),
            missing_phone_count=sum(1 for item in directory if not item.phone_primary),
            missing_batch_count=sum(1 for item in directory if not item.batch),
        )

    @classmethod
    def build_admin_analytics(cls, directory: list[schemas.AdminDirectoryStudent]) -> schemas.AdminAnalyticsResponse:
        directory_insights = cls.build_directory_insights(directory)
        risk_breakdown = schemas.AdminRiskBreakdown()
        attendance_bands = Counter()
        gpa_bands = Counter()

        for item in directory:
            if item.attendance_count == 0 and item.marks_count == 0:
                risk_breakdown.missing_data += 1
            elif item.backlogs > 1 or item.attendance_percentage < 65 or item.average_grade_points < 5:
                risk_breakdown.critical += 1
            elif item.backlogs > 0 or item.attendance_percentage < 75 or item.average_grade_points < 6.5:
                risk_breakdown.warning += 1
            else:
                risk_breakdown.healthy += 1

            if item.attendance_count == 0:
                attendance_bands['No data'] += 1
            elif item.attendance_percentage < 75:
                attendance_bands['< 75%'] += 1
            elif item.attendance_percentage < 85:
                attendance_bands['75-85%'] += 1
            else:
                attendance_bands['> 85%'] += 1

            if item.marks_count == 0:
                gpa_bands['No data'] += 1
            elif item.average_grade_points < 6:
                gpa_bands['< 6.0'] += 1
            elif item.average_grade_points < 8:
                gpa_bands['6.0-8.0'] += 1
            else:
                gpa_bands['> 8.0'] += 1

        return schemas.AdminAnalyticsResponse(
            risk_breakdown=risk_breakdown,
            batch_distribution=[schemas.AdminDirectoryInsightItem(label=item.label, count=item.count) for item in directory_insights.batches],
            semester_distribution=[schemas.AdminDirectoryInsightItem(label=item.label, count=item.count) for item in directory_insights.semesters],
            city_distribution=[schemas.AdminDirectoryInsightItem(label=item.label, count=item.count) for item in directory_insights.cities],
            attendance_bands=[schemas.AdminDirectoryInsightItem(label=label, count=count) for label, count in attendance_bands.items()],
            gpa_bands=[schemas.AdminDirectoryInsightItem(label=label, count=count) for label, count in gpa_bands.items()],
        )
    @classmethod
    async def assign_sections(cls, db: AsyncSession, batch: str):
        """
        Orders students by RegNo and divides them into section A (first half) and B (second half).
        """
        # Sanitize batch by removing spaces
        clean_batch = str(batch).replace(" ", "")
        
        # Fetch all students in the given batch (comparing without spaces), ordered by reg_no
        stmt = select(models.Student).where(func.replace(models.Student.batch, ' ', '') == clean_batch).order_by(models.Student.reg_no)
        result = await db.execute(stmt)
        students = result.scalars().all()
        
        if not students:
            return 0
            
        n = len(students)
        mid = n // 2
        
        # Update first half to Section A
        for i, s in enumerate(students):
            if i < mid:
                s.section = 'A'
            else:
                s.section = 'B'
        
        await db.commit()
        return n
