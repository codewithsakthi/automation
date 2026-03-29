import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useAdminCommandCenter } from '../hooks/useAdminData';
import { PlacementCandidate } from '../../../types/enterprise';

export default function PlacementView({ onOpenStudentProfile }: { onOpenStudentProfile: (rollNo: string) => void }) {
  const { commandCenter: data } = useAdminCommandCenter();
  const [placementSearch, setPlacementSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  // We only define columns for sorting/filtering. The actual UI is manually rendered below to match existing design exactly.
  const columns = useMemo<ColumnDef<PlacementCandidate>[]>(() => [
    { accessorKey: 'student_name', header: 'Candidate' },
    { accessorKey: 'cgpa', header: 'CGPA' },
    { accessorKey: 'coding_score', header: 'Coding Score' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'risk_level', header: 'Risk' },
  ], []);

  const table = useReactTable({
    data: data?.placement_ready || [],
    columns,
    state: { sorting, globalFilter: placementSearch },
    onSortingChange: setSorting,
    onGlobalFilterChange: setPlacementSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <article className="panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-foreground">Placement Readiness Engine</p>
            <p className="text-sm text-muted-foreground">Detailed candidate mapping for upcoming drives.</p>
          </div>
          <div className="relative">
            <input
              value={placementSearch}
              onChange={(e) => setPlacementSearch(e.target.value)}
              className="input-field !py-2 !w-64 pl-10"
              placeholder="Filter candidates..."
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">CGPA</th>
                <th className="px-4 py-3 text-left">Coding</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Risk</th>
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => {
                const d = row.original as any;
                return (
                  <tr key={row.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4">
                      <button onClick={() => onOpenStudentProfile(d.roll_no)} className="text-left group">
                        <p className="font-semibold group-hover:text-primary">{d.student_name || d.name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.roll_no} | {d.batch}</p>
                      </button>
                    </td>
                    <td className="px-4 py-4 font-bold">{d.cgpa || d.average_grade_points || '-'}</td>
                    <td className="px-4 py-4 text-muted-foreground">{d.coding_score || d.coding_subject_score || '-'}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${d.status === 'Ready' || d.placement_ready ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600'}`}>
                        {d.status || (d.placement_ready ? 'Ready' : 'In Progress')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`risk-badge risk-${(d.risk_level || 'low').toLowerCase()}`}>{d.risk_level || 'Low'}</span>
                    </td>
                  </tr>
                );
              })}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">No candidate mappings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
