'use client';
import { useEffect, useRef, useState } from 'react';
import { api, type ChatMessage } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { Button } from '@/components/ui/Button';

// One-time acceptance of the chat conduct terms, remembered in the browser.
const TERMS_KEY = 'rf_chat_terms_v1';
function readAccepted(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(TERMS_KEY) === '1'; }
  catch { return false; }
}

/** Rider <-> customer conversation for one job. Polls every 4s while mounted. */
export function ChatPanel({ jobId }: { jobId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [accepted, setAccepted] = useState(true); // assume accepted for SSR; corrected on mount
  const [note, setNote] = useState('');
  const me = getUserId();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setAccepted(readAccepted()); }, []);

  const load = () => { api.messages(getToken(), jobId).then(setMessages).catch(() => {}); };
  useEffect(() => {
    if (!accepted) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [jobId, accepted]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try { const m = await api.sendMessage(getToken(), jobId, body); setDraft(''); setMessages((p) => [...p, m]); }
    catch { /* surfaced by disabled retry */ }
    finally { setSending(false); }
  };

  const report = async (m: ChatMessage) => {
    if (!window.confirm('Report this message as abusive or objectionable? Our team reviews every report within 24 hours.')) return;
    try { await api.reportMessage(getToken(), jobId, m.id); setNote('Reported — thank you. We’ll review it within 24 hours.'); }
    catch { setNote('Could not submit the report. Please try again.'); }
    setTimeout(() => setNote(''), 4000);
  };

  const accept = () => {
    try { window.localStorage.setItem(TERMS_KEY, '1'); } catch { /* re-accept next visit */ }
    setAccepted(true);
  };

  if (!accepted) {
    return (
      <div className="rf-card" style={{ marginBottom: 12 }}>
        <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>COMMUNITY GUIDELINES</div>
        <div style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, color: 'var(--ink)', marginBottom: 8 }}>
          Rydafirst has zero tolerance for abusive, harassing, hateful, or otherwise objectionable content and
          behaviour. Keep messages respectful and related to the delivery.
        </div>
        <div style={{ fontSize: 'var(--text-small)', lineHeight: 1.5, color: 'var(--ink-2)', marginBottom: 12 }}>
          You can report any message using the flag next to it. Reports are reviewed within 24 hours and offending
          users are removed. By continuing you agree to these terms.
        </div>
        <Button onClick={accept}>I agree — continue</Button>
      </div>
    );
  }

  return (
    <div className="rf-card" style={{ marginBottom: 12 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>MESSAGES</div>
      {note && <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', marginBottom: 8 }}>{note}</div>}
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {messages.length === 0 && <div style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', textAlign: 'center', padding: '16px 0' }}>No messages yet.</div>}
        {messages.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ background: mine ? 'var(--ink)' : 'var(--bg-2)', color: mine ? 'var(--on-dark)' : 'var(--ink)',
                border: mine ? 'none' : '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', fontSize: 'var(--text-body)', lineHeight: 1.4 }}>
                {m.body}
              </div>
              {!mine && (
                <button
                  type="button"
                  onClick={() => report(m)}
                  title="Report message"
                  aria-label="Report message"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 'var(--text-small)', padding: 2, lineHeight: 1 }}
                >
                  ⚑
                </button>
              )}
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
