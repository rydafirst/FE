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
  customerName?: string;
  pickup?: GeoPoint; dropoff?: GeoPoint;
  pickupAddress?: string; dropoffAddress?: string;
  pickupArea?: string; dropoffArea?: string; // coarse area shown in the pre-accept feed
  recipient?: { name: string; phone: string };
  item?: string; weightGrams?: number; instructions?: string;
  fallbackPolicy?: 'WAIT' | 'DELEGATE' | 'RETURN';
  waitStartedAt?: number; waitingFeeMinor?: number; waitingTxId?: string; returnOfJobId?: string;
  returnReserveMinor?: number;
}
export interface ChatMessage { id: string; jobId: string; senderId: string; body: string; createdAt: number }
export interface AvailableJob {
  id: string; type: JobType; amountMinor: number; currency: 'NGN'; createdAt: string;
  pickupArea: string; dropoffArea: string; pickupApprox: { lat: number; lng: number };
  tripDistanceMeters: number; tripEtaMin: number;
  toPickupMeters?: number; toPickupEtaMin?: number;
}
export interface Notification { id: string; jobId?: string; title: string; body: string; createdAt: number; read: boolean }
export interface AdminQueueEntry { riderId: string; track: string | null; status: string; oldestPendingAt: number }
export interface AdminRiderDoc {
  id: string; type: string; label: string; status: string; version: number;
  rejectionReason?: string; issuedAt?: number; expiresAt?: number; previewUrl: string;
}
export interface EffectiveSettings { requireGuarantor: boolean; enforceRiderClearance: boolean; launchCity: string; overridden: { requireGuarantor: boolean; enforceRiderClearance: boolean; launchCity: boolean } }
export interface AdminOps { summary: { activeTotal: number; byStatus: Record<string, number> }; jobs: { id: string; status: string; type: string }[] }
export interface AdminDelivery { id: string; status: string; type: string; amountMinor: number; pickupArea?: string; dropoffArea?: string; createdAt: string }
export interface AdminFinance { totals: { held: number; released: number; refunded: number; platformRevenue: number }; reconciliation: { inSync: boolean; drift: { held: number; released: number; refunded: number } } }
export interface AdminDispute { id: string; jobId: string; openedBy: string; status: string; tier: string; resolution?: string; createdAt: string; resolvedAt?: string }
export interface AdminRiderProfile { track: string | null; legalName?: string; nameVerified: boolean; vehiclePlate?: string; vehicleColor?: string }
export interface AdminRiderDetail { riderId: string; track: string | null; status: string; profile?: AdminRiderProfile; documents: AdminRiderDoc[] }
export type VehicleTrack = 'BIKE' | 'CAR' | 'KEKE';
export type DocType =
  | 'PROFILE_PHOTO' | 'GOV_ID' | 'LICENSE' | 'ADDRESS_PROOF' | 'VEHICLE_REG' | 'PROOF_OF_OWNERSHIP'
  | 'ROADWORTHINESS' | 'INSURANCE' | 'VEHICLE_PHOTO' | 'GUARANTOR' | 'LASRRA' | 'LASDRI' | 'HACKNEY_PERMIT' | 'KEKE_PERMIT';
export type DocState = 'MISSING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type DocOnboarding = 'NO_TRACK' | 'INCOMPLETE' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'APPROVED' | 'EXPIRED';
export interface ChecklistItem { type: DocType; label: string; required: boolean; expires: boolean; status: DocState; rejectionReason?: string; expiresAt?: number }
export interface DocChecklist { track: VehicleTrack | null; onboarding: DocOnboarding; items: ChecklistItem[] }
export type VehicleColor = 'BLACK' | 'WHITE' | 'SILVER' | 'GREY' | 'RED' | 'BLUE' | 'GREEN' | 'GOLD' | 'OTHER';
export const VEHICLE_COLORS: VehicleColor[] = ['BLACK', 'WHITE', 'SILVER', 'GREY', 'RED', 'BLUE', 'GREEN', 'GOLD', 'OTHER'];
export interface RiderProfile { track: VehicleTrack | null; legalName?: string; nameVerified: boolean; vehiclePlate?: string; vehicleColor?: VehicleColor }
export interface RiderSummary { name?: string; nameVerified: boolean; vehicleType: VehicleTrack | null; vehiclePlate?: string; vehicleColor?: string; rating?: number; ratingCount?: number; photoUrl?: string }
export interface PendingRating { jobId: string; amountMinor: number; createdAt: string; dropoffArea?: string; riderName?: string }

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
  // Some endpoints return no body (204, or a void handler). Calling res.json() on an
  // empty body throws a SyntaxError ("The string did not match the expected pattern" in
  // WebKit / "Unexpected end of JSON input" in Chrome), so only parse when there's content.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  requestOtp: (phone: string, email?: string, name?: string) =>
    call<{ status: string }>(`/auth/otp/request`, {
      method: 'POST',
      body: JSON.stringify({ phone, ...(email ? { email } : {}), ...(name ? { name } : {}) }),
    }),
  verifyOtp: (phone: string, code: string, role: 'CUSTOMER' | 'RIDER' = 'CUSTOMER') =>
    call<{ accessToken: string; refreshToken: string }>(`/auth/otp/verify`, {
      method: 'POST', body: JSON.stringify({ phone, code, role }),
    }),
  quote: (token: string, body: { type: JobType; pickup: GeoPoint; dropoff: GeoPoint }) =>
    call<Quote>(`/jobs/quote`, { method: 'POST', token, body: JSON.stringify(body) }),
  createJob: (token: string, body: {
    quoteToken: string; refundAccountId?: string;
    customerName?: string; recipient?: { name: string; phone: string }; item?: string; weightKg?: number; instructions?: string;
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
  availableJobs: (token: string, pos?: { lat: number; lng: number }) =>
    call<AvailableJob[]>(`/jobs/available`, { method: 'POST', token, body: JSON.stringify(pos ?? {}) }),
  assignedJobs: (token: string) => call<Job[]>(`/jobs/assigned`, { token }),
  getAvailability: (token: string) => call<{ online: boolean }>(`/me/availability`, { token }),
  setAvailability: (token: string, online: boolean) =>
    call<{ online: boolean }>(`/me/availability`, { method: 'PUT', token, body: JSON.stringify({ online }) }),
  myJobs: (token: string) => call<Job[]>(`/jobs/mine`, { token }),
  cancelJob: (token: string, id: string) => call<{ status: string; refunded: boolean }>(`/jobs/${id}/cancel`, { method: 'POST', token }),
  notifyComing: (token: string, id: string) => call<{ ok: boolean }>(`/jobs/${id}/coming`, { method: 'POST', token }),
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
  // ---- Recipient-unavailable resolution ----
  startWaiting: (token: string, id: string) =>
    call<{ status: string; waitStartedAt: number }>(`/jobs/${id}/start-waiting`, { method: 'POST', token }),
  chargeWaiting: (token: string, id: string) =>
    call<{ waitingFeeMinor: number; paymentLink: string; flwTxRef: string }>(`/jobs/${id}/charge-waiting`, { method: 'POST', token }),
  payWaiting: (token: string, id: string) =>
    call<{ waitingFeeMinor: number; paymentLink: string; flwTxRef: string }>(`/jobs/${id}/pay-waiting`, { method: 'POST', token }),
  confirmWaitingPayment: (token: string, id: string, transactionId: string) =>
    call<{ funded: boolean }>(`/jobs/${id}/confirm-waiting-payment`, { method: 'POST', token, body: JSON.stringify({ transactionId }) }),
  initiateReturn: (token: string, id: string, returnUrl?: string) =>
    call<Job & { paymentLink?: string }>(`/jobs/${id}/return`, { method: 'POST', token, body: JSON.stringify(returnUrl ? { returnUrl } : {}) }),
  // ---- Rider <-> customer chat ----
  messages: (token: string, id: string) => call<ChatMessage[]>(`/jobs/${id}/messages`, { token }),
  sendMessage: (token: string, id: string, body: string) =>
    call<ChatMessage>(`/jobs/${id}/messages`, { method: 'POST', token, body: JSON.stringify({ body }) }),
  reportMessage: (token: string, id: string, messageId: string, reason?: string) =>
    call<{ id: string }>(`/jobs/${id}/messages/${messageId}/report`, { method: 'POST', token, body: JSON.stringify(reason ? { reason } : {}) }),
  submitKyc: (token: string, inputs: { ninVerified: boolean; bvnVerified: boolean; idDocUploaded: boolean; selfieMatched: boolean; addressProvided: boolean }) =>
    call<{ status: string }>(`/riders/kyc`, { method: 'POST', token, body: JSON.stringify(inputs) }),
  openDispute: (token: string, id: string, counterEvidence = false) =>
    call<{ id: string; status: string; tier: string; resolution?: string }>(`/jobs/${id}/disputes`, { method: 'POST', token, body: JSON.stringify({ counterEvidence }) }),
  wallet: (token: string) => call<{ releasedMinor: number; currency: 'NGN'; jobsCount: number; activeCount: number }>(`/wallet`, { token }),
  banks: (token: string) => call<{ code: string; name: string }[]>(`/me/account/banks`, { token }),
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
  documentsChecklist: (token: string) => call<DocChecklist>(`/me/documents`, { token }),
  setVehicleTrack: (token: string, track: VehicleTrack) =>
    call<{ track: VehicleTrack }>(`/me/documents/track`, { method: 'PUT', token, body: JSON.stringify({ track }) }),
  requestDocumentUpload: (token: string, body: { type: DocType; contentType: string; issuedAt?: number; expiresAt?: number }) =>
    call<{ documentId: string; uploadUrl: string }>(`/me/documents/upload-url`, { method: 'POST', token, body: JSON.stringify(body) }),
  riderProfile: (token: string) => call<RiderProfile>(`/me/documents/profile`, { token }),
  updateRiderProfile: (token: string, body: { legalName?: string; vehiclePlate?: string; vehicleColor?: VehicleColor }) =>
    call<RiderProfile>(`/me/documents/profile`, { method: 'PUT', token, body: JSON.stringify(body) }),
  jobRider: (token: string, id: string) => call<{ rider: RiderSummary | null }>(`/jobs/${id}/rider`, { token }),
  jobCustomer: (token: string, id: string) => call<{ name?: string; photoUrl?: string }>(`/jobs/${id}/customer`, { token }),
  avatarUploadUrl: (token: string, contentType: string, sizeBytes: number) => call<{ uploadUrl: string }>(`/me/avatar/upload-url`, { method: 'POST', token, body: JSON.stringify({ contentType, sizeBytes }) }),
  myAvatar: (token: string) => call<{ photoUrl: string | null }>(`/me/avatar`, { token }),
  me: (token: string) => call<{ id: string; phone: string | null }>(`/me`, { token }),
  pendingRatings: (token: string) => call<PendingRating[]>(`/jobs/pending-ratings`, { token }),
  rateJob: (token: string, id: string, body: { stars: number; comment?: string }) =>
    call<{ id: string }>(`/jobs/${id}/rating`, { method: 'POST', token, body: JSON.stringify(body) }),
  adminVerifyRiderName: (token: string, riderId: string, verified: boolean) =>
    call<{ ok?: boolean }>(`/admin/documents/riders/${riderId}/verify-name`, { method: 'POST', token, body: JSON.stringify({ verified }) }),
  adminSettings: (token: string) => call<EffectiveSettings>(`/admin/settings`, { token }),
  adminUpdateSettings: (token: string, patch: Partial<Pick<EffectiveSettings, 'requireGuarantor' | 'enforceRiderClearance' | 'launchCity'>>) =>
    call<EffectiveSettings>(`/admin/settings`, { method: 'PUT', token, body: JSON.stringify(patch) }),
  adminOps: (token: string) => call<AdminOps>(`/admin/ops/jobs/active`, { token }),
  adminDeliveries: (token: string) => call<AdminDelivery[]>(`/admin/ops/deliveries`, { token }),
  adminFinance: (token: string) => call<AdminFinance>(`/admin/finance/reconciliation`, { token }),
  adminDisputes: (token: string) => call<AdminDispute[]>(`/admin/disputes`, { token }),
  adminResolveDispute: (token: string, id: string, resolution: 'RELEASE' | 'REFUND' | 'SPLIT', riderShareMinor?: number) =>
    call<{ status: string }>(`/admin/disputes/${id}/resolve`, { method: 'POST', token, body: JSON.stringify({ resolution, ...(riderShareMinor != null ? { riderShareMinor } : {}) }) }),
  adminDocQueue: (token: string) => call<AdminQueueEntry[]>(`/admin/documents/queue`, { token }),
  adminRiderDocuments: (token: string, riderId: string) =>
    call<AdminRiderDetail>(`/admin/documents/riders/${riderId}`, { token }),
  adminApproveDocument: (token: string, id: string) =>
    call<{ riderStatus: string }>(`/admin/documents/${id}/approve`, { method: 'POST', token }),
  adminRejectDocument: (token: string, id: string, reason: string) =>
    call<{ riderStatus: string }>(`/admin/documents/${id}/reject`, { method: 'POST', token, body: JSON.stringify({ reason }) }),
};
