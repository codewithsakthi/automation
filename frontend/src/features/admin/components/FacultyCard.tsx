import React from 'react';
import type { FacultyImpactMatrixItem } from '../../../types/enterprise';

export function FacultyCard({ item }: { item: FacultyImpactMatrixItem }) {
  return (
    <div className="p-4 rounded-2xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.faculty_name}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{item.subject_code}</p>
        </div>
        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em]">
          {item.impact_label || 'IMPACT'}
        </span>
      </div>
    </div>
  );
}
