export const getToken = (): string =>
  typeof window !== 'undefined' ? sessionStorage.getItem('rf_token') ?? '' : '';

/**
 * Decode the current user's id from the access token (the signed `sub` claim).
 * The dev token is `base64url(JSON).signature`; we only read the public payload here,
 * never trust it for authorization — the server re-verifies the signature on every call.
 */
export function getUserId(): string {
  const t = getToken();
  const body = t.split('.')[0];
  if (!body) return '';
  try {
    const b64 = body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '=');
    const json = JSON.parse(decodeURIComponent(escape(atob(b64)))) as { sub?: string };
    return json.sub ?? '';
  } catch {
    return '';
  }
}
