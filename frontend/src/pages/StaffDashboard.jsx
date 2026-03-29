import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  Calendar, 
  ArrowRight, 
  Edit3, 
  FileText, 
  Loader2, 
  CalendarDays,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import api from '../api/client';
import MarksEntry from '../components/MarksEntry';
import AttendancePanel from '../components/AttendancePanel';
import SchedulePanel from '../components/SchedulePanel';
import StaffPerformancePanel from '../components/StaffPerformancePanel';
import StaffInsightsPanel from '../components/StaffInsightsPanel';

const StatCard = ({ label, value, hint, icon: Icon, trend }) => (
  <div className="metric-card group overflow-hidden relative">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      </div>
      <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
        <Icon size={24} />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2">
      {trend && (
        <span className={`text-xs font-bold ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
    <div className="absolute bottom-0 right-0 w-24 h-24 -mr-8 -mb-8 bg-primary/5 rounded-full" />
  </div>
);

const SubjectCard = ({ subject, onManageMarks }) => (
  <div className="panel group hover:border-primary/50 transition-colors">
    <div className="flex items-start justify-between mb-6">
      <div className="p-3 rounded-2xl bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <BookOpen size={24} />
      </div>
      <span className="px-3 py-1 rounded-full bg-muted text-[10px] font-black uppercase tracking-widest">
        SEM {subject.semester}
      </span>
    </div>
    
    <h3 className="text-lg font-bold text-foreground mb-1">{subject.subject_name}</h3>
    <p className="text-sm text-muted-foreground font-mono mb-6">{subject.course_code}</p>
    
    <div className="grid grid-cols-4 gap-2 mb-6">
      <div className="p-2 rounded-xl border border-border/40 bg-muted/20 text-center">
        <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-tight">Students</p>
        <p className="text-lg font-bold">{subject.student_count}</p>
      </div>
      <div className="p-2 rounded-xl border border-border/40 bg-muted/20 text-center">
        <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-tight">Pass Rate</p>
        <p className="text-lg font-bold">{subject.pass_percentage}%</p>
      </div>
      <div className="p-2 rounded-xl border border-border/40 bg-muted/20 text-center">
        <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-tight">Avg Marks</p>
        <p className="text-lg font-bold">{subject.average_marks}</p>
      </div>
      <div className="p-2 rounded-xl border border-border/40 bg-muted/20 text-center">
        <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-tight">Attendance</p>
        <p className="text-lg font-bold">{subject.average_attendance}%</p>
      </div>
    </div>
    
    <button 
      onClick={() => onManageMarks(subject)}
      className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-2xl group/btn"
    >
      <Edit3 size={18} />
      Manage Marks
      <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
    </button>
  </div>
);

export default function StaffDashboard() {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'Overview';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['staff-me'],
    queryFn: () => api.get('staff/me'),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  const staff = data;
  
  const getGreetingName = () => {
    if (!staff?.name) return "";
    const parts = staff.name.split(' ');
    const titles = ['dr.', 'mr.', 'ms.', 'prof.', 'prof', 'dr'];
    if (parts.length > 1 && titles.includes(parts[0].toLowerCase())) {
       return parts.slice(0, 2).join(' ');
    }
    return parts[0];
  };

  return (
    <div className="w-full pb-24 lg:pb-10 space-y-8 animate-in fade-in duration-700">
      <header className="hero-panel px-6 lg:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Faculty Portal</p>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Welcome back, {getGreetingName()}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              {activeTab === 'Overview' && "Manage your academic records, track student performance, and update internal assessment marks."}
              {activeTab === 'Attendance' && "Mark daily student attendance by listing absentees for your sessions."}
              {activeTab === 'Schedule' && "View your weekly academic schedule and timetable assignments."}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 text-white border border-white/20 backdrop-blur-sm">
              <CalendarDays size={18} />
              <span className="text-sm font-semibold">{staff?.department || 'MCA Department'}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Hidden on mobile, as bottom nav handles it */}
        <div className="mt-12 hidden lg:flex items-center gap-2 p-1.5 bg-white/10 rounded-[1.5rem] w-fit border border-white/10 backdrop-blur-md">
          {[
            { id: 'Overview', label: 'Overview', icon: TrendingUp },
            { id: 'Attendance', label: 'Attendance', icon: Users },
            { id: 'Schedule', label: 'Schedule', icon: Calendar },
            { id: 'Performance', label: 'Performance', icon: BookOpen },
            { id: 'Insights', label: 'Insights', icon: Users }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-primary shadow-lg' 
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'Overview' && (
        <>
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <StatCard 
              label="Total Students" 
              value={staff?.total_students_handled || 0} 
              hint="Enrolled in your subjects" 
              icon={Users} 
            />
            <StatCard 
              label="Subjects" 
              value={staff?.subjects?.length || 0} 
              hint="Active teaching load" 
              icon={BookOpen} 
            />
            <StatCard 
              label="Avg Performance" 
              value={`${staff?.average_performance || 0}%`} 
              hint="Batch avg score" 
              icon={TrendingUp} 
            />
            <StatCard 
              label="Pending Marks" 
              value={staff?.pending_marks_count || 0} 
              hint="Students needing entry" 
              icon={FileText} 
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Faculty Workload</h2>
                <p className="text-muted-foreground mt-1">Select a subject to manage student lists and internal assessments.</p>
              </div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {staff?.subjects?.map((subject) => (
                <SubjectCard 
                  key={subject.id} 
                  subject={subject} 
                  onManageMarks={setSelectedSubject} 
                />
              ))}
              
              {staff?.subjects?.length === 0 && (
                <div className="col-span-full py-20 bg-muted/20 border-2 border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                  <div className="p-4 rounded-3xl bg-muted mb-4">
                    <AlertTriangle size={32} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold">No assigned subjects found</h3>
                  <p className="text-muted-foreground mt-2">Contact the administrator to check your faculty assignments.</p>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Recent Mark Revisions</h3>
                <CheckCircle size={18} className="text-emerald-500" />
              </div>
              <div className="space-y-4">
                {staff?.recent_marks_updates?.length > 0 ? (
                  staff.recent_marks_updates.map((update, idx) => (
                    <div key={idx} className="p-3 rounded-2xl border border-border/40 hover:bg-muted/30 transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-semibold group-hover:text-primary">{update.subject_name}</p>
                        <span className="text-xs text-muted-foreground">{new Date(update.updated_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {update.action} for <span className="font-semibold text-foreground">{update.student_name}</span> ({update.roll_no})
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/40">
                    <p className="text-sm font-semibold">No recent updates</p>
                    <p className="text-xs text-muted-foreground mt-1">System is waiting for assessment cycle data.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="panel">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Department Announcements</h3>
                <ArrowRight size={18} className="text-primary" />
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-border/40 hover:bg-muted/30 transition-colors cursor-pointer group">
                  <p className="text-xs font-black uppercase text-primary mb-1">Important</p>
                  <p className="text-sm font-semibold group-hover:text-primary">CIT-1 Marks entry deadline extended to 25th March.</p>
                  <p className="text-xs text-muted-foreground mt-2">Posted 2 hours ago</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'Attendance' && (
        <AttendancePanel subjects={staff?.subjects || []} />
      )}

      {activeTab === 'Schedule' && (
        <SchedulePanel />
      )}

      {activeTab === 'Performance' && (
        <StaffPerformancePanel />
      )}

      {activeTab === 'Insights' && (
        <StaffInsightsPanel />
      )}

      {selectedSubject && (
        <MarksEntry 
          subject={selectedSubject} 
          onClose={() => setSelectedSubject(null)} 
        />
      )}
    </div>
  );
}
