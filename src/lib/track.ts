export type TrackPayload = {
  section: 'whats-on';
  category?: string | null; // URL segment, e.g. 'workshop'
  slug?: string | null;     // event slug
  path?: string;            // useful for debugging
};

export function trackHit(payload: TrackPayload) {
  const body = JSON.stringify({ ...payload, ts: Date.now() });
  if ('sendBeacon' in navigator) {
    navigator.sendBeacon('/api/analytics/hit', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/analytics/hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}
