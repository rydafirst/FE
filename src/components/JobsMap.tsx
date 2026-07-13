'use client';
import { useEffect, useRef } from 'react';
import { loadLeaflet, TILE_URL, TILE_ATTR } from '@/lib/live';

export interface JobPin { id: string; lat: number; lng: number; label: string }

// Keyless Leaflet map showing a price pin per nearby available job (approximate, area-level
// locations). Purely visual — accepting still happens from the list below.
export function JobsMap({ pins, height = 200 }: { pins: JobPin[]; height?: number }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      const c = pins[0] ?? { lat: 6.5244, lng: 3.3792 };
      const map = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView([c.lat, c.lng], 13);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map);
      mapRef.current = map;
      draw(L);
    });
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (L && mapRef.current) draw(L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.map((p) => p.id).join(',')]);

  function draw(L: any) {
    const map = mapRef.current;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    if (pins.length === 0) return;
    const group = L.layerGroup().addTo(map);
    for (const p of pins) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#ff5a1f;color:#fff;font:700 11px system-ui;padding:3px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">${p.label}</div>`,
        iconAnchor: [20, 10],
      });
      L.marker([p.lat, p.lng], { icon }).addTo(group);
    }
    layerRef.current = group;
    const pts = pins.map((p) => [p.lat, p.lng]);
    if (pts.length === 1) map.setView(pts[0], 14);
    else map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
  }

  return <div ref={elRef} style={{ height, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }} />;
}
