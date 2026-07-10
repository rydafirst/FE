// Loads the Google Maps JS SDK once (Maps + Places). Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
// Uses the official `callback` param so the promise only resolves once the API AND the
// requested libraries (places) are fully ready — avoids "places is undefined" races.
let loader: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') return Promise.reject(new Error('client only'));
  const w = window as unknown as { google?: typeof google };
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  if (loader) return loader;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  loader = new Promise<typeof google>((resolve, reject) => {
    if (!key) { reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')); return; }

    const cbName = '__rydafirstGmapsReady';
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      resolve((window as unknown as { google: typeof google }).google);
    };

    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=places&callback=${cbName}&region=NG&language=en`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return loader;
}
