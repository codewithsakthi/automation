import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Users, AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import api from '../api/client';

export default function AttendancePanel({ subjects }) {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.subject_id || '');
  const [hour, setHour] = useState(1);
  const [absentees, setAbsentees] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const selectedSubject = subjects.find(s => s.subject_id === parseInt(selectedSubjectId));

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['staff-subject-students', selectedSubjectId],
    queryFn: () => api.get(`staff/subjects/${selectedSubjectId}/students`).then(res => res.data),
    enabled: !!selectedSubjectId
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('staff/attendance', data),
    onSuccess: () => {
      setAbsentees([]);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['staff-attendance-latest'] });
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || err?.message || 'Could not submit attendance';
      setError(msg);
    }
  });

  const handleSubmit = () => {
    if (!selectedSubject) return;

    mutation.mutate({
      subject_id: selectedSubject.subject_id,
      date,
      hour: parseInt(hour),
      absentees: absentees,
      section: selectedSubject.section || 'A',
      semester: selectedSubject.semester
    });
  };

  const toggleAttendance = (rollNo) => {
    setAbsentees(prev => 
      prev.includes(rollNo) 
        ? prev.filter(r => r !== rollNo) 
        : [...prev, rollNo]
    );
  };

  const markAllPresent = () => setAbsentees([]);
  const markAllAbsent = () => {
    if (students) setAbsentees(students.map(s => s.roll_no));
  };

  // Reset absentees if subject changes
  React.useEffect(() => {
    setAbsentees([]);
  }, [selectedSubjectId]);

  if (!subjects?.length) {
    return (
      <div className="panel border-dashed border-border text-center py-10">
        <p className="text-lg font-semibold mb-2">No subjects assigned</p>
        <p className="text-sm text-muted-foreground">Ask the admin to assign your MCA subjects before marking attendance.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="panel">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users size={20} className="text-primary" />
              Mark Absentees
            </h3>
            
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subject</label>
                <select 
                  value={selectedSubjectId} 
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="input-field w-full"
                >
                  {subjects.map(s => (
                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hour</label>
                <select 
                  value={hour} 
                  onChange={(e) => setHour(e.target.value)}
                  className="input-field w-full"
                >
                  {[1,2,3,4,5,6,7].map(h => (
                    <option key={h} value={h}>Hour {h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Student Roster</label>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="tab-chip flex items-center gap-1 px-3 py-1"
                    disabled={mutation.isPending || isLoadingStudents}
                  >
                    <CheckCircle2 size={14} className="text-emerald-500" /> All Present
                  </button>
                  <button
                    type="button"
                    onClick={markAllAbsent}
                    className="tab-chip flex items-center gap-1 px-3 py-1"
                    disabled={mutation.isPending || isLoadingStudents}
                  >
                    <AlertCircle size={14} className="text-rose-500" /> All Absent
                  </button>
                </div>
              </div>

              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-12 bg-muted/20 rounded-2xl border border-border/40">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : students?.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1 py-2">
                    {students.map(student => {
                      const isAbsent = absentees.includes(student.roll_no);
                      return (
                        <div 
                          key={student.id}
                          onClick={() => toggleAttendance(student.roll_no)}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all select-none
                            ${isAbsent 
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600' 
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            }`}
                        >
                          <span className="text-xs font-black tracking-widest mb-1">{student.roll_no}</span>
                          <span className="text-xs font-medium truncate w-full">{student.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4">
                    <p className="text-[11px] font-semibold text-emerald-500">
                      {students.length - absentees.length} Present
                    </p>
                    <p className="text-[11px] font-semibold text-rose-500">
                      {absentees.length} Absent
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-muted/20 border border-border/40 rounded-2xl">
                  <p className="text-sm font-semibold text-muted-foreground">No students enrolled</p>
                </div>
              )}
            </div>

            <button 
              onClick={handleSubmit}
              disabled={mutation.isPending || isLoadingStudents || !students}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base"
            >
              {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Submit Attendance
            </button>
            
            {mutation.isSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> Attendance submitted successfully.
              </div>
            )}
            {error && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel bg-muted/30">
            <h4 className="font-bold mb-4">Subject Summary</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Students</span>
                <span className="font-bold">{selectedSubject?.student_count || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Date</span>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none text-right font-bold w-32 outline-none"
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Semester</span>
                <span className="font-bold">{selectedSubject?.semester || 1}</span>
              </div>
            </div>
          </div>
          
          <div className="panel border-amber-500/30">
             <div className="flex items-start gap-3">
               <AlertCircle size={20} className="text-amber-500 shrink-0" />
               <div>
                  <h4 className="font-bold text-amber-500 text-sm">Modification Policy</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Attendance can be edited within 24 hours of submission. Contact HOD for changes beyond this window.
                  </p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
