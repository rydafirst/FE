'use client';
import { useEffect, useRef } from 'react';
import { loadLeaflet, TILE_URL, TILE_ATTR } from '@/lib/live';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface LatLng { lat: number; lng: number }

export interface MapStop { lat: number; lng: number; label?: string; done?: boolean; current?: boolean }

interface Props {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  rider?: LatLng | null;      // live rider position (updates as pings arrive)
  trail?: LatLng[];           // the actual path the rider has travelled (breadcrumb)
  route?: LatLng[];           // planned road-following route pickup -> dropoff
  stops?: MapStop[];          // #4 MULTI-STOP: extra drop-offs (stop 2..N), drawn as numbered markers
  height?: number;
}

// #4 MULTI-STOP: numbered badge for an extra stop, styled by progress.
const stopIcon = (L: any, n: number, state: 'done' | 'current' | 'pending') => {
  const bg = state === 'done' ? 'var(--success)' : state === 'current' ? 'var(--ink)' : 'var(--bg)';
  const fg = state === 'pending' ? 'var(--ink)' : 'var(--on-dark)';
  const ring = state === 'current' ? 'box-shadow:0 0 0 3px rgba(0,0,0,.18),0 1px 4px rgba(0,0,0,.35);' : 'box-shadow:0 0 0 1px rgba(0,0,0,.15);';
  const text = state === 'done' ? '✓' : String(n);
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${bg};color:${fg};border:2px solid var(--on-dark);display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:700;font-size:12px;${ring}">${text}</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
};

// Small monochrome dot markers so the map stays on-brand (no default blue pins).
const dot = (L: any, color: string, ring = 'var(--on-dark)') =>
  L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${ring};box-shadow:0 0 0 1px rgba(0,0,0,.15)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });

export function LiveMap({ pickup, dropoff, rider, trail, route, stops, height = 260 }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ pickup?: any; dropoff?: any; rider?: any; line?: any; trail?: any; route?: any }>({});
  const stopsRef = useRef<any[]>([]); // #4 MULTI-STOP: layers rebuilt each draw (markers + legs)
  const stopsKey = (stops ?? []).map((s) => `${s.lat},${s.lng},${s.done ? 'd' : s.current ? 'c' : 'p'}`).join('|');

  // Init once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      const center = pickup ?? dropoff ?? { lat: 6.5244, lng: 3.3792 }; // default Lagos
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 13);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      draw(L);
    });
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers whenever any point changes.
  useEffect(() => {
    const L = (window as any).L;
    if (L && mapRef.current) draw(L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, rider?.lat, rider?.lng, trail?.length, route?.length, stopsKey]);

  function draw(L: any) {
    const map = mapRef.current;
    const m = markersRef.current;
    const set = (key: 'pickup' | 'dropoff' | 'rider', pt: LatLng | null | undefined, color: string, label: string) => {
      if (!pt) return;
      if (m[key]) m[key].setLatLng([pt.lat, pt.lng]);
      else m[key] = L.marker([pt.lat, pt.lng], { icon: dot(L, color), title: label }).addTo(map);
    };
    set('pickup', pickup, 'var(--ink)', 'Pickup');
    set('dropoff', dropoff, 'var(--ink)', 'Drop-off');
    set('rider', rider, 'var(--primary)', 'Rider'); // the single accent, used only for the live rider

    // Planned route: road-following line when we have one, else a straight pickup->dropoff hint.
    if (route && route.length >= 2) {
      const pts = route.map((p) => [p.lat, p.lng]);
      if (m.route) m.route.setLatLngs(pts);
      else m.route = L.polyline(pts, { color: 'var(--ink)', weight: 3, opacity: 0.35 }).addTo(map);
      if (m.line) { m.line.remove(); m.line = undefined; } // drop the straight fallback
    } else if (pickup && dropoff) {
      const pts = [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
      if (m.line) m.line.setLatLngs(pts);
      else m.line = L.polyline(pts, { color: 'var(--ink)', weight: 2, opacity: 0.25, dashArray: '4 6' }).addTo(map);
    }

    // Breadcrumb: the actual path the rider has travelled so far (solid orange).
    if (trail && trail.length >= 2) {
      const pts = trail.map((p) => [p.lat, p.lng]);
      if (m.trail) m.trail.setLatLngs(pts);
      else m.trail = L.polyline(pts, { color: 'var(--primary)', weight: 3.5, opacity: 0.9 }).addTo(map);
    }

    // #4 MULTI-STOP: numbered markers + progress legs for the extra drop-offs. Rebuilt each draw.
    for (const layer of stopsRef.current) layer.remove();
    stopsRef.current = [];
    const stopList = stops ?? [];
    if (stopList.length) {
      let prev: LatLng | null = dropoff ?? pickup ?? null;
      stopList.forEach((s, i) => {
        const state: 'done' | 'current' | 'pending' = s.done ? 'done' : s.current ? 'current' : 'pending';
        if (prev) {
          const weight = state === 'current' ? 4 : state === 'done' ? 2 : 1.6;
          const opacity = state === 'pending' ? 0.45 : state === 'done' ? 0.5 : 0.9;
          const leg = L.polyline([[prev.lat, prev.lng], [s.lat, s.lng]], {
            color: 'var(--ink)', weight, opacity, ...(state === 'pending' ? { dashArray: '4 6' } : {}),
          }).addTo(map);
          stopsRef.current.push(leg);
        }
        const mk = L.marker([s.lat, s.lng], { icon: stopIcon(L, i + 2, state), title: s.label ?? `Stop ${i + 2}` }).addTo(map);
        stopsRef.current.push(mk);
        prev = { lat: s.lat, lng: s.lng };
      });
    }

    // Keep everything in view.
    const all = [pickup, dropoff, rider, ...stopList].filter(Boolean) as LatLng[];
    if (all.length >= 2) map.fitBounds(all.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 15 });
    else if (all.length === 1) map.setView([all[0].lat, all[0].lng], 14);
  }

  return <div ref={elRef} style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }} />;
}
