// Session token lives in localStorage so the user stays signed in across visits and browser
// restarts (until they explicitly log out from Profile). We never trust the token's contents
// for authorization — the server re-verifies its signature on every request.
const KEY = 'rf_token';

export const getToken = (): string =>
  typeof window !== 'undefined' ? localStorage.getItem(KEY) ?? '' : '';

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, token);
};

export const clearToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY); // clean up any token left by the old sessionStorage flow
  }
};

export const isLoggedIn = (): boolean => getToken().length > 0;

/** Decode a claim from the access token's public payload (`base64url(JSON).signature`). */
function claim<T = string>(name: string): T | undefined {
  const body = getToken().split('.')[0];
  if (!body) return undefined;
  try {
    const b64 = body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '=');
    const json = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Record<string, unknown>;
    return json[name] as T | undefined;
  } catch {
    return undefined;
  }
}

export const getUserId = (): string => claim<string>('sub') ?? '';
export const getUserRole = (): 'CUSTOMER' | 'RIDER' | 'ADMIN' =>
  (claim<'CUSTOMER' | 'RIDER' | 'ADMIN'>('role')) ?? 'CUSTOMER';
