import React from 'react';
import { Users, Search, Target, ShieldAlert } from 'lucide-react';

export default function StaffInsightsPanel() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="panel flex flex-col items-center justify-center py-20 bg-muted/20 border-2 border-dashed border-border rounded-[2.5rem] text-center">
        <div className="p-4 rounded-3xl bg-accent/10 mb-4 animate-pulse">
          <Users size={48} className="text-accent" />
        </div>
        <h3 className="text-2xl font-bold">Student Insights Portal</h3>
        <p className="text-muted-foreground mt-3 max-w-lg mb-8">
          The 360-degree student evaluation and predictive trajectory module will be available directly in this space.
        </p>

        <div className="relative group w-full max-w-xl mx-auto mb-10 opacity-60">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input 
            type="text" 
            placeholder="Search by student name or roll number..." 
            className="w-full pl-12 pr-4 py-4 bg-card rounded-2xl border border-border focus:ring-0 outline-none"
            disabled
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl opacity-50 pointer-events-none">
          <div className="p-6 rounded-2xl bg-card border border-border flex items-center justify-center gap-4">
            <Target className="text-accent" />
            <h4 className="font-bold">Cohort Placement Readiness</h4>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border flex items-center justify-center gap-4">
            <ShieldAlert className="text-rose-500" />
            <h4 className="font-bold">Early Warning Detection</h4>
          </div>
        </div>
      </div>
    </div>
  );
}
