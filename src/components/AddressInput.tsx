'use client';
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/google-maps';

export interface Place { label: string; lat: number; lng: number; area?: string }

// Pull the neighbourhood/locality from Google's structured components (reliable, unlike
// string-parsing the formatted address). Prefers the most specific area, falls back upward.
function localityOf(place: google.maps.places.PlaceResult): string {
  const comps = place.address_components ?? [];
  const byType = (t: string) => comps.find((c: google.maps.GeocoderAddressComponent) => c.types.includes(t))?.long_name;
  return (
    byType('neighborhood') || byType('sublocality_level_1') || byType('sublocality') ||
    byType('locality') || byType('administrative_area_level_2') || ''
  );
}

// Google Places Autocomplete bound to the input. Requires (in the Google Cloud project):
// Maps JavaScript API + Places API, and Geocoding API for "use my location".
export function AddressInput({ label, placeholder, onSelect }: {
  label: string; placeholder?: string; onSelect: (p: Place) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ac: google.maps.places.Autocomplete | undefined;
    loadGoogleMaps().then((g) => {
      if (!inputRef.current) return;
      ac = new g.maps.places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'formatted_address', 'name', 'address_components'],
        componentRestrictions: { country: 'ng' },
      });
      ac.addListener('place_changed', () => {
        const place = ac!.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        const area = localityOf(place);
        onSelect({ label: place.formatted_address ?? place.name ?? '', lat: loc.lat(), lng: loc.lng(), ...(area ? { area } : {}) });
      });
      setReady(true);
    }).catch((e) => setError((e as Error).message));
    return () => { if (ac) google.maps.event.clearInstanceListeners(ac); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation unavailable');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        const g = await loadGoogleMaps();
        const res = await new g.maps.Geocoder().geocode({ location: { lat, lng } });
        const addr = res.results[0]?.formatted_address ?? 'Current location';
        if (inputRef.current) inputRef.current.value = addr;
        onSelect({ label: addr, lat, lng });
      } catch { onSelect({ label: 'Current location', lat, lng }); }
    }, () => setError('Location permission denied'));
  };

  return (
    <div className="rf-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{label}</span>
        <button onClick={useMyLocation} className="mono" style={{ fontSize: 10, background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: 'var(--ink)' }}>USE MY LOCATION</button>
      </div>
      <input ref={inputRef} className="rf-input" placeholder={placeholder ?? (ready ? 'Search address…' : 'Loading…')} />
      {error && <p style={{ color: 'var(--danger)', fontSize: 11, margin: '6px 0 0' }}>{error}</p>}
    </div>
  );
}
