import React from 'react';
import { BarChart2, TrendingUp, AlertTriangle, BookOpen } from 'lucide-react';

export default function StaffPerformancePanel() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="panel flex flex-col items-center justify-center py-20 bg-muted/20 border-2 border-dashed border-border rounded-[2.5rem] text-center">
        <div className="p-4 rounded-3xl bg-primary/10 mb-4 animate-pulse">
          <BarChart2 size={48} className="text-primary" />
        </div>
        <h3 className="text-2xl font-bold">Subject Performance Module</h3>
        <p className="text-muted-foreground mt-3 max-w-lg mb-8">
          Detailed analytics regarding student throughput, batch averages, and historical pass rates are currently being synthesized.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl opacity-50 pointer-events-none">
          <div className="p-6 rounded-2xl bg-card border border-border">
            <TrendingUp className="text-emerald-500 mb-4" />
            <h4 className="font-bold">Pass Rate Trends</h4>
            <div className="h-2 w-full bg-muted mt-4 rounded"></div>
            <div className="h-2 w-2/3 bg-muted mt-2 rounded"></div>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border">
            <AlertTriangle className="text-rose-500 mb-4" />
            <h4 className="font-bold">At-Risk Students</h4>
            <div className="h-2 w-full bg-muted mt-4 rounded"></div>
            <div className="h-2 w-1/2 bg-muted mt-2 rounded"></div>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border">
            <BookOpen className="text-primary mb-4" />
            <h4 className="font-bold">Assessment Breakdown</h4>
            <div className="h-2 w-full bg-muted mt-4 rounded"></div>
            <div className="h-2 w-3/4 bg-muted mt-2 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
