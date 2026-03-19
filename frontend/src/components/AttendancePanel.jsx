import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import api from '../api/client';

export default function AttendancePanel({ subjects }) {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.subject_id || '');
  const [hour, setHour] = useState(1);
  const [absenteesText, setAbsenteesText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedSubject = subjects.find(s => s.subject_id === parseInt(selectedSubjectId));

  const mutation = useMutation({
    mutationFn: (data) => api.post('staff/attendance', data),
    onSuccess: () => {
      setAbsenteesText('');
      // Optional: show toast
    },
  });

  const handleSubmit = () => {
    if (!selectedSubject) return;

    // Parse roll numbers from text (comma or newline separated)
    const absentees = absenteesText
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s !== '');

    mutation.mutate({
      subject_id: selectedSubject.subject_id,
      date,
      hour: parseInt(hour),
      absentees,
      section: selectedSubject.section || 'A',
      semester: selectedSubject.semester
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="panel">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users size={20} className="text-primary" />
              Mark Absentees
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="space-y-2">
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
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Date</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hour / Session</label>
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
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-primary font-bold uppercase mb-1">PRO-TIP</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The system marks all students as <span className="text-foreground font-bold">Present</span> by default. 
                  Just list the roll numbers of students who are absent.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Absentees (Roll Numbers)</label>
              <textarea 
                placeholder="Ex: 258301, 258315, 258322"
                value={absenteesText}
                onChange={(e) => setAbsenteesText(e.target.value)}
                rows={5}
                className="input-field w-full resize-none font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Separate roll numbers with commas or new lines.</p>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={mutation.isPending || !absenteesText.trim()}
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
                <span className="text-muted-foreground">Semester</span>
                <span className="font-bold">{selectedSubject?.semester || 1}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Section</span>
                <span className="font-bold">{selectedSubject?.section || 'A'}</span>
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
