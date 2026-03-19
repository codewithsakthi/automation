import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Loader2, BookOpen, Layers } from 'lucide-react';
import api from '../api/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [1, 2, 3, 4, 5, 6, 7];

export default function SchedulePanel() {
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['staff-schedule'],
    queryFn: () => api.get('staff/schedule'),
  });

  if (isLoading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  const getEntry = (dayIdx, hour) => {
    return schedule?.find(e => e.day_of_week === dayIdx && e.hour === hour);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-2">
         <h3 className="text-xl font-bold flex items-center gap-2">
           <Calendar size={22} className="text-primary" />
           Weekly Timetable
         </h3>
         <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30" /> 
             1st Year (Sem 1-2)
           </div>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-violet-500/20 border border-violet-500/30" /> 
             2nd Year (Sem 3-4)
           </div>
         </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[1000px] border border-border rounded-[2rem] overflow-hidden bg-card shadow-xl">
          <div className="grid grid-cols-8 divide-x divide-border bg-muted/30">
            <div className="p-4" />
            {HOURS.map(hour => (
              <div key={hour} className="p-4 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground flex flex-col items-center justify-center">
                <span>Hour {hour}</span>
                <span className="text-[8px] mt-1 opacity-60">
                  {hour === 1 ? '9:00 AM' : hour === 2 ? '10:00 AM' : hour === 3 ? '11:00 AM' : hour === 4 ? '1:00 PM' : hour === 5 ? '2:00 PM' : hour === 6 ? '3:00 PM' : '4:00 PM'}
                </span>
              </div>
            ))}
          </div>

          <div className="divide-y divide-border">
            {DAYS.map((day, dayIdx) => (
              <div key={day} className="grid grid-cols-8 divide-x divide-border min-h-[100px]">
                <div className="p-4 flex flex-col items-center justify-center bg-muted/10">
                   <Clock size={16} className="text-muted-foreground mb-1" />
                   <span className="text-[10px] font-black uppercase tracking-widest">{day}</span>
                </div>
                
                {HOURS.map(hour => {
                  const entry = getEntry(dayIdx, hour);
                  const isSecondYear = entry?.semester >= 3;
                  
                  return (
                    <div key={`${dayIdx}-${hour}`} className="p-2 group">
                      {entry ? (
                        <div className={`h-full p-3 rounded-2xl border transition-all ${
                          isSecondYear 
                            ? 'bg-violet-500/10 border-violet-500/20 group-hover:bg-violet-500/20 text-violet-700' 
                            : 'bg-primary/10 border-primary/20 group-hover:bg-primary/20 text-primary'
                        }`}>
                           <p className="text-[10px] font-black uppercase tracking-tight mb-1 opacity-70">
                             {entry.course_code}
                           </p>
                           <p className="text-xs font-bold leading-tight line-clamp-2">
                             {entry.subject_name}
                           </p>
                           <div className="mt-2 flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-white/50 text-[9px] font-black uppercase">
                                Sec {entry.section}
                              </span>
                           </div>
                        </div>
                      ) : (
                        <div className="h-full rounded-2xl border border-dashed border-border/40 group-hover:bg-muted/30 transition-colors" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {schedule?.length === 0 && (
        <div className="py-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-border">
          <BookOpen className="mx-auto text-muted-foreground mb-4" size={40} />
          <h3 className="text-lg font-bold">No schedule data available</h3>
          <p className="text-muted-foreground mt-2">Check with the academic office for your timetable assignments.</p>
        </div>
      )}
    </div>
  );
}
