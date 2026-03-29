import React, { useMemo, useState } from 'react';
import { 
  Search, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  ClipboardCheck,
  Zap
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useAdminCommandCenter } from '../hooks/useAdminData';

function Metric({ label, value, hint, className = '' }: { label: string; value: string; hint: string; className?: string }) {
  return (
    <div className={`p-4 rounded-xl border border-border/40 bg-card/40 ${className}`}>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">{hint}</p>
    </div>
  );
}

type RiskTab = 'strategic' | 'attendance' | 'academic' | 'clusters';

export default function RiskRadarView({ onOpenStudentProfile }: { onOpenStudentProfile: (rollNo: string) => void }) {
  const { commandCenter: data } = useAdminCommandCenter();
  const [activeTab, setActiveTab] = useState<RiskTab>('strategic');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  // 1. Column Definitions for different tabs
  const strategicColumns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'name', header: 'Student' },
    { accessorKey: 'risk_score', header: 'Risk Score' },
    { accessorKey: 'risk_level', header: 'Status' },
  ], []);

  const attendanceColumns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'name', header: 'Student' },
    { accessorKey: 'attendance_percentage', header: 'Attendance %' },
    { accessorKey: 'batch', header: 'Batch' },
  ], []);

  const academicColumns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'name', header: 'Student' },
    { accessorKey: 'average_grade_points', header: 'Current GPA' },
    { accessorKey: 'backlogs', header: 'Backlogs' },
  ], []);

  // 2. Select data based on active tab
  const tableData = useMemo(() => {
    switch (activeTab) {
      case 'strategic': return data?.watchlist_students || [];
      case 'attendance': return data?.attendance_defaulters || [];
      case 'academic': return data?.internal_defaulters || [];
      default: return [];
    }
  }, [activeTab, data]);

  const tableColumns = useMemo(() => {
    switch (activeTab) {
      case 'strategic': return strategicColumns;
      case 'attendance': return attendanceColumns;
      case 'academic': return academicColumns;
      default: return [];
    }
  }, [activeTab, strategicColumns, attendanceColumns, academicColumns]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* Top Metrics Summary */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric 
          label="Strategic Alert" 
          value={String(data?.risk_summary?.critical ?? 0)} 
          hint="Multivariate immediate action." 
          className="border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400"
        />
        <Metric 
          label="Attendance Alarms" 
          value={String(data?.attendance_defaulters?.length ?? 0)} 
          hint="Students below 75% thresholds." 
          className="border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400"
        />
        <Metric 
          label="Internal Alarms" 
          value={String(data?.internal_defaulters?.length ?? 0)} 
          hint="Low assessment participation." 
          className="border-primary/20 bg-primary/5 text-primary"
        />
        <Metric 
          label="Arrears Clusters" 
          value={String(data?.bottlenecks?.length ?? 0)} 
          hint="High-risk subject groups." 
          className="border-border/60 bg-muted/20 text-foreground"
        />
      </section>

      {/* Main Analysis Panel */}
      <article className="panel !p-0">
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto flex-nowrap hide-scrollbar border-b border-border/60 bg-muted/20 px-4 pt-1">
          <button 
            onClick={() => { setActiveTab('strategic'); setSearch(''); }}
            className={`tab-link flex-shrink-0 ${activeTab === 'strategic' ? 'active' : ''}`}
          >
            <ShieldAlert size={14} />
            Strategic Registry
          </button>
          <button 
            onClick={() => { setActiveTab('attendance'); setSearch(''); }}
            className={`tab-link flex-shrink-0 ${activeTab === 'attendance' ? 'active' : ''}`}
          >
            <Activity size={14} />
            Attendance Alarms
          </button>
          <button 
            onClick={() => { setActiveTab('academic'); setSearch(''); }}
            className={`tab-link flex-shrink-0 ${activeTab === 'academic' ? 'active' : ''}`}
          >
            <ClipboardCheck size={14} />
            Academic Alarms
          </button>
          <button 
            onClick={() => { setActiveTab('clusters'); setSearch(''); }}
            className={`tab-link flex-shrink-0 ${activeTab === 'clusters' ? 'active' : ''}`}
          >
            <Zap size={14} />
            Subject Heatmap
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab !== 'clusters' && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground capitalize">{activeTab} Risk Analysis</p>
                  <p className="text-sm text-muted-foreground">Detailed student tracking for the selected cohort.</p>
                </div>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field !py-2 !w-64 pl-10"
                    placeholder={`Filter cohort...`}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Primary Vector</th>
                      <th className="px-4 py-3 text-left">Details</th>
                      <th className="px-4 py-3 text-left">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map(row => {
                      const d = row.original as any;
                      return (
                        <tr key={row.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4">
                            <button onClick={() => onOpenStudentProfile(d.roll_no)} className="text-left group">
                              <p className="font-semibold group-hover:text-primary">{d.name || d.student_name}</p>
                              <p className="text-[10px] text-muted-foreground">{d.roll_no} | {d.batch}</p>
                            </button>
                          </td>
                          <td className="px-4 py-4">
                             {activeTab === 'strategic' && (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                    <div 
                                      className={`h-full ${d.risk_score > 75 ? 'bg-red-500' : 'bg-primary'}`} 
                                      style={{ width: `${d.risk_score}%` }} 
                                    />
                                  </div>
                                  <span className="font-bold text-xs">{d.risk_score}%</span>
                                </div>
                             )}
                             {activeTab === 'attendance' && (
                                <span className="font-bold text-rose-500">{Number(d.attendance_percentage || d.attendance_pct || 0).toFixed(1)}% Usage</span>
                             )}
                             {activeTab === 'academic' && (
                                <span className="font-bold bg-muted px-2 py-0.5 rounded text-xs">{Number(d.average_grade_points || 0).toFixed(2)} GPA</span>
                             )}
                          </td>
                          <td className="px-4 py-4 text-xs">
                             {activeTab === 'strategic' && (
                                <div className="space-y-1">
                                  {d.attendance_percentage < 75 && <p className="text-amber-500 flex items-center gap-1 font-semibold"><AlertTriangle size={10} /> Attendance Deficit</p>}
                                  {d.gpa_drop_factor > 0.3 && <p className="text-red-500 flex items-center gap-1 font-semibold"><TrendingDown size={10} /> GPA Volatility</p>}
                                  {d.risk_score >= 70 && <p className="text-rose-600 flex items-center gap-1 font-bold italic"><Zap size={10} /> Prioritize Review</p>}
                                  {!(d.attendance_percentage < 75 || d.gpa_drop_factor > 0.3 || d.risk_score >= 70) && <p className="text-muted-foreground italic">Multivariate concern</p>}
                                </div>
                             )}
                             {activeTab === 'attendance' && (
                                <p className="text-muted-foreground">Low engagement detected in Batch {d.batch}</p>
                             )}
                             {activeTab === 'academic' && (
                                <p className="text-red-500 font-bold">{d.backlogs} Pending Backlogs</p>
                             )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`risk-badge risk-${(d.risk_level || (activeTab === 'strategic' ? 'low' : 'high')).toLowerCase()}`}>
                              {d.risk_level || (activeTab === 'strategic' ? 'Low' : 'Critical')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {table.getRowModel().rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Zap size={32} className="opacity-20 mb-2" />
                            <p className="text-lg font-semibold">Cohort Clear</p>
                            <p className="text-sm italic">No students found in the {activeTab} risk registry.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'clusters' && (
            <div className="space-y-6">
              <div className="mb-4">
                <p className="text-lg font-semibold text-foreground">Subject Heatmap</p>
                <p className="text-sm text-muted-foreground">Identifying specific subject codes with elevated failure clusters.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(data?.bottlenecks || []).length > 0 ? (
                   (data?.bottlenecks || []).map((cluster: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-all group">
                       <div className="flex justify-between items-start mb-3">
                         <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                           <BarChart3 size={20} />
                         </div>
                         <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                           High Pressure
                         </span>
                       </div>
                       <p className="font-bold text-foreground truncate">{cluster.subject_name || cluster.subject_code || "Unknown Subject"}</p>
                       <p className="text-xs text-muted-foreground mb-1">Subject Code: {cluster.subject_code || '-'}</p>
                       <p className="text-xs text-muted-foreground mb-4">{cluster.attempts || 0} students stuck in this cluster</p>
                       <div className="flex items-center justify-between text-sm">
                         <span className="text-muted-foreground">Failure Rate</span>
                         <span className="font-mono font-bold text-rose-500">{cluster.failure_rate || 0}%</span>
                       </div>
                    </div>
                   ))
                ) : (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-border/40 rounded-3xl">
                    <p className="text-muted-foreground">No high-risk subject clusters identified in current payload.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </article>

      <style>{`
        .tab-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted-foreground);
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab-link:hover {
          color: var(--foreground);
          background: rgba(255,255,255,0.05);
        }
        .tab-link.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
      `}</style>
    </div>
  );
}
