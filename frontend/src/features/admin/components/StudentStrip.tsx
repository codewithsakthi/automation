import React from 'react';

export function StudentStrip({ item, onOpen }: { item: any; onOpen: (rollNo: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.roll_no)} className="row-card w-full text-left group">
      <div>
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.roll_no} | Sem {item.current_semester || '-'} | Batch {item.batch || '-'}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-right text-xs">
        <div>
          <p className="font-black text-foreground">{item.average_grade_points}</p>
          <p className="text-muted-foreground">GPA</p>
        </div>
        <div>
          <p className="font-black text-foreground">{item.attendance_percentage}%</p>
          <p className="text-muted-foreground">Attn</p>
        </div>
        <div>
          <p className={`font-black ${item.backlogs > 0 ? 'text-rose-600' : 'text-foreground'}`}>{item.backlogs}</p>
          <p className="text-muted-foreground">Backlogs</p>
        </div>
      </div>
    </button>
  );
}
