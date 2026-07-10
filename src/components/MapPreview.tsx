'use client';
import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '@/lib/google-maps';
import type { Place } from './AddressInput';

export function MapPreview({ pickup, dropoff }: { pickup: Place | null; dropoff: Place | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    loadGoogleMaps().then((g) => {
      if (!ref.current) return;
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(ref.current, {
          center: { lat: 6.5244, lng: 3.3792 }, zoom: 11, disableDefaultUI: true, clickableIcons: false,
        });
      }
      markers.current.forEach((m) => m.setMap(null));
      markers.current = [];
      const bounds = new g.maps.LatLngBounds();
      for (const [p, dark] of [[pickup, true], [dropoff, false]] as const) {
        if (!p) continue;
        const pos = { lat: p.lat, lng: p.lng };
        markers.current.push(new g.maps.Marker({
          position: pos, map: mapRef.current,
          label: { text: dark ? 'A' : 'B', color: '#fff', fontFamily: 'monospace', fontSize: '11px' },
        }));
        bounds.extend(pos);
      }
      if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 60);
    }).catch(() => { /* no key -> map stays hidden */ });
  }, [pickup, dropoff]);

  return <div ref={ref} style={{ height: 180, borderRadius: 6, background: 'var(--ink)', marginBottom: 12 }} />;
}
