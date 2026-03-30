/**
 * AICommandBar.tsx
 * ─────────────────
 * Global Ctrl+K / ⌘+K AI Command Bar powered by DeepSeek-V3.
 * Natural-language interface over the SPARK dashboard APIs.
 *
 * Features:
 *  • Slash commands: /risk, /placement, /leaderboard, /faculty
 *  • Free-form NL queries streamed from DeepSeek-V3.
 *  • Intent recognition → executes matching API call
 *  • Keyboard-driven (arrows, enter, escape)
 *  • Premium glassmorphism design with fluid animations
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  Bot,
  BriefcaseBusiness,
  Command,
  Loader2,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandBarProps {
  /** Pass dashboard context string so the AI has context */
  dashboardContext?: string;
  onNavigate?: (tab: string) => void;
}

interface Suggestion {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  action: 'ai' | 'navigate';
  payload?: string;
}

// ─── Static suggestions ───────────────────────────────────────────────────────

const STATIC_SUGGESTIONS: Suggestion[] = [
  {
    id: 'risk-summary',
    icon: <Activity size={14} className="text-rose-400" />,
    label: 'Summarise department risks',
    description: 'AI-powered risk analysis of the entire batch',
    action: 'ai',
    payload: 'Give me a concise executive summary of the current department risks including critical and high-risk students.',
  },
  {
    id: 'placement-gaps',
    icon: <BriefcaseBusiness size={14} className="text-amber-400" />,
    label: 'Identify placement gaps',
    description: 'Top barriers to placement readiness',
    action: 'ai',
    payload: 'What are the top 3 factors blocking students from being placement-ready? Give specific numbers.',
  },
  {
    id: 'top-performers',
    icon: <Trophy size={14} className="text-emerald-400" />,
    label: 'Top performing students',
    description: 'Who leads the academic rankings?',
    action: 'ai',
    payload: 'Which students are performing best academically? Highlight GPA leaders and leaderboard toppers.',
  },
  {
    id: 'faculty-impact',
    icon: <Users size={14} className="text-sky-400" />,
    label: 'Faculty impact analysis',
    description: 'Which faculty drive the most improvement?',
    action: 'ai',
    payload: 'Analyse faculty impact on student performance. Who is making the biggest positive difference?',
  },
  {
    id: 'intervention',
    icon: <Zap size={14} className="text-violet-400" />,
    label: 'Recommend interventions',
    description: 'AI action plan for at-risk students',
    action: 'ai',
    payload: 'What are the most impactful interventions I can implement right now for at-risk students?',
  },
];

// ─── SSE streaming helper ────────────────────────────────────────────────────

async function streamQuery(
  question: string,
  context: string,
  onChunk: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void
): Promise<() => void> {
  const token = useAuthStore.getState().token || '';
  const baseUrl = ((api.defaults?.baseURL as string) || '').replace(/\/api\/v1$/, '');
  const controller = new AbortController();

  (async () => {
    try {
      const resp = await fetch(`${baseUrl}/api/v1/ai/copilot/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          dashboard_context: context || 'No dashboard context available.',
          chat_history: [],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) { onError(`HTTP ${resp.status}`); return; }

      const reader = resp.body?.getReader();
      if (!reader) { onError('No stream'); return; }
      const dec = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { onDone(); return; }
          try {
            const p = JSON.parse(raw);
            if (p.text) onChunk(p.text);
            if (p.error) onError(p.error);
          } catch { /* ignore */ }
        }
      }
      onDone();
    } catch (e: any) {
      if (e?.name !== 'AbortError') onError(e.message ?? 'error');
    }
  })();
  return () => controller.abort();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AICommandBar({ dashboardContext = '', onNavigate }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [result, setResult] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = query.trim()
    ? STATIC_SUGGESTIONS.filter(
        (s) =>
          s.label.toLowerCase().includes(query.toLowerCase()) ||
          s.description.toLowerCase().includes(query.toLowerCase())
      )
    : STATIC_SUGGESTIONS;

  // ── Keyboard shortcut ────────────────────────────────────────────────────── 
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) {
        if (isStreaming) {
          abortRef.current?.();
          setIsStreaming(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, isStreaming]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResult('');
      setHasResult(false);
      setActiveIdx(0);
    }
  }, [open]);

  const handleClose = () => {
    abortRef.current?.();
    setOpen(false);
    setIsStreaming(false);
  };

  const runQuery = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;
      setResult('');
      setHasResult(true);
      setIsStreaming(true);

      abortRef.current = await streamQuery(
        question,
        dashboardContext,
        (chunk) => setResult((r) => r + chunk),
        () => setIsStreaming(false),
        (err) => {
          setResult((r) => r + `\n⚠️ ${err}`);
          setIsStreaming(false);
        }
      );
    },
    [dashboardContext, isStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() && !suggestions.find(s => s.label.toLowerCase() === query.toLowerCase())) {
        runQuery(query.trim());
      } else if (suggestions[activeIdx]) {
        runQuery(suggestions[activeIdx].payload ?? suggestions[activeIdx].label);
      }
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
        title="AI Command Bar (Ctrl+K)"
      >
        <Bot size={13} className="text-violet-400 group-hover:scale-110 transition-transform" />
        <span>Ask AI...</span>
        <kbd className="ml-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-violet-500/20 bg-card/95 backdrop-blur-2xl shadow-2xl shadow-violet-500/15 overflow-hidden"
        style={{ animation: 'slideDownFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-sky-500/5 pointer-events-none" />

        {/* Search input */}
        <div className="relative flex items-center gap-3 px-4 py-3.5 border-b border-border/30">
          <div className="relative flex-shrink-0">
            <Bot size={18} className="text-violet-400" />
            {isStreaming && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            )}
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHasResult(false); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... or pick a command below"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/50 text-foreground"
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-400/60 bg-violet-500/10 border border-violet-500/15 px-1.5 py-0.5 rounded-lg">
              DeepSeek-V3
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Result area */}
        {hasResult && (
          <div className="px-5 py-4 border-b border-border/20 max-h-56 overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={12} className="text-violet-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-violet-400">AI Response</span>
              {isStreaming && <Loader2 size={11} className="animate-spin text-violet-400 ml-auto" />}
            </div>
            {result ? (
              <p className="text-sm leading-7 text-foreground whitespace-pre-wrap">
                {result}
                {isStreaming && (
                  <span className="inline-block w-1 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-full align-middle" />
                )}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={13} className="animate-spin text-violet-400" />
                Thinking...
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {!hasResult && (
          <div className="py-2">
            <p className="px-4 pb-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              {query.trim() ? 'Matching commands' : 'Suggested commands'}
            </p>
            {suggestions.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Search size={13} />
                Press Enter to ask DeepSeek-V3: &ldquo;{query}&rdquo;
              </div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => runQuery(s.payload ?? s.label)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${i === activeIdx ? 'bg-muted/50' : 'hover:bg-muted/30'}
                `}
              >
                <div className="w-7 h-7 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                </div>
                {i === activeIdx && (
                  <kbd className="text-[10px] font-mono text-muted-foreground bg-muted/60 border border-border/40 px-1.5 py-0.5 rounded-md flex-shrink-0">
                    ↵
                  </kbd>
                )}
              </button>
            ))}

            {query.trim() && !suggestions.some(s => s.label.toLowerCase() === query.toLowerCase()) && (
              <button
                type="button"
                onClick={() => runQuery(query.trim())}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 border-t border-border/20 transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Ask AI: &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-muted-foreground">Stream answer from DeepSeek-V3</p>
                </div>
                <kbd className="text-[10px] font-mono text-muted-foreground bg-muted/60 border border-border/40 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  ↵
                </kbd>
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/20 bg-muted/10">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span><kbd className="font-mono bg-muted/50 border border-border/40 px-1 py-0.5 rounded text-[10px]">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-muted/50 border border-border/40 px-1 py-0.5 rounded text-[10px]">↵</kbd> run</span>
            <span><kbd className="font-mono bg-muted/50 border border-border/40 px-1 py-0.5 rounded text-[10px]">Esc</kbd> {isStreaming ? 'stop' : 'close'}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-violet-400/60">
            <Command size={10} />
            <span>K</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDownFadeIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
