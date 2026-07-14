'use client';
import { useEffect, useRef, useState } from 'react';
import { api, type ChatMessage } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { Button } from '@/components/ui/Button';

/** Rider <-> customer conversation for one job. Polls every 4s while mounted. */
export function ChatPanel({ jobId }: { jobId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const me = getUserId();
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => { api.messages(getToken(), jobId).then(setMessages).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [jobId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try { const m = await api.sendMessage(getToken(), jobId, body); setDraft(''); setMessages((p) => [...p, m]); }
    catch { /* surfaced by disabled retry */ }
    finally { setSending(false); }
  };

  return (
    <div className="rf-card" style={{ marginBottom: 12 }}>
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>MESSAGES</div>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {messages.length === 0 && <div style={{ color: 'var(--ink-2)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No messages yet.</div>}
        {messages.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%',
              background: mine ? 'var(--ink)' : 'var(--bg-2)', color: mine ? '#fff' : 'var(--ink)',
              border: mine ? 'none' : '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', fontSize: 14, lineHeight: 1.4 }}>
              {m.body}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="rf-input" style={{ flex: 1 }} value={draft} placeholder="Type a message…"
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
