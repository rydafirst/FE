'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useRequireAuth } from '@/lib/useAuth';
import { getToken } from '@/lib/session';
import { api, type SupportThread, type SupportMessage } from '@/lib/api';
import { botStep, scriptLength, CATEGORY_LABELS, type SupportCategory } from '@/lib/supportBot';

// Live countdown from now to the 30-minute agent-join deadline (epoch ms).
function useCountdown(deadline?: number): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const ms = deadline - Date.now();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SupportThreadPage() {
  const { ready } = useRequireAuth();
  const id = String(useParams().id);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [threads, msgs] = await Promise.all([
        api.mySupportThreads(getToken()),
        api.supportMessages(getToken(), id),
      ]);
      setThread(threads.find((t) => t.id === id) ?? null);
      setMessages(msgs);
      setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [id]);

  // Poll every 3s so agent replies + status changes stream in. Resumable: reads the live thread.
  useEffect(() => {
    if (!ready) return;
    void load();
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [ready, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const status = thread?.status;
  // Hook must run every render (before the `!ready` early return) — only counts down while waiting.
  const countdown = useCountdown(status === 'AWAITING_AGENT' ? thread?.agentJoinDeadline : undefined);

  if (!ready) return null;

  const category = thread?.category as SupportCategory | undefined;
  // While the bot is running, the step the user must answer = number of USER messages so far.
  const userCount = messages.filter((m) => m.sender === 'USER').length;
  const step = category && status === 'BOT' ? botStep(category, userCount) : undefined;
  const showChoices = status === 'BOT' && step?.kind === 'choice' && step.options;
  const canFreeText = status === 'BOT'
    ? step?.kind === 'freetext'
    : status === 'AWAITING_AGENT' || status === 'AGENT_JOINED';

  // Bot steps are progressed via /answer; once escalated, free chat goes via /messages.
  const submit = async (text: string) => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      if (status === 'BOT') {
        const r = await api.answerSupport(getToken(), id, body);
        setThread(r.thread);
        setMessages((p) => [...p, ...r.messages]);
      } else {
        const m = await api.postSupportMessage(getToken(), id, body);
        setMessages((p) => [...p, m]);
      }
      setDraft('');
      setErr(null);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <main style={{ padding: 20, paddingBottom: 40, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={() => (location.href = '/support')} aria-label="Back to support"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-heading)', lineHeight: 1, color: 'var(--ink)', padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 'var(--text-subtitle)' }}>Support</b>
          {category && (
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', letterSpacing: '.04em' }}>
              {CATEGORY_LABELS[category].toUpperCase()}{thread?.jobId ? ` · TRIP ${thread.jobId.slice(0, 8)}` : ''}
            </div>
          )}
        </div>
        <StatusPill status={status} />
      </div>

      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {/* Status banner: 30-minute agent-wait countdown / joined / resolved */}
      {status === 'AWAITING_AGENT' && (
        <div className="rf-card" style={{ marginBottom: 12, borderColor: 'var(--warning)', background: 'var(--bg)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--warning)', letterSpacing: '.06em', marginBottom: 4 }}>WAITING FOR AN AGENT</div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.45 }}>
            A support agent will join {countdown ? <>within about <b className="mono">{countdown}</b></> : 'shortly'}. You can add more detail below while you wait — this conversation is saved, so you can leave and come back.
          </div>
        </div>
      )}
      {status === 'AGENT_JOINED' && (
        <div className="rf-card" style={{ marginBottom: 12, borderColor: 'var(--success)', background: 'var(--bg)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--success)', letterSpacing: '.06em', marginBottom: 4 }}>AGENT JOINED</div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>You’re now chatting with a member of our support team.</div>
        </div>
      )}
      {status === 'RESOLVED' && (
        <div className="rf-card" style={{ marginBottom: 12, background: 'var(--bg-2)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 4 }}>RESOLVED</div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>This conversation has been marked resolved. Start a new one from the support page if you need more help.</div>
        </div>
      )}

      {/* Conversation */}
      <div className="rf-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
          {messages.length === 0 && <div style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', textAlign: 'center', padding: '16px 0' }}>Starting the conversation…</div>}
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
          <div ref={endRef} />
        </div>
      </div>

      {/* Bot tap-choices */}
      {showChoices && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {step!.options!.map((opt) => (
            <button key={opt} type="button" disabled={busy} onClick={() => submit(opt)} className="rf-chip"
              style={{ cursor: busy ? 'default' : 'pointer', flex: '1 1 46%' }}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Free-text box */}
      {canFreeText && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="rf-input" style={{ flex: 1 }} value={draft} disabled={busy}
            placeholder={status === 'BOT' ? 'Describe your issue…' : 'Type a message…'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(draft); }} />
          <Button onClick={() => void submit(draft)} disabled={busy}>Send</Button>
        </div>
      )}

      {status === 'BOT' && step === undefined && (
        <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', textAlign: 'center' }}>
          Connecting you to an agent…
        </p>
      )}

      {category && status === 'BOT' && (
        <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', textAlign: 'center', marginTop: 10 }}>
          STEP {Math.min(userCount + 1, scriptLength(category))} OF {scriptLength(category)}
        </p>
      )}
    </main>
  );
}

function StatusPill({ status }: { status?: string }) {
  const map: Record<string, { text: string; color: string }> = {
    BOT: { text: 'Assistant', color: 'var(--info)' },
    AWAITING_AGENT: { text: 'Waiting', color: 'var(--warning)' },
    AGENT_JOINED: { text: 'Agent', color: 'var(--success)' },
    RESOLVED: { text: 'Resolved', color: 'var(--mid)' },
  };
  const s = status ? map[status] : undefined;
  if (!s) return null;
  return <span className="rf-pill" style={{ background: s.color, color: 'var(--on-dark)' }}>{s.text.toUpperCase()}</span>;
}

function Bubble({ m }: { m: SupportMessage }) {
  const mine = m.sender === 'USER';
  const isAgent = m.sender === 'AGENT';
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
      {!mine && (
        <div className="mono" style={{ fontSize: 'var(--text-caption)', color: isAgent ? 'var(--success)' : 'var(--mid)', letterSpacing: '.04em', marginBottom: 2 }}>
          {isAgent ? 'AGENT' : 'ASSISTANT'}
        </div>
      )}
      <div style={{
        background: mine ? 'var(--ink)' : isAgent ? 'var(--primary-soft)' : 'var(--bg-2)',
        color: mine ? 'var(--on-dark)' : 'var(--ink)',
        border: mine ? 'none' : '1px solid var(--line)',
        borderRadius: 12, padding: '8px 12px', fontSize: 'var(--text-body)', lineHeight: 1.45, whiteSpace: 'pre-wrap',
      }}>
        {m.body}
      </div>
    </div>
  );
}
