import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export const SectionTitle = ({ eyebrow, title, copy }) => (
  <div className="section-title-premium">
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2>{title}</h2>
    {copy && <p>{copy}</p>}
  </div>
);

export const StatCard = ({ icon: Icon, label, value, accent, trend, subValue }) => (
  <div className="bento-card relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: accent }} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
      </div>
      <div className="p-2 rounded-xl" style={{ backgroundColor: `${accent}15`, color: accent }}>
        <Icon size={20} />
      </div>
    </div>
    {trend !== undefined && (
      <div className={`mt-4 flex items-center text-xs font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
        {trend >= 0 ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
        {Math.abs(trend)}% from last sem
      </div>
    )}
  </div>
);

export const SortHeader = ({ label, field, currentSort, currentDir, onSort }) => {
  const isActive = currentSort === field;
  return (
    <th onClick={() => onSort(field)} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer group hover:text-primary transition-colors">
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {isActive ? (
            currentDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
          ) : (
            <ArrowUpDown size={14} />
          )}
        </span>
      </div>
    </th>
  );
};
