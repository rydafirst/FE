// Thin typed client for contracts/openapi.yaml. Generate a full client in CI; this covers core calls.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export type JobType = 'DELIVERY' | 'RIDE';
export interface GeoPoint { lat: number; lng: number }
export interface Quote { quoteToken: string; amountMinor: number; currency: 'NGN'; breakdown: {
  baseMinor: number; distanceMinor: number; platformFeeMinor: number; totalMinor: number } }
export interface Job {
  id: string; type: JobType; status: string; amountMinor: number; currency: 'NGN'; createdAt: string;
}

async function call<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const api = {
  requestOtp: (phone: string) =>
    call<{ status: string }>(`/auth/otp/request`, { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    call<{ accessToken: string; refreshToken: string }>(`/auth/otp/verify`, {
      method: 'POST', body: JSON.stringify({ phone, code }),
    }),
  quote: (token: string, body: { type: JobType; pickup: GeoPoint; dropoff: GeoPoint }) =>
    call<Quote>(`/jobs/quote`, { method: 'POST', token, body: JSON.stringify(body) }),
  createJob: (token: string, body: { quoteToken: string; refundAccountId: string }) =>
    call<Job>(`/jobs`, {
      method: 'POST', token,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  getJob: (token: string, id: string) => call<Job>(`/jobs/${id}`, { token }),
  confirmCode: (token: string, id: string, code: string) =>
    call<{ status: string }>(`/jobs/${id}/confirm-code`, {
      method: 'POST', token, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ code }),
    }),
  accept: (token: string, id: string) => call<Job>(`/jobs/${id}/accept`, { method: 'POST', token }),
  advance: (token: string, id: string, to: 'EN_ROUTE_PICKUP' | 'AT_PICKUP' | 'IN_PROGRESS' | 'EN_ROUTE_DROP') =>
    call<Job>(`/jobs/${id}/advance`, { method: 'POST', token, body: JSON.stringify({ to }) }),
  arrive: (token: string, id: string, lat: number, lng: number) =>
    call<Job>(`/jobs/${id}/arrive`, { method: 'POST', token, body: JSON.stringify({ lat, lng }) }),
  issueCode: (token: string, id: string) => call<{ code: string }>(`/jobs/${id}/issue-code`, { method: 'POST', token }),
  submitKyc: (token: string, inputs: { ninVerified: boolean; bvnVerified: boolean; idDocUploaded: boolean; selfieMatched: boolean; addressProvided: boolean }) =>
    call<{ status: string }>(`/riders/kyc`, { method: 'POST', token, body: JSON.stringify(inputs) }),
  openDispute: (token: string, id: string, counterEvidence = false) =>
    call<{ id: string; status: string; tier: string; resolution?: string }>(`/jobs/${id}/disputes`, { method: 'POST', token, body: JSON.stringify({ counterEvidence }) }),
  wallet: (token: string) => call<{ releasedMinor: number; currency: 'NGN'; jobsCount: number; activeCount: number }>(`/wallet`, { token }),
  confirmPayment: (token: string, id: string, transactionId: string) =>
    call<{ funded: boolean; status: string }>(`/jobs/${id}/confirm-payment`, { method: 'POST', token, body: JSON.stringify({ transactionId }) }),
};
