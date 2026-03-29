import React from 'react';

export function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="metric-card">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </article>
  );
}
