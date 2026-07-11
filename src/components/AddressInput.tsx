'use client';
import { useEffect, useRef, useState } from 'react';

export interface Place { label: string; lat: number; lng: number }

interface NominatimResult { lat: string; lon: string; display_name: string; place_id: number }

const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Keyless address search via OpenStreetMap (Nominatim) — no API key, billing, or referrer setup.
// Debounced to stay within Nominatim's fair-use limit (~1 req/sec).
export function AddressInput({ label, placeholder, onSelect }: {
  label: string; placeholder?: string; onSelect: (p: Place) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickedRef = useRef(false); // suppress the search that would fire right after a selection

  useEffect(() => {
    if (pickedRef.current) { pickedRef.current = false; return; }
    const q = query.trim();
    if (q.length < 3) { setResults([]); return; }

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const url = `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&countrycodes=ng&accept-language=en`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Search failed');
        setResults((await res.json()) as NominatimResult[]);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Address search unavailable, try again');
      } finally { setLoading(false); }
    }, 350);

    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const pick = (r: NominatimResult) => {
    pickedRef.current = true;
    setQuery(r.display_name);
    setResults([]); setOpen(false);
    onSelect({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation unavailable');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`);
        const data = (await res.json()) as { display_name?: string };
        const addr = data.display_name ?? 'Current location';
        pickedRef.current = true; setQuery(addr); setOpen(false);
        onSelect({ label: addr, lat, lng });
      } catch {
        pickedRef.current = true; setQuery('Current location'); setOpen(false);
        onSelect({ label: 'Current location', lat, lng });
      }
    }, () => setError('Location permission denied'));
  };

  return (
    <div className="rf-card" style={{ marginBottom: 12, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{label}</span>
        <button onClick={useMyLocation} className="mono" style={{ fontSize: 10, background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: 'var(--ink)' }}>USE MY LOCATION</button>
      </div>

      <input
        className="rf-input"
        value={query}
        placeholder={placeholder ?? 'Search address…'}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        autoComplete="off"
      />

      {loading && <p className="mono" style={{ fontSize: 10, color: 'var(--mid)', margin: '6px 0 0' }}>SEARCHING…</p>}
      {error && <p style={{ color: 'var(--danger)', fontSize: 11, margin: '6px 0 0' }}>{error}</p>}

      {open && results.length > 0 && (
        <ul style={{
          listStyle: 'none', margin: '6px 0 0', padding: 0, position: 'absolute', left: 16, right: 16, zIndex: 40,
          background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden',
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto',
        }}>
          {results.map((r) => (
            <li key={r.place_id}>
              <button onClick={() => pick(r)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none',
                background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--line-2)',
              }}>
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
