'use client';
import { LiveMap } from './LiveMap';
import type { Place } from './AddressInput';

// Booking preview map — keyless (Leaflet + OpenStreetMap), reusing the same map component as
// live tracking. Shows the pickup and drop-off pins with the route hint between them.
export function MapPreview({ pickup, dropoff }: { pickup: Place | null; dropoff: Place | null }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <LiveMap pickup={pickup} dropoff={dropoff} height={180} />
    </div>
  );
}
