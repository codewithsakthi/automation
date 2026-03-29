import React from 'react';
import type { AdminCohortAction } from '../../../types/enterprise';

export function ActionCard({ item }: { item: AdminCohortAction }) {
  const toneClass =
    item.tone === 'critical'
      ? 'bg-rose-500/12 text-rose-700'
      : item.tone === 'warning'
        ? 'bg-amber-500/12 text-amber-700'
        : item.tone === 'positive'
          ? 'bg-emerald-500/12 text-emerald-700'
          : 'bg-slate-500/12 text-slate-700';

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${toneClass}`}>{item.tone}</span>
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-primary">{item.metric}</p>
    </div>
  );
}
