import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Loader2 } from 'lucide-react';
import api from '../api/client';
import TimetableGrid from './TimetableGrid';

export default function SchedulePanel() {
  const [section, setSection] = useState('A');
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['staff-schedule', section],
    queryFn: () => api.get('staff/schedule', { params: { section } }),
  });

  if (isLoading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Staff Timetable</p>
            <p className="text-sm text-muted-foreground">II Semester • Sections A & B</p>
          </div>
        </div>
        <div className="inline-flex rounded-full bg-muted p-1 border border-border/60 shadow-inner">
          {['A', 'B'].map((sec) => (
            <button
              key={sec}
              onClick={() => setSection(sec)}
              className={`px-4 py-1.5 text-sm font-bold rounded-full transition-all ${
                section === sec ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Section {sec}
            </button>
          ))}
        </div>
      </div>

      <TimetableGrid
        entries={schedule || []}
        title={`Weekly Timetable • Section ${section}`}
        subtitle="Use this to plan classes and mark attendance quickly."
      />
    </div>
  );
}
