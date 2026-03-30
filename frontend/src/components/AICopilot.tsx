import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import type {
  AdminCommandCenterResponse,
  AdminLeaderboardSnapshot,
  PlacementCandidate,
  SubjectLeaderboardResponse,
} from '../types/enterprise';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AICopilotProps {
  data?: AdminCommandCenterResponse | null;
  leaderboard?: SubjectLeaderboardResponse | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

type ModelStatus = 'idle' | 'checking' | 'online' | 'offline';

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContextString(
  data?: AdminCommandCenterResponse | null,
  leaderboard?: SubjectLeaderboardResponse | null
): string {
  if (!data) return 'No live dashboard data loaded yet.';

  const health = data.department_health;
  const risk = data.risk_summary;
  const placement = data.placement_summary;
  const bottlenecks = data.bottlenecks ?? [];
  const faculty = data.faculty_impact ?? [];
  const parts: string[] = [];

  // ── Aggregates ────────────────────────────────────────────────────────────
  if (health) {
    parts.push(
      `DEPT_HEALTH: overall=${health.overall_health_score?.toFixed(1)}%, ` +
      `active_students=${health.active_students}, at_risk=${health.at_risk_count}, ` +
      `avg_gpa=${health.average_gpa}, avg_attendance=${health.average_attendance?.toFixed(1)}%`
    );
    if (health.daily_briefing) {
      parts.push(`DAILY_BRIEFING: ${health.daily_briefing}`);
    }
  }

  if (risk) {
    parts.push(
      `RISK_SUMMARY: critical=${risk.critical}, high=${risk.high}, ` +
      `moderate=${risk.moderate}, low=${risk.low}, total=${risk.total}`
    );
  }

  if (placement) {
    parts.push(
      `PLACEMENT_SUMMARY: ready=${placement.ready_count}, ` +
      `almost_ready=${placement.almost_ready_count}, blocked=${placement.blocked_count}, ` +
      `avg_coding=${placement.avg_coding_score}/100`
    );
  }

  // ── Individual students — top performers (names + GPA) ────────────────────
  const topPerformers: any[] = data.top_performers ?? [];
  if (topPerformers.length) {
    const top5 = topPerformers.slice(0, 8);
    parts.push(
      'TOP_PERFORMERS:\n' +
      top5.map((s: any, i: number) =>
        `  ${i + 1}. ${s.name || s.student_name || s.roll_no} (Roll: ${s.roll_no}) ` +
        `GPA=${s.average_grade_points ?? s.gpa ?? s.overall_gpa ?? '?'}, ` +
        `Attendance=${s.attendance_percentage ?? '?'}%, ` +
        `Batch=${s.batch ?? '?'}`
      ).join('\n')
    );
  }

  // ── Placement-ready candidates (names + CGPA + coding) ────────────────────
  const placementReady: PlacementCandidate[] = data.placement_ready ?? [];
  if (placementReady.length) {
    const top5 = placementReady.slice(0, 6);
    parts.push(
      'PLACEMENT_READY_STUDENTS:\n' +
      top5.map((s, i) =>
        `  ${i + 1}. ${s.student_name} (${s.roll_no}) ` +
        `CGPA=${s.cgpa}, Coding=${s.coding_subject_score}/100, ` +
        `Attendance=${s.attendance_percentage?.toFixed(1)}%, Arrears=${s.active_arrears}`
      ).join('\n')
    );
  }

  // ── At-risk / watchlist students (names + risk level) ────────────────────
  const watchlist = data.watchlist_students ?? [];
  if (watchlist.length) {
    const critical = watchlist.filter((s: any) => s.risk_level === 'Critical').slice(0, 5);
    const high = watchlist.filter((s: any) => s.risk_level === 'High').slice(0, 4);
    const combined = [...critical, ...high];
    if (combined.length) {
      parts.push(
        'AT_RISK_STUDENTS:\n' +
        combined.map((s: any) =>
          `  - ${s.name} (${s.roll_no}) Level=${s.risk_level}, ` +
          `RiskScore=${s.risk_score?.toFixed(2) ?? '?'}, ` +
          `Alerts=${(s.alerts ?? []).slice(0, 2).join('; ')}`
        ).join('\n')
      );
    }
  }

  // ── Attendance defaulters ─────────────────────────────────────────────────
  const defauters: any[] = data.attendance_defaulters ?? [];
  if (defauters.length) {
    parts.push(
      'ATTENDANCE_DEFAULTERS:\n' +
      defauters.slice(0, 5).map((s: any) =>
        `  - ${s.name || s.student_name || s.roll_no} (${s.roll_no}) ` +
        `Attendance=${s.attendance_percentage ?? '?'}%`
      ).join('\n')
    );
  }

  // ── Opportunity / borderline students ────────────────────────────────────
  const opportunity: any[] = data.opportunity_students ?? [];
  if (opportunity.length) {
    parts.push(
      'OPPORTUNITY_STUDENTS (close to improvement threshold):\n' +
      opportunity.slice(0, 5).map((s: any) =>
        `  - ${s.name || s.student_name || s.roll_no} (${s.roll_no}) ` +
        `GPA=${s.average_grade_points ?? s.gpa ?? '?'}`
      ).join('\n')
    );
  }

  // ── Subject bottlenecks ───────────────────────────────────────────────────
  const topBnecks = [...bottlenecks]
    .sort((a, b) => (b.failure_rate ?? 0) - (a.failure_rate ?? 0))
    .slice(0, 4);
  if (topBnecks.length) {
    parts.push(
      'SUBJECT_BOTTLENECKS:\n' +
      topBnecks.map(b =>
        `  - ${b.subject_name || b.subject_code} (${b.subject_code}): ` +
        `fail_rate=${b.failure_rate?.toFixed(1)}%, ` +
        `avg_marks=${b.current_average_marks?.toFixed(1)}, ` +
        `historical_avg=${b.historical_five_year_average?.toFixed(1)}`
      ).join('\n')
    );
  }

  // ── Faculty impact ────────────────────────────────────────────────────────
  const topFaculty = [...faculty]
    .sort((a, b) => Math.abs(b.cohort_delta ?? 0) - Math.abs(a.cohort_delta ?? 0))
    .slice(0, 3);
  if (topFaculty.length) {
    parts.push(
      'FACULTY_IMPACT:\n' +
      topFaculty.map(f =>
        `  - ${f.faculty_name} → ${f.subject_name} (${f.subject_code}): ` +
        `delta=${f.cohort_delta >= 0 ? '+' : ''}${f.cohort_delta?.toFixed(1)}, ` +
        `fail_rate=${f.failure_rate?.toFixed(1)}%, students=${f.student_count}`
      ).join('\n')
    );
  }

  // ── Leaderboard (subject-level top students) ──────────────────────────────
  const leaderSnaps: AdminLeaderboardSnapshot[] = data.leaderboard_snapshots ?? [];
  if (leaderSnaps.length) {
    parts.push(
      'LEADERBOARD_SNAPSHOTS:\n' +
      leaderSnaps.slice(0, 4).map(l =>
        `  - ${l.subject_name || l.subject_code}: ` +
        `top_score=${l.top_score}, median=${l.median_score}, spread=${l.score_spread}`
      ).join('\n')
    );
  }

  // Detailed leaderboard with individual names if provided
  if (leaderboard?.top_leaderboard?.length) {
    const topStudents = leaderboard.top_leaderboard.slice(0, 5);
    parts.push(
      `LEADERBOARD_${leaderboard.subject_code}_TOP_STUDENTS:\n` +
      topStudents.map((s, i) =>
        `  ${i + 1}. ${s.student_name} (${s.roll_no}): ` +
        `marks=${s.total_marks ?? s.internal_marks ?? '?'}, ` +
        `grade=${s.grade ?? '?'}, percentile=${s.percentile?.toFixed(0)}%`
      ).join('\n')
    );
  }

  // ── Action queue ──────────────────────────────────────────────────────────
  const actions = data.action_queue ?? [];
  if (actions.length) {
    parts.push(
      'PENDING_ACTIONS:\n' +
      actions.slice(0, 4).map(a => `  [${a.tone.toUpperCase()}] ${a.title}: ${a.detail}`).join('\n')
    );
  }

  return parts.join('\n\n');
}

// ─── Quick Action Chips ───────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: '🔥 Summarise risks', query: 'Give me a summary of the most urgent academic risks right now.' },
  { label: '📉 Bottleneck alert', query: 'Which subjects have the highest failure rates and what should we do?' },
  { label: '🎯 Placement gaps', query: 'Identify the biggest gaps in placement readiness and suggest immediate actions.' },
  { label: '⭐ Faculty wins', query: 'Which faculty members are having the most positive impact on student performance?' },
];

// ─── SSE Streaming ───────────────────────────────────────────────────────────

async function streamCopilotAsk(
  question: string,
  dashboardContext: string,
  chatHistory: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
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
          dashboard_context: dashboardContext,
          chat_history: chatHistory.slice(-6),
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        onError(`Server error ${resp.status}: ${resp.statusText}`);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { onError('No response stream'); return; }
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) onChunk(parsed.text);
            if (parsed.error) onError(parsed.error);
          } catch { /* ignore malformed */ }
        }
      }
      onDone();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      onError(err.message ?? 'Stream failed');
    }
  })();

  return () => controller.abort();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AICopilot({ data, leaderboard }: AICopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [execBriefing, setExecBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const abortRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const dashboardContext = useMemo(() => buildContextString(data, leaderboard), [data, leaderboard]);

  // Scroll to bottom on new message unless user has scrolled up
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Check model availability once
  useEffect(() => {
    const check = async () => {
      setModelStatus('checking');
      try {
        const resp = await api.get('/ai/health');
        setModelStatus(resp.data?.status === 'ok' ? 'online' : 'offline');
      } catch {
        setModelStatus('offline');
      }
    };
    check();
  }, []);

  // Auto executive briefing when data loads
  useEffect(() => {
    if (!data || execBriefing || briefingLoading) return;
    const timer = setTimeout(async () => {
      setBriefingLoading(true);
      try {
        const resp = await api.post('/ai/executive-briefing', {
          dashboard_data: data,
          leaderboard_data: leaderboard,
        });
        setExecBriefing(resp.data?.briefing ?? null);
      } catch {
        // Graceful — no briefing if AI offline
      } finally {
        setBriefingLoading(false);
      }
    }, 1200); // slight delay so dashboard renders first
    return () => clearTimeout(timer);
  }, [data]);

  const handleSend = useCallback(async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || isStreaming) return;

    setQuestion('');
    setIsStreaming(true);
    setAutoScroll(true);

    const userMsg: ChatMessage = { role: 'user', content: text };
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    abortRef.current = await streamCopilotAsk(
      text,
      dashboardContext,
      history,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      () => {
        setIsStreaming(false);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, streaming: false };
          }
          return updated;
        });
      },
      (err) => {
        setIsStreaming(false);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: `⚠️ ${err}`,
              streaming: false,
            };
          }
          return updated;
        });
      }
    );
  }, [question, isStreaming, messages, dashboardContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && isStreaming) {
      abortRef.current?.();
      setIsStreaming(false);
    }
  };

  const handleRefreshBriefing = async () => {
    if (!data || briefingLoading) return;
    setBriefingLoading(true);
    setExecBriefing(null);
    try {
      const resp = await api.post('/api/v1/ai/executive-briefing', {
        dashboard_data: data,
        leaderboard_data: leaderboard,
      });
      setExecBriefing(resp.data?.briefing ?? null);
    } catch { /* silent */ }
    finally { setBriefingLoading(false); }
  };

  const handleChatScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    setAutoScroll(distanceFromBottom < 40);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const statusIcon =
    modelStatus === 'checking' ? <Loader2 size={12} className="animate-spin" /> :
    modelStatus === 'online'   ? <Wifi size={12} className="text-emerald-400" /> :
    modelStatus === 'offline'  ? <WifiOff size={12} className="text-rose-400" /> :
                                 <Zap size={12} className="text-muted-foreground" />;

  return (
    <section className="panel relative overflow-hidden flex flex-col gap-0 p-0">
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-sky-500/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="rounded-xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 p-2 text-violet-400 border border-violet-500/20">
              <Bot size={18} />
            </div>
            {modelStatus === 'online' && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-card animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground leading-none">SPARK AI Co-Pilot</p>
              <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                DeepSeek-V3
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {statusIcon}
              <p className="text-[11px] text-muted-foreground">
                {modelStatus === 'checking' ? 'Connecting...' :
                 modelStatus === 'online'   ? 'Model online' :
                 modelStatus === 'offline'  ? 'Model offline — start Ollama' :
                 'AI assistant'}
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefreshBriefing}
          disabled={briefingLoading || !data}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
          title="Refresh AI briefing"
        >
          <RefreshCw size={12} className={briefingLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Executive Briefing */}
      {(execBriefing || briefingLoading) && (
        <div className="relative mx-4 mt-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={13} className="text-violet-400" />
            <span className="text-[11px] font-black uppercase tracking-widest text-violet-400">
              Executive Briefing
            </span>
          </div>
          {briefingLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin text-violet-400" />
              <span>Generating executive briefing...</span>
            </div>
          ) : (
            <p className="text-sm leading-6 text-foreground whitespace-pre-wrap">{execBriefing}</p>
          )}
        </div>
      )}

      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="px-4 mt-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Quick actions
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={() => handleSend(qa.query)}
                disabled={isStreaming}
                className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-violet-400 transition-all disabled:opacity-40"
              >
                {qa.label}
                <ChevronRight size={11} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat history */}
      {messages.length > 0 && (
        <div
          ref={chatRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto px-4 mt-3 space-y-3 max-h-64"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                  <Bot size={12} className="text-violet-400" />
                </div>
              )}
              <div
                className={`
                  max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 relative
                  ${msg.role === 'user'
                    ? 'bg-primary/10 border border-primary/30 text-foreground rounded-tr-sm'
                    : 'bg-muted/40 border border-border/50 text-foreground rounded-tl-sm'
                  }
                `}
              >
                <span className="whitespace-pre-wrap">{msg.content}</span>
                {msg.streaming && (
                  <span className="inline-block w-1 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-full align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 mt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/30 pl-3 pr-1.5 py-1.5 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Press Esc to stop...' : 'Ask about risk, faculty, placement, leaderboard...'}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => isStreaming ? abortRef.current?.() : handleSend()}
            className={`
              inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all
              ${isStreaming
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-40'
              }
            `}
            disabled={!isStreaming && !question.trim()}
          >
            {isStreaming ? (
              <>
                <span className="w-2 h-2 rounded-sm bg-rose-400" />
                Stop
              </>
            ) : (
              <>
                <Send size={12} />
                Ask
              </>
            )}
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-[10px] text-muted-foreground hover:text-foreground mt-1.5 ml-0.5 transition-colors"
          >
            Clear conversation
          </button>
        )}
      </div>
    </section>
  );
}
