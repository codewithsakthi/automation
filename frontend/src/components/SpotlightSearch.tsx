import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command, Search, X } from 'lucide-react';
import api from '../api/client';
import type { SpotlightResult } from '../types/enterprise';

interface SpotlightSearchProps {
  onSelect: (result: SpotlightResult) => void;
}

export default function SpotlightSearch({ onSelect }: SpotlightSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [open]);

  const { data, isFetching } = useQuery<{ results: SpotlightResult[] }>({
    queryKey: ['spotlight-search', query],
    queryFn: () => api.get(`admin/spotlight-search?q=${encodeURIComponent(query)}`),
    enabled: open && query.trim().length > 1,
    staleTime: 15_000,
  });

  return (
    <>
      <button type="button" className="tab-chip flex items-center gap-2" onClick={() => setOpen(true)}>
        <Command size={14} />
        Spotlight
      </button>

      {open && (
        // Backdrop — tap anywhere outside to close (mobile-friendly)
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 px-4 py-14 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          {/* Panel — stop click from bubbling to backdrop */}
          <div
            className="w-full max-w-2xl rounded-[1.75rem] border border-border/70 bg-[var(--panel-strong)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.26)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-border/70 bg-card px-4 py-3">
              <Search size={18} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-base text-foreground outline-none"
                placeholder="Find any student, faculty, or subject"
              />
              {/* Always-visible close button (critical for mobile, handy on desktop) */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
                aria-label="Close spotlight"
              >
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {isFetching ? <div className="skeleton h-24 rounded-[1.25rem]" /> : null}
              {!isFetching && data?.results?.length ? (
                data.results.map((result) => (
                  <button
                    key={`${result.entity_type}-${result.entity_id}`}
                    type="button"
                    onClick={() => {
                      onSelect(result);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-[1.25rem] border border-border/60 bg-card/80 px-4 py-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{result.label}</p>
                      <p className="text-xs text-muted-foreground">{result.sublabel}</p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      {result.entity_type}
                    </span>
                  </button>
                ))
              ) : null}
              {!isFetching && query.trim().length > 1 && !data?.results?.length ? (
                <div className="empty-card text-sm text-muted-foreground">No matching student, faculty, or subject found.</div>
              ) : null}
              {!query.trim() && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Start typing to search students, faculty, or subjects.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
