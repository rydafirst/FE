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

function fmtTime(ms: number): string {
  try { return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
}

// Merge by id so a message never renders twice (fixes the "appears twice then settles" flicker): the
// optimistic copy shares the server id, and local-only messages the latest poll hasn't returned survive.
// Also keep the first signed audio URL per message so the <audio> element isn't reloaded every poll.
function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const prevById = new Map(prev.map((m) => [m.id, m] as const));
  const byId = new Map<string, ChatMessage>();
  for (const m of incoming) {
    const existing = prevById.get(m.id);
    let merged = m;
    if (existing?.audioUrl && m.audioUrl) merged = { ...merged, audioUrl: existing.audioUrl };
    if (existing?.imageUrl && m.imageUrl) merged = { ...merged, imageUrl: existing.imageUrl };
    byId.set(m.id, merged);
  }
  for (const m of prev) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function fmtDur(ms?: number): string {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Rider <-> customer conversation for one job. Polls every 4s while mounted. */
export function ChatPanel({ jobId }: { jobId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [accepted, setAccepted] = useState(true); // assume accepted for SSR; corrected on mount
  const [note, setNote] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const me = getUserId();
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  // Pick a recording MIME the browser supports (Chrome/Firefox → webm/opus, Safari → mp4).
  const pickMime = () => {
    const opts = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    const MR = typeof window !== 'undefined' ? window.MediaRecorder : undefined;
    return (MR && opts.find((m) => MR.isTypeSupported(m))) || 'audio/webm';
  };

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) { setNote('Recording is not supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelledRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { void finishRecording(mime); };
      recRef.current = mr;
      mr.start();
      recStartRef.current = Date.now();
      setRecSecs(0); setRecording(true);
      recTimerRef.current = setInterval(() => setRecSecs(Math.floor((Date.now() - recStartRef.current) / 1000)), 500);
    } catch { setNote('Microphone permission is needed to record.'); setTimeout(() => setNote(''), 4000); }
  };

  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  const stopTimer = () => { if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; } };

  const stopRecording = () => { stopTimer(); setRecording(false); recRef.current?.stop(); };
  const cancelRecording = () => { cancelledRef.current = true; stopRecording(); };

  const finishRecording = async (mime: string) => {
    const durationMs = Date.now() - recStartRef.current;
    stopStream();
    if (cancelledRef.current) return;
    const blob = new Blob(chunksRef.current, { type: mime });
    if (blob.size === 0 || durationMs < 700) { setNote('Recording was too short.'); setTimeout(() => setNote(''), 3000); return; }
    setUploadingAudio(true);
    const replyId = replyTo?.id;
    try {
      const { uploadUrl, key } = await api.chatAudioUploadUrl(getToken(), jobId, mime, blob.size);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      const m = await api.sendMessage(getToken(), jobId, '', replyId, { audioKey: key, audioDurationMs: durationMs });
      setReplyTo(null);
      setMessages((p) => mergeMessages(p, [m]));
    } catch { setNote('Could not send the voice note.'); setTimeout(() => setNote(''), 4000); }
    finally { setUploadingAudio(false); }
  };

  useEffect(() => { setAccepted(readAccepted()); }, []);

  const load = () => { api.messages(getToken(), jobId).then((server) => setMessages((prev) => mergeMessages(prev, server))).catch(() => {}); };
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
    const replyId = replyTo?.id;
    try {
      const m = await api.sendMessage(getToken(), jobId, body, replyId);
      setDraft(''); setReplyTo(null);
      setMessages((p) => mergeMessages(p, [m])); // merge, never push — no duplicate on the next poll
    }
    catch { /* surfaced by disabled retry */ }
    finally { setSending(false); }
  };

  // Photos: pick a file, PUT it to the presigned URL, then send a message quoting the returned key.
  const sendImage = async (file: File) => {
    if (uploadingImage) return;
    const mime = file.type || 'image/jpeg';
    if (!/^image\//.test(mime)) { setNote('Please choose an image file.'); setTimeout(() => setNote(''), 3000); return; }
    setUploadingImage(true);
    const replyId = replyTo?.id;
    try {
      const { uploadUrl, key } = await api.chatImageUploadUrl(getToken(), jobId, mime, file.size);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      const m = await api.sendMessage(getToken(), jobId, draft.trim(), replyId, undefined, key);
      setDraft(''); setReplyTo(null);
      setMessages((p) => mergeMessages(p, [m]));
    } catch { setNote('Could not send the photo.'); setTimeout(() => setNote(''), 4000); }
    finally { setUploadingImage(false); }
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
          const repliedTo = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ background: mine ? 'var(--ink)' : 'var(--bg-2)', color: mine ? 'var(--on-dark)' : 'var(--ink)',
                border: mine ? 'none' : '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', fontSize: 'var(--text-body)', lineHeight: 1.4 }}>
                {m.replyToId && (
                  <div style={{ borderLeft: `2px solid ${mine ? 'var(--on-dark)' : 'var(--primary)'}`, paddingLeft: 8, marginBottom: 5, opacity: 0.85, fontSize: 'var(--text-small)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                    {repliedTo ? (repliedTo.audioUrl ? '🎤 Voice note' : repliedTo.imageUrl ? '📷 Photo' : repliedTo.body) : 'Message'}
                  </div>
                )}
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img src={m.imageUrl} alt="Shared photo" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block' }} />
                  </a>
                )}
                {m.audioUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
                    <audio controls preload="metadata" src={m.audioUrl} style={{ height: 34, maxWidth: 220, filter: mine ? 'invert(1)' : 'none' }} />
                    {m.audioDurationMs ? <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>{fmtDur(m.audioDurationMs)}</span> : null}
                  </div>
                )}
                {m.body && <div style={{ marginTop: m.audioUrl ? 4 : 0 }}>{m.body}</div>}
                <div className="mono" style={{ fontSize: 10, opacity: mine ? 0.7 : 0.6, textAlign: 'right', marginTop: 3 }}>{fmtTime(m.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button type="button" onClick={() => setReplyTo(m)} title="Reply" aria-label="Reply"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 'var(--text-small)', padding: 2, lineHeight: 1 }}>↩</button>
                {!mine && (
                  <button type="button" onClick={() => report(m)} title="Report message" aria-label="Report message"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 'var(--text-small)', padding: 2, lineHeight: 1 }}>⚑</button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--primary)' }}>REPLYING TO {replyTo.senderId === me ? 'YOURSELF' : 'THEM'}</div>
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.audioUrl ? '🎤 Voice note' : replyTo.imageUrl ? '📷 Photo' : replyTo.body}</div>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 'var(--text-subtitle)', lineHeight: 1 }}>×</button>
        </div>
      )}
      {recording ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--danger)' }} />
          <span className="mono" style={{ flex: 1, color: 'var(--ink)' }}>{fmtDur(recSecs * 1000)} · Recording…</span>
          <button type="button" onClick={cancelRecording} className="mono" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--ink-2)' }}>Cancel</button>
          <Button onClick={stopRecording}>Send</Button>
        </div>
      ) : uploadingAudio || uploadingImage ? (
        <div className="mono" style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', padding: '8px 0' }}>{uploadingImage ? 'Sending photo…' : 'Sending voice note…'}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendImage(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo" title="Attach a photo"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontSize: 18 }}>📷</button>
          <input className="rf-input" style={{ flex: 1 }} value={draft} placeholder={replyTo ? 'Type your reply…' : 'Type a message…'}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          {draft.trim()
            ? <Button onClick={send}>Send</Button>
            : <button type="button" onClick={startRecording} aria-label="Record a voice note" title="Record a voice note"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontSize: 18 }}>🎤</button>}
        </div>
      )}
    </div>
  );
}
