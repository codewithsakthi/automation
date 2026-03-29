import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Info, Search } from 'lucide-react';
import { useSubjectCatalog, useSubjectLeaderboard } from '../hooks/useAdminData';

export default function LeaderboardView() {
  const { subjects, isLoading: isLoadingSubjects } = useSubjectCatalog();
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'top' | 'bottom'>('top');

  // Auto-select first subject if available
  useEffect(() => {
    if (subjects?.length && !selectedSubject) {
      setSelectedSubject(subjects[0].subject_code);
    }
  }, [subjects, selectedSubject]);

  const { leaderboard, isLoading: isLoadingLeaderboard } = useSubjectLeaderboard(selectedSubject);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Subject Leaderboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Track top and bottom performers across different subjects and courses.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={isLoadingSubjects}
            className="w-full appearance-none rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoadingSubjects ? (
              <option value="">Loading subjects...</option>
            ) : subjects && subjects.length > 0 ? (
              subjects.map((sub: any) => (
                <option key={sub.subject_code} value={sub.subject_code}>
                  {sub.subject_code} - {sub.subject_name}
                </option>
              ))
            ) : (
              <option value="">No subjects found</option>
            )}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
            <Search size={16} className="text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl overflow-hidden">
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setActiveTab('top')}
            className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'top' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp size={18} />
              <span>Top Performers</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bottom')}
            className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'bottom' ? 'bg-rose-500/10 text-rose-500 border-b-2 border-rose-500' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown size={18} />
              <span>Attention Required</span>
            </div>
          </button>
        </div>

        <div className="p-6">
          {isLoadingLeaderboard || isLoadingSubjects ? (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/20 animate-ping" />
                <p className="text-sm text-muted-foreground font-medium">Crunching ranking data...</p>
              </div>
            </div>
          ) : !leaderboard ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Info className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <p className="text-base font-semibold text-foreground">No Details Available</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Select a subject to view performance rankings for that specific course.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                  <tr>
                    <th className="pb-4 pl-4 font-black">Rank</th>
                    <th className="pb-4">Student</th>
                    <th className="pb-4">Roll No</th>
                    <th className="pb-4">Grade</th>
                    <th className="pb-4 text-right pr-4">Total Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {activeTab === 'top' && leaderboard.top_leaderboard.map((student: any) => (
                    <LeaderboardRow key={student.roll_no} student={student} isTop={true} />
                  ))}
                  
                  {activeTab === 'bottom' && leaderboard.bottom_leaderboard.map((student: any) => (
                    <LeaderboardRow key={student.roll_no} student={student} isTop={false} />
                  ))}

                  {activeTab === 'top' && leaderboard.top_leaderboard.length === 0 && (
                     <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">No top performers found for this subject.</td>
                     </tr>
                  )}

                  {activeTab === 'bottom' && leaderboard.bottom_leaderboard.length === 0 && (
                     <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">No failing students found for this subject. Great work!</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ student, isTop }: { student: any, isTop: boolean }) {
  return (
    <tr className="group transition-colors hover:bg-muted/30">
      <td className="py-4 pl-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
          student.class_rank === 1 ? 'bg-amber-500/10 text-amber-500' :
          student.class_rank === 2 ? 'bg-slate-300/10 text-slate-300' :
          student.class_rank === 3 ? 'bg-orange-700/10 text-orange-700' :
          isTop ? 'bg-primary/10 text-primary' : 'bg-rose-500/10 text-rose-500'
        }`}>
          {isTop && student.class_rank <= 3 ? <Trophy size={14} className="mr-0.5" /> : null}
          {student.class_rank}
        </div>
      </td>
      <td className="py-4">
        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{student.student_name}</p>
        <p className="text-xs text-muted-foreground">{student.batch || '-'} • Sem {student.current_semester || '-'}</p>
      </td>
      <td className="py-4">
        <span className="font-mono text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">{student.roll_no}</span>
      </td>
      <td className="py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
          ['O', 'A+', 'A'].includes(student.grade) ? 'bg-emerald-500/10 text-emerald-500' :
          ['U', 'F', 'FAIL'].includes(student.grade) ? 'bg-rose-500/10 text-rose-500' :
          'bg-slate-500/10 text-slate-500'
        }`}>
          {student.grade || 'N/A'}
        </span>
      </td>
      <td className="py-4 text-right pr-4">
        <span className="font-bold text-foreground text-base tracking-tight">{student.total_marks.toFixed(1)}</span>
        <span className="text-muted-foreground text-xs ml-1">/ 100</span>
      </td>
    </tr>
  );
}
