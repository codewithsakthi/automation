/**
 * AIStudentCoach.tsx
 * ──────────────────
 * Per-student AI coaching panel powered by Phi-4 Mini.
 * Can be embedded in StudentProfile360, Risk Registry rows, etc.
 *
 * Features:
 *  • "🧠 AI Coach" trigger button (compact or expanded mode)
 *  • Sliding panel with streaming narrative from /api/v1/ai/student-summary/:rollNo
 *  • Placement coaching tab from /api/v1/ai/placement-coach/:rollNo
 *  • Copy to clipboard
 *  • Elegant glassmorphism card design
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Bot,
  BookOpen,
  BriefcaseBusiness,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIStudentCoachProps {
  rollNo: string;
  studentName?: string;
  compact?: boolean; // If true, show only the trigger button; panel opens as overlay
}

type CoachMode = 'narrative' | 'placement';

// ─── SSE helper ──────────────────────────────────────────────────────────────

async function streamEndpoint(
  url: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<() => void> {
  const token = useAuthStore.getState().token || '';
  // api.defaults.baseURL is e.g. "https://host/api/v1"
  // Our AI routes live at /api/v1/ai/... so strip trailing /api/v1 to get host
  const baseUrl = ((api.defaults?.baseURL as string) || '').replace(/\/api\/v1$/, '');
  const controller = new AbortController();

  (async () => {
    try {
      const resp = await fetch(`${baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!resp.ok) {
        onError(`HTTP ${resp.status}: ${resp.statusText}`);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { onError('No readable stream'); return; }
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) onChunk(parsed.text);
            if (parsed.error) onError(parsed.error);
          } catch { /* ignore */ }
        }
      }
      onDone();
    } catch (err: any) {
      if (err?.name !== 'AbortError') onError(err.message ?? 'Stream error');
    }
  })();

  return () => controller.abort();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIStudentCoach({
  rollNo,
  studentName,
  compact = false,
}: AIStudentCoachProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CoachMode>('narrative');
  const [narrativeText, setNarrativeText] = useState('');
  const [placementText, setPlacementText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const currentText = mode === 'narrative' ? narrativeText : placementText;

  const load = useCallback(
    async (targetMode: CoachMode) => {
      const alreadyLoaded =
        targetMode === 'narrative' ? !!narrativeText : !!placementText;
      if (alreadyLoaded || isStreaming) return;

      const endpoint =
        targetMode === 'narrative'
          ? `/ai/student-summary/${rollNo}`
          : `/ai/placement-coach/${rollNo}`;

      setIsStreaming(true);

      abortRef.current = await streamEndpoint(
        endpoint,
        (chunk) => {
          if (targetMode === 'narrative') {
            setNarrativeText((t) => t + chunk);
          } else {
            setPlacementText((t) => t + chunk);
          }
        },
        () => setIsStreaming(false),
        (err) => {
          const msg = `\n⚠️ ${err}`;
          if (targetMode === 'narrative') setNarrativeText((t) => t + msg);
          else setPlacementText((t) => t + msg);
          setIsStreaming(false);
        }
      );
    },
    [rollNo, narrativeText, placementText, isStreaming]
  );

  const handleOpen = () => {
    setOpen(true);
    load('narrative');
  };

  const handleModeSwitch = (m: CoachMode) => {
    setMode(m);
    load(m);
  };

  const handleCopy = async () => {
    if (!currentText) return;
    await navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    abortRef.current?.();
    setIsStreaming(false);
    setOpen(false);
  };

  // ── Trigger Button ──────────────────────────────────────────────────────────
  const triggerBtn = (
    <button
      type="button"
      onClick={handleOpen}
      className={`
        inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all border
        ${compact
          ? 'text-[11px] px-2 py-1 bg-violet-500/8 border-violet-500/20 text-violet-400 hover:bg-violet-500/15'
          : 'text-xs px-3 py-1.5 bg-violet-500/10 border-violet-500/25 text-violet-400 hover:bg-violet-500/20 hover:shadow-md hover:shadow-violet-500/5'
        }
      `}
    >
      <Bot size={compact ? 11 : 13} />
      AI Coach
      {compact ? <ChevronDown size={10} /> : <Sparkles size={11} />}
    </button>
  );

  // ── Panel ───────────────────────────────────────────────────────────────────
  const panel = open && (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-violet-500/20 bg-card/95 backdrop-blur-xl shadow-2xl shadow-violet-500/10 overflow-hidden">
        {/* Ambient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-sky-500/5 pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 border border-violet-500/20 flex items-center justify-center">
              <Bot size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {studentName ? `${studentName.split(' ')[0]}'s AI Coach` : 'AI Student Coach'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-400/60">DeepSeek-V3</span>
                <span className="text-[10px] text-muted-foreground">· {rollNo}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy to clipboard"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            >
              {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative flex border-b border-border/30 px-5 gap-1 pt-2">
          {[
            { id: 'narrative' as CoachMode, label: 'Academic Narrative', icon: BookOpen },
            { id: 'placement' as CoachMode, label: 'Placement Coach', icon: BriefcaseBusiness },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleModeSwitch(id)}
              className={`
                flex items-center gap-1.5 pb-2 px-1 text-xs font-semibold border-b-2 transition-all
                ${mode === id
                  ? 'border-violet-400 text-violet-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="relative px-5 py-4 max-h-80 overflow-y-auto">
          {!currentText && isStreaming && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin text-violet-400" />
              <span>DeepSeek-V3 is analysing {studentName?.split(' ')[0] ?? 'student'}'s profile...</span>
            </div>
          )}

          {currentText ? (
            <div className="text-sm leading-7 text-foreground whitespace-pre-wrap">
              {currentText}
              {isStreaming && (
                <span className="inline-block w-1 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-full align-middle" />
              )}
            </div>
          ) : !isStreaming ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Sparkles size={20} className="text-violet-400" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Could not generate AI insights. Make sure the AI API is reachable.
              </p>
              <button
                type="button"
                onClick={() => load(mode)}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium"
              >
                Try again →
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {isStreaming && (
          <div className="relative border-t border-border/30 px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Streaming from DeepSeek-V3...
            </div>
            <button
              type="button"
              onClick={() => { abortRef.current?.(); setIsStreaming(false); }}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <>
        {triggerBtn}
        {panel}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        triggerBtn
      ) : (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
          {/* Inline expanded view */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-violet-500/15">
            <div className="flex items-center gap-1.5">
              <Bot size={13} className="text-violet-400" />
              <span className="text-xs font-bold text-violet-400">AI Coach</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={handleCopy} className="p-1 rounded text-muted-foreground hover:text-foreground">
                {copied ? <CheckCheck size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
              </button>
              <button type="button" onClick={handleClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
                <ChevronUp size={14} />
              </button>
            </div>
          </div>

          {/* Tabs inline */}
          <div className="flex gap-1 px-3 pt-2">
            {[
              { id: 'narrative' as CoachMode, label: 'Narrative' },
              { id: 'placement' as CoachMode, label: 'Placement' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleModeSwitch(id)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-all ${
                  mode === id ? 'bg-violet-500/15 text-violet-400' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="px-3 py-2 max-h-48 overflow-y-auto">
            {!currentText && isStreaming && (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin text-violet-400" />
                Analysing...
              </div>
            )}
            {currentText && (
              <p className="text-xs leading-6 text-foreground whitespace-pre-wrap">
                {currentText}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse rounded-full align-middle" />
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
