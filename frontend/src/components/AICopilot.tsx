import React, { useMemo, useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import type { AdminCommandCenterResponse, SubjectLeaderboardResponse, FacultyImpactMatrixItem } from '../types/enterprise';

interface AICopilotProps {
  data?: AdminCommandCenterResponse | null;
  leaderboard?: SubjectLeaderboardResponse | null;
}

const formatPct = (value?: number) => `${Math.round(value ?? 0)}%`;
const formatNum = (value?: number) => (value ?? 0).toLocaleString();

function pickHardestSubject(data?: AdminCommandCenterResponse | null) {
  if (!data?.bottlenecks?.length) return null;
  const sorted = [...data.bottlenecks].sort((a, b) => (b.failure_rate ?? 0) - (a.failure_rate ?? 0));
  return sorted[0];
}

function pickFacultyImpact(data?: AdminCommandCenterResponse | null): FacultyImpactMatrixItem | null {
  if (!data?.faculty_impact?.length) return null;
  const sorted = [...data.faculty_impact].sort((a, b) => (b.cohort_delta ?? 0) - (a.cohort_delta ?? 0));
  return sorted[0];
}

function pickLeaderboardTop(leaderboard?: SubjectLeaderboardResponse | null) {
  return leaderboard?.top_leaderboard?.[0] ?? null;
}

function buildBriefing(data?: AdminCommandCenterResponse | null, leaderboard?: SubjectLeaderboardResponse | null) {
  if (!data) {
    return 'No live telemetry yet. Once the dashboard data loads, I will assemble a briefing with risk, faculty, and leaderboard highlights.';
  }

  const health = data.department_health;
  const risk = data.risk_summary;
  const placement = data.placement_summary;
  const hardest = pickHardestSubject(data);
  const faculty = pickFacultyImpact(data);
  const topLeader = pickLeaderboardTop(leaderboard);

  const parts: string[] = [];

  parts.push(
    `Health: ${formatPct(health?.overall_health_score)} overall, ${formatNum(health?.active_students)} active students, ${formatNum(health?.at_risk_count)} flagged at risk. Avg GPA ${health?.average_gpa ?? 0} | Avg attendance ${formatPct(health?.average_attendance)}.`
  );

  if (risk) {
    parts.push(`Risk mix: ${risk.critical} critical, ${risk.high} high, ${risk.moderate} moderate, ${risk.low} low out of ${risk.total}.`);
  }

  if (placement) {
    parts.push(`Placement: ${placement.ready_count} ready, ${placement.almost_ready_count} warming, ${placement.blocked_count} blocked. Avg coding ${placement.avg_coding_score ?? 0}/100.`);
  }

  if (hardest) {
    parts.push(
      `Bottleneck: ${hardest.subject_name || hardest.subject_code} running ${formatPct(hardest.failure_rate)} fail rate vs history ${formatPct(hardest.historical_five_year_average)}.`
    );
  }

  if (faculty) {
    parts.push(
      `Faculty lift: ${faculty.faculty_name} on ${faculty.subject_name} with cohort delta ${faculty.cohort_delta >= 0 ? '+' : ''}${faculty.cohort_delta.toFixed(1)} and fail rate ${formatPct(faculty.failure_rate)}.`
    );
  }

  if (topLeader) {
    parts.push(
      `Leaderboard: ${topLeader.student_name?.split(' ')[0] || topLeader.roll_no} leads ${topLeader.subject_code} with ${topLeader.total_marks ?? topLeader.internal_marks ?? '—'} marks.`
    );
  }

  if (data.action_queue?.length) {
    parts.push(`Actions: ${data.action_queue.slice(0, 2).map((a) => a.title).join('; ')}.`);
  }

  return parts.join(' ');
}

function answerQuestion(
  question: string,
  data?: AdminCommandCenterResponse | null,
  leaderboard?: SubjectLeaderboardResponse | null
) {
  const q = question.toLowerCase();
  if (!data) return 'Data is still loading. I will answer once the dashboard refreshes.';

  if (q.includes('risk') || q.includes('critical')) {
    const r = data.risk_summary;
    return `Risk posture: ${r?.critical} critical, ${r?.high} high, ${r?.moderate} moderate, ${r?.low} low. Largest bottleneck: ${
      pickHardestSubject(data)?.subject_name || 'not yet ranked'
    }.`;
  }

  if (q.includes('faculty') || q.includes('impact')) {
    const f = pickFacultyImpact(data);
    return f
      ? `${f.faculty_name} shows strongest impact on ${f.subject_name} (delta ${f.cohort_delta >= 0 ? '+' : ''}${f.cohort_delta.toFixed(
          1
        )}, fail rate ${formatPct(f.failure_rate)}).`
      : 'No faculty impact signals available yet.';
  }

  if (q.includes('leaderboard') || q.includes('top') || q.includes('rank')) {
    const t = pickLeaderboardTop(leaderboard);
    return t
      ? `${t.student_name} leads ${t.subject_code} with ${t.total_marks ?? t.internal_marks ?? '—'} marks.`
      : 'Leaderboard data not loaded yet.';
  }

  if (q.includes('placement')) {
    const p = data.placement_summary;
    return p
      ? `Placement funnel: ${p.ready_count} ready, ${p.almost_ready_count} almost ready, ${p.blocked_count} blocked. Avg coding score ${p.avg_coding_score}/100.`
      : 'Placement signals not available.';
  }

  return buildBriefing(data, leaderboard);
}

export default function AICopilot({ data, leaderboard }: AICopilotProps) {
  const [briefing, setBriefing] = useState(() => buildBriefing(data, leaderboard));
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const autoBriefing = useMemo(() => buildBriefing(data, leaderboard), [data, leaderboard]);

  const handleRefresh = () => {
    setBriefing(autoBriefing);
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setIsThinking(true);
    setTimeout(() => {
      setAnswer(answerQuestion(question, data, leaderboard));
      setIsThinking(false);
    }, 180); // tiny delay for perceived responsiveness
  };

  return (
    <section className="panel relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-foreground/5 to-primary/5 opacity-40 pointer-events-none" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">AI Co-Pilot</p>
              <p className="text-xs text-muted-foreground">Summaries + quick answers from current telemetry.</p>
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:text-primary/80"
            onClick={handleRefresh}
          >
            Refresh brief
          </button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-inner">
          <p className="text-sm leading-6 text-foreground whitespace-pre-wrap">{briefing}</p>
        </div>

        <form onSubmit={handleAsk} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="ai-question">
            Ask a question
          </label>
          <input
            id="ai-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about risk, faculty impact, placement, or leaderboard..."
            className="flex-1 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            {isThinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isThinking ? 'Thinking...' : 'Ask'}
          </button>
        </form>

        {answer && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
            {answer}
          </div>
        )}
      </div>
    </section>
  );
}
