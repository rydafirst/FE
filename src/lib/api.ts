// Thin typed client for contracts/openapi.yaml. Generate a full client in CI; this covers core calls.
// Normalize the base URL: if NEXT_PUBLIC_API_URL is set without a scheme (e.g. "host/v1"),
// the browser would treat it as a *relative* path and hit the current site instead of the API.
// Prepend https:// when missing and strip any trailing slash so requests always go to the API.
function normalizeBase(raw: string | undefined): string {
  const v = (raw ?? 'http://localhost:4000/v1').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
const BASE = normalizeBase(process.env.NEXT_PUBLIC_API_URL);

export type JobType = 'DELIVERY' | 'RIDE';
export interface GeoPoint { lat: number; lng: number }
export interface Quote { quoteToken: string; amountMinor: number; currency: 'NGN'; breakdown: {
  baseMinor: number; distanceMinor: number; platformFeeMinor: number; totalMinor: number } }
export interface Job {
  id: string; type: JobType; status: string; amountMinor: number; currency: 'NGN'; createdAt: string;
  pickup?: GeoPoint; dropoff?: GeoPoint;
  pickupAddress?: string; dropoffAddress?: string;
  pickupArea?: string; dropoffArea?: string; // coarse area shown in the pre-accept feed
  recipient?: { name: string; phone: string };
  item?: string; instructions?: string;
  fallbackPolicy?: 'WAIT' | 'DELEGATE' | 'RETURN';
}
export interface Notification { id: string; jobId?: string; title: string; body: string; createdAt: number; read: boolean }
export interface AdminQueueEntry { riderId: string; track: string | null; status: string; oldestPendingAt: number }
export interface AdminRiderDoc {
  id: string; type: string; label: string; status: string; version: number;
  rejectionReason?: string; issuedAt?: number; expiresAt?: number; previewUrl: string;
}
export interface AdminRiderDetail { riderId: string; track: string | null; status: string; documents: AdminRiderDoc[] }

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
  requestOtp: (phone: string, email?: string) =>
    call<{ status: string }>(`/auth/otp/request`, {
      method: 'POST',
      body: JSON.stringify(email ? { phone, email } : { phone }),
    }),
  verifyOtp: (phone: string, code: string, role: 'CUSTOMER' | 'RIDER' = 'CUSTOMER') =>
    call<{ accessToken: string; refreshToken: string }>(`/auth/otp/verify`, {
      method: 'POST', body: JSON.stringify({ phone, code, role }),
    }),
  quote: (token: string, body: { type: JobType; pickup: GeoPoint; dropoff: GeoPoint }) =>
    call<Quote>(`/jobs/quote`, { method: 'POST', token, body: JSON.stringify(body) }),
  createJob: (token: string, body: {
    quoteToken: string; refundAccountId?: string;
    recipient?: { name: string; phone: string }; item?: string; instructions?: string;
    pickupAddress?: string; dropoffAddress?: string; pickupArea?: string; dropoffArea?: string;
    fallbackPolicy?: 'WAIT' | 'DELEGATE' | 'RETURN';
  }) =>
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
  availableJobs: (token: string) => call<Job[]>(`/jobs/available`, { token }),
  assignedJobs: (token: string) => call<Job[]>(`/jobs/assigned`, { token }),
  getAvailability: (token: string) => call<{ online: boolean }>(`/me/availability`, { token }),
  setAvailability: (token: string, online: boolean) =>
    call<{ online: boolean }>(`/me/availability`, { method: 'PUT', token, body: JSON.stringify({ online }) }),
  myJobs: (token: string) => call<Job[]>(`/jobs/mine`, { token }),
  cancelJob: (token: string, id: string) => call<{ status: string; refunded: boolean }>(`/jobs/${id}/cancel`, { method: 'POST', token }),
  accept: (token: string, id: string) => call<Job>(`/jobs/${id}/accept`, { method: 'POST', token }),
  releaseJob: (token: string, id: string) => call<{ status: string }>(`/jobs/${id}/release`, { method: 'POST', token }),
  advance: (token: string, id: string, to: 'EN_ROUTE_PICKUP' | 'AT_PICKUP' | 'IN_PROGRESS' | 'EN_ROUTE_DROP') =>
    call<Job>(`/jobs/${id}/advance`, { method: 'POST', token, body: JSON.stringify({ to }) }),
  arrivePickup: (token: string, id: string, lat: number, lng: number) =>
    call<Job>(`/jobs/${id}/arrive-pickup`, { method: 'POST', token, body: JSON.stringify({ lat, lng }) }),
  arrive: (token: string, id: string, lat: number, lng: number) =>
    call<Job>(`/jobs/${id}/arrive`, { method: 'POST', token, body: JSON.stringify({ lat, lng }) }),
  failedAttempt: (token: string, id: string) =>
    call<{ status: string; attemptFeeMinor: number; waitingFeeMinor: number }>(`/jobs/${id}/failed-attempt`, {
      method: 'POST', token, headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),
  issueCode: (token: string, id: string) => call<{ code: string }>(`/jobs/${id}/issue-code`, { method: 'POST', token }),
  submitKyc: (token: string, inputs: { ninVerified: boolean; bvnVerified: boolean; idDocUploaded: boolean; selfieMatched: boolean; addressProvided: boolean }) =>
    call<{ status: string }>(`/riders/kyc`, { method: 'POST', token, body: JSON.stringify(inputs) }),
  openDispute: (token: string, id: string, counterEvidence = false) =>
    call<{ id: string; status: string; tier: string; resolution?: string }>(`/jobs/${id}/disputes`, { method: 'POST', token, body: JSON.stringify({ counterEvidence }) }),
  wallet: (token: string) => call<{ releasedMinor: number; currency: 'NGN'; jobsCount: number; activeCount: number }>(`/wallet`, { token }),
  getAccount: (token: string) =>
    call<{ bankCode: string; accountName: string; accountNumberMasked: string; type: 'refund' | 'payout' } | null>(`/me/account`, { token }),
  resolveAccount: (token: string, body: { bankCode: string; accountNumber: string }) =>
    call<{ accountName: string }>(`/me/account/resolve`, { method: 'POST', token, body: JSON.stringify(body) }),
  setAccount: (token: string, body: { bankCode: string; accountNumber: string; type?: 'refund' | 'payout' }) =>
    call<{ bankCode: string; accountName: string; accountNumberMasked: string; type: 'refund' | 'payout' }>(`/me/account`, { method: 'PUT', token, body: JSON.stringify(body) }),
  confirmPayment: (token: string, id: string, transactionId: string) =>
    call<{ funded: boolean; status: string }>(`/jobs/${id}/confirm-payment`, { method: 'POST', token, body: JSON.stringify({ transactionId }) }),
  notifications: (token: string) => call<{ items: Notification[]; unread: number }>(`/me/notifications`, { token }),
  markNotificationsRead: (token: string) => call<{ ok: boolean }>(`/me/notifications/read`, { method: 'POST', token }),
  adminDocQueue: (token: string) => call<AdminQueueEntry[]>(`/admin/documents/queue`, { token }),
  adminRiderDocuments: (token: string, riderId: string) =>
    call<AdminRiderDetail>(`/admin/documents/riders/${riderId}`, { token }),
  adminApproveDocument: (token: string, id: string) =>
    call<{ riderStatus: string }>(`/admin/documents/${id}/approve`, { method: 'POST', token }),
  adminRejectDocument: (token: string, id: string, reason: string) =>
    call<{ riderStatus: string }>(`/admin/documents/${id}/reject`, { method: 'POST', token, body: JSON.stringify({ reason }) }),
};
