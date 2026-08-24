'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type SupportThread, type SupportMessage } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';
import { CATEGORY_LABELS } from '@/lib/supportBot';

// Wait time since a thread started waiting (uses updatedAt as the queue-entry timestamp).
function waited(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

// True on wide viewports — drives the side-by-side vs. single-pane layout.
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 860px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function AdminSupportPage() {
  const { ready, notAdmin } = useAdminGuard();
  const wide = useWide();
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    api.agentSupportThreads(getToken()).then(setThreads).catch((e) => setErr((e as Error).message));
  }, []);

  // Live queue: refresh every 5s (longest-waiting first, as the backend orders it).
  useEffect(() => {
    if (!ready || notAdmin) return;
    loadQueue();
    const t = setInterval(loadQueue, 5000);
    return () => clearInterval(t);
  }, [ready, notAdmin, loadQueue]);

  if (!ready) return null;
  if (notAdmin) return <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>;

  const showQueue = wide || !selected;
  const showDetail = wide || !!selected;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>Support inbox</h1>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Queue */}
        {showQueue && (
          <div style={{ width: wide ? 320 : '100%', flexShrink: 0 }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>
              OPEN QUEUE{threads ? ` · ${threads.length}` : ''}
            </div>
            {!threads && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
            {threads?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>Queue is clear. Nice.</p>}
            {threads?.map((t) => {
              const active = t.id === selected;
              return (
                <button key={t.id} onClick={() => setSelected(t.id)} className="rf-card"
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', marginBottom: 8, cursor: 'pointer',
                    border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
                    background: active ? 'var(--bg-2)' : 'var(--bg)',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 'var(--text-body)' }}>{CATEGORY_LABELS[t.category]}</b>
                    <span className="rf-pill" style={{ background: t.status === 'AGENT_JOINED' ? 'var(--success)' : 'var(--warning)', color: 'var(--on-dark)', flexShrink: 0 }}>
                      {t.status === 'AGENT_JOINED' ? 'JOINED' : 'WAITING'}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 4 }}>
                    WAITING {waited(t.updatedAt)}{t.jobId ? ` · TRIP ${t.jobId.slice(0, 8)}` : ''}
                  </div>
                  <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 2 }}>
                    USER {t.userId.slice(0, 8)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Detail */}
        {showDetail && (
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            {selected ? (
              <ThreadView key={selected} id={selected} wide={wide} onBack={() => setSelected(null)} onResolved={() => { setSelected(null); loadQueue(); }} onReplied={loadQueue} />
            ) : (
              wide && <div className="rf-card" style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>Select a conversation from the queue to read the history and reply.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadView({ id, wide, onBack, onResolved, onReplied }: {
  id: string; wide: boolean; onBack: () => void; onResolved: () => void; onReplied: () => void;
}) {
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.agentSupportMessages(getToken(), id);
      setThread(r.thread);
      setMessages(r.messages);
      setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [id]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const reply = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const m = await api.agentReply(getToken(), id, body);
      setDraft('');
      setMessages((p) => [...p, m]);
      setThread((t) => (t ? { ...t, status: 'AGENT_JOINED' } : t));
      onReplied();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const resolve = async () => {
    if (busy || !window.confirm('Mark this conversation resolved?')) return;
    setBusy(true);
    try { await api.agentResolve(getToken(), id); onResolved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="rf-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {!wide && (
          <button onClick={onBack} aria-label="Back to queue" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-heading)', lineHeight: 1, color: 'var(--ink)', padding: 0 }}>←</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 'var(--text-subtitle)' }}>{thread ? CATEGORY_LABELS[thread.category] : 'Conversation'}</b>
          {thread && (
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 2 }}>
              USER {thread.userId.slice(0, 8)}{thread.jobId ? ` · TRIP ${thread.jobId.slice(0, 8)}` : ''} · WAITING {waited(thread.updatedAt)}
            </div>
          )}
        </div>
        {thread && thread.status !== 'RESOLVED' && (
          <button onClick={resolve} disabled={busy} className="rf-chip" style={{ cursor: busy ? 'default' : 'pointer', flexShrink: 0 }}>Resolve</button>
        )}
      </div>

      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '52vh', overflowY: 'auto', marginBottom: 12 }}>
        {messages.length === 0 && <div style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', textAlign: 'center', padding: '16px 0' }}>No messages.</div>}
        {messages.map((m) => {
          const isAgent = m.sender === 'AGENT';
          return (
            <div key={m.id} style={{ alignSelf: isAgent ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: m.sender === 'USER' ? 'var(--ink-2)' : isAgent ? 'var(--success)' : 'var(--mid)', letterSpacing: '.04em', marginBottom: 2, textAlign: isAgent ? 'right' : 'left' }}>
                {m.sender}
              </div>
              <div style={{
                background: isAgent ? 'var(--ink)' : m.sender === 'USER' ? 'var(--primary-soft)' : 'var(--bg-2)',
                color: isAgent ? 'var(--on-dark)' : 'var(--ink)',
                border: isAgent ? 'none' : '1px solid var(--line)',
                borderRadius: 12, padding: '8px 12px', fontSize: 'var(--text-body)', lineHeight: 1.45, whiteSpace: 'pre-wrap',
              }}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {thread?.status === 'RESOLVED' ? (
        <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', textAlign: 'center' }}>RESOLVED</div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="rf-input" style={{ flex: 1 }} value={draft} disabled={busy}
            placeholder="Reply to the customer…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void reply(); }} />
          <button onClick={() => void reply()} disabled={busy} className="rf-btn">Reply</button>
        </div>
      )}
    </div>
  );
}
