// Runtime loaders for the live map + realtime socket. Both are pulled from a CDN so no
// extra npm install is required. Leaflet + OpenStreetMap (Carto Positron tiles) need NO API key.
// This is intentionally provider-agnostic: swap `TILE_URL` (or the whole file) for Mapbox later.

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const SOCKET_JS = 'https://cdn.socket.io/4.7.5/socket.io.min.js';

// Monochrome basemap (light, label-light) to match the design system. No key required.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTR = '© OpenStreetMap © CARTO';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadCss(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href;
  document.head.appendChild(l);
}

let leafletPromise: Promise<any> | null = null;
export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('client only'));
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  loadCss(LEAFLET_CSS);
  leafletPromise = loadScript(LEAFLET_JS).then(() => (window as any).L);
  return leafletPromise;
}

let socketPromise: Promise<any> | null = null;
function loadSocketIo(): Promise<any> {
  const w = window as any;
  if (w.io) return Promise.resolve(w.io);
  if (socketPromise) return socketPromise;
  socketPromise = loadScript(SOCKET_JS).then(() => (window as any).io);
  return socketPromise;
}

/** Base origin of the API (strip the /v1 version suffix) — the socket.io server lives at the root. */
export function socketBase(): string {
  let api = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(api)) api = `https://${api}`; // guard against a scheme-less env value
  return api.replace(/\/v\d+$/, '');
}

/** Connect to the tracking gateway. Returns the socket.io client instance. */
export async function connectSocket(): Promise<any> {
  const io = await loadSocketIo();
  return io(socketBase(), { transports: ['websocket'], forceNew: true });
}
