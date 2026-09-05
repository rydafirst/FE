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

export type JobType = 'DELIVERY' | 'RIDE' | 'ERRAND';

export interface ErrandDetails {
  goodsMinor: number;
  shoppingList: string;
  store?: { name?: string; area?: string; address?: string };
  vendorAccount?: { bankCode: string; accountNumber: string; accountName: string };
  vendorApproved?: boolean;
  vendorPaidAt?: number;
  deliveryFeeMinor?: number;
  requestedTopUpMinor?: number;
  topUpTxRef?: string;
  topUpTxId?: string;
}
export interface ErrandReceipt {
  receiptNo: string; orderId: string; paidAt: number; amountMinor: number; currency: 'NGN';
  vendorName: string; vendorAccountMasked: string; payoutRef?: string; store?: string; shoppingList: string;
}
export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export interface Vendor {
  id: string; ownerUserId: string; businessName: string; rcNumber?: string; category?: string; area?: string;
  description?: string; logoUrl?: string; status: VendorStatus; shopLat?: number; shopLng?: number;
  account?: { bankCode: string; accountNumber: string; accountName: string };
  accountVerified: boolean; rejectionReason?: string; approvedAt?: number; createdAt: number;
}
export interface Product {
  id: string; vendorId: string; name: string; priceMinor: number; description?: string;
  photoUrls?: string[]; available: boolean; createdAt: number;
}
export interface VendorOrder {
  id: string; status: string; createdAt: string; goodsMinor: number; deliveryFeeMinor: number;
  items: string; customerName?: string; vendorPaidAt?: number; vendorPayoutRef?: string;
}
export interface GeoPoint { lat: number; lng: number }
export interface Quote { quoteToken: string; amountMinor: number; currency: 'NGN'; breakdown: {
  baseMinor: number; distanceMinor: number; timeMinor: number; platformFeeMinor: number; totalMinor: number } }
// #4 MULTI-STOP: the customer-supplied metadata for one EXTRA drop-off, paired BY INDEX to the quote
// `stops` points (the point itself is authoritative from the signed quote, never sent here).
export interface ExtraStopInput {
  recipient?: { name: string; phone: string };
  item?: string;
  instructions?: string;
  address?: string;
  area?: string;
}
// #4 MULTI-STOP: an extra drop-off as returned on the Job (no codes — those are shown once on create).
// `recipient.phone` is withheld from the rider until the parcel is in transit, so it's optional here.
export interface ExtraStop {
  point: GeoPoint;
  status: 'PENDING' | 'DELIVERED';
  deliveredAt?: number;
  address?: string;
  area?: string;
  recipient?: { name: string; phone?: string };
  item?: string;
  instructions?: string;
}
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
  // The platform's cut of `amountMinor`. A RIDER's take-home is amountMinor - platformFeeMinor
  // (use riderNet()); the customer is charged the full amountMinor.
  platformFeeMinor?: number;
  // #4 MULTI-STOP: extra ordered drop-offs after the primary dropoff (absent on single-stop jobs),
  // plus the timestamp the primary drop-off (stop #1) was confirmed.
  extraStops?: ExtraStop[];
  primaryStopDeliveredAt?: number;
  errand?: ErrandDetails; // ERRAND ("buy-for-me"): present only for type ERRAND
}

/** A rider's take-home for a job: the customer's charge minus the platform fee. Never show gross to riders. */
export function riderNet(amountMinor: number, platformFeeMinor?: number): number {
  return Math.max(0, amountMinor - (platformFeeMinor ?? 0));
}
// #4 MULTI-STOP: createJob echoes the plaintext single-use code for each extra stop exactly once, for
// the booking customer to hand to each recipient (same one-time model as the primary delivery code).
export type CreatedJob = Job & { paymentLink?: string; extraStopCodes?: string[] };
export interface ChatMessage { id: string; jobId: string; senderId: string; body: string; replyToId?: string; audioUrl?: string; audioDurationMs?: number; imageUrl?: string; createdAt: number }
export interface AvailableJob {
  id: string; type: JobType; amountMinor: number; currency: 'NGN'; createdAt: string;
  pickupArea: string; dropoffArea: string; pickupApprox: { lat: number; lng: number };
  tripDistanceMeters: number; tripEtaMin: number;
  toPickupMeters?: number; toPickupEtaMin?: number;
  // #4 MULTI-STOP: total drop-offs (primary + extras); present only for multi-stop jobs (>1).
  stopCount?: number;
  // What the rider is actually paid (customer charge minus the platform fee). Riders see THIS, not gross.
  riderPayoutMinor: number;
}
export interface Notification { id: string; jobId?: string; title: string; body: string; createdAt: number; read: boolean }
export interface AdminQueueEntry { riderId: string; track: string | null; status: string; oldestPendingAt: number }
export interface AdminRiderDoc {
  id: string; type: string; label: string; status: string; version: number;
  rejectionReason?: string; issuedAt?: number; expiresAt?: number; previewUrl: string;
}
export interface EffectiveSettings { requireGuarantor: boolean; enforceRiderClearance: boolean; marketplaceEnabled: boolean; launchCity: string; overridden: { requireGuarantor: boolean; enforceRiderClearance: boolean; marketplaceEnabled: boolean; launchCity: boolean } }
export interface AdminOps { summary: { activeTotal: number; byStatus: Record<string, number> }; lateTotal: number; jobs: { id: string; status: string; type: string; late: boolean }[] }
export interface AdminDelivery { id: string; status: string; type: string; amountMinor: number; pickupArea?: string; dropoffArea?: string; createdAt: string; payoutPending?: boolean; payoutError?: string }
export interface AdminFinance { totals: { held: number; released: number; refunded: number; platformRevenue: number }; reconciliation: { inSync: boolean; drift: { held: number; released: number; refunded: number } } }
export interface PendingPayout { id: string; amountMinor: number; createdAt: string; payoutError?: string; payoutRef?: string; dropoffArea?: string; riderName?: string }
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
// `phone` is present only while the job is in flight, and only for the counterparty. `phoneMasked`
// says whether it is a proxy number — dial whatever is given and don't cache it.
// `callMode`: 'proxy' means masked in-app calling is live — request a call (server rings you) with no
// number exposed; 'direct' means fall back to a tel: link with `phone`.
export interface RiderSummary { name?: string; nameVerified: boolean; vehicleType: VehicleTrack | null; vehiclePlate?: string; vehicleColor?: string; rating?: number; ratingCount?: number; photoUrl?: string; phone?: string; phoneMasked?: boolean; callMode?: 'proxy' | 'direct'; callNumber?: string }
export interface PendingRating { jobId: string; amountMinor: number; createdAt: string; dropoffArea?: string; riderName?: string }
// ---- Support chat (#5 support + agent hand-off, #6 per-trip support) ----
export type SupportCategory = 'PAYMENT' | 'DELIVERY_ISSUE' | 'CONDUCT' | 'ACCOUNT' | 'APP_ISSUE' | 'OTHER';
export type SupportStatus = 'BOT' | 'AWAITING_AGENT' | 'AGENT_JOINED' | 'RESOLVED';
export interface SupportThread {
  id: string; userId: string; jobId?: string; category: SupportCategory; status: SupportStatus;
  agentId?: string; agentJoinDeadline?: number; createdAt: string; updatedAt: string;
}
export interface SupportMessage {
  id: string; threadId: string; sender: 'USER' | 'BOT' | 'AGENT'; senderId?: string; body: string; createdAt: string;
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
  // #4 MULTI-STOP: `stops` are optional EXTRA drop-off points (max 8) after the primary dropoff, in
  // order. Omitting them is a plain single-stop quote (unchanged); the fare reflects the full route.
  quote: (token: string, body: { type: JobType; pickup: GeoPoint; dropoff: GeoPoint; stops?: GeoPoint[] }) =>
    call<Quote>(`/jobs/quote`, { method: 'POST', token, body: JSON.stringify(body) }),
  createJob: (token: string, body: {
    quoteToken: string; refundAccountId?: string;
    customerName?: string; recipient?: { name: string; phone: string }; item?: string; weightKg?: number; instructions?: string;
    pickupAddress?: string; dropoffAddress?: string; pickupArea?: string; dropoffArea?: string;
    fallbackPolicy?: 'WAIT' | 'DELEGATE' | 'RETURN';
    // #4 MULTI-STOP: per-stop metadata in the SAME order & count as the signed quote `stops` (points
    // come from the quote). Omit for single-stop deliveries. Response adds `extraStopCodes`.
    extraStops?: ExtraStopInput[];
  }) =>
    call<CreatedJob>(`/jobs`, {
      method: 'POST', token,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  // ERRAND ("buy-for-me"): create the errand (store->customer trip + goods amount held for the vendor).
  createErrand: (token: string, body: {
    quoteToken: string; goodsMinor: number; shoppingList: string;
    storeName?: string; storeArea?: string; storeAddress?: string; dropoffAddress?: string; dropoffArea?: string;
    customerName?: string; returnUrl?: string;
  }) => call<Job & { paymentLink?: string }>(`/jobs/errand`, { method: 'POST', token, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) }),
  errandVendorAccount: (token: string, id: string, bankCode: string, accountNumber: string) =>
    call<{ accountName: string; match: boolean }>(`/jobs/${id}/errand/vendor-account`, { method: 'POST', token, body: JSON.stringify({ bankCode, accountNumber }) }),
  errandApproveVendor: (token: string, id: string) =>
    call<{ paidPending: boolean }>(`/jobs/${id}/errand/approve-vendor`, { method: 'POST', token }),
  // ERRAND top-up: rider flags the shop is more expensive; customer adds the extra through the app.
  errandRequestTopUp: (token: string, id: string, additionalMinor: number) =>
    call<{ requestedTopUpMinor: number }>(`/jobs/${id}/errand/request-topup`, { method: 'POST', token, body: JSON.stringify({ additionalMinor }) }),
  errandStartTopUp: (token: string, id: string, returnUrl?: string) =>
    call<{ paymentLink: string; amountMinor: number }>(`/jobs/${id}/errand/start-topup`, { method: 'POST', token, body: JSON.stringify({ returnUrl }) }),
  errandConfirmTopUp: (token: string, id: string, transactionId: string) =>
    call<{ funded: boolean; goodsMinor: number }>(`/jobs/${id}/errand/confirm-topup`, { method: 'POST', token, body: JSON.stringify({ transactionId }) }),
  errandReceipt: (token: string, id: string) => call<ErrandReceipt>(`/jobs/${id}/errand/receipt`, { token }),
  getJob: (token: string, id: string) => call<Job>(`/jobs/${id}`, { token }),
  confirmCode: (token: string, id: string, code: string) =>
    call<{ status: string }>(`/jobs/${id}/confirm-code`, {
      method: 'POST', token, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ code }),
    }),
  // #4 MULTI-STOP: rider confirms an EXTRA drop-off (0-based index within extraStops) with the stop's
  // recipient code + a GPS fix. Returns EN_ROUTE_STOP while stops remain, or RELEASED on the final one.
  confirmStop: (token: string, id: string, index: number, body: { code: string; lat: number; lng: number; accuracyM?: number }) =>
    call<{ status: string }>(`/jobs/${id}/stops/${index}/confirm-code`, {
      method: 'POST', token, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body),
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
  // #4 MULTI-STOP: customer re-reveals an extra stop's code (0-based index within extraStops).
  issueStopCode: (token: string, id: string, index: number) => call<{ code: string }>(`/jobs/${id}/stops/${index}/code`, { method: 'POST', token }),
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
  sendMessage: (token: string, id: string, body: string, replyToId?: string, audio?: { audioKey?: string; audioDurationMs?: number }, imageKey?: string) =>
    call<ChatMessage>(`/jobs/${id}/messages`, { method: 'POST', token, body: JSON.stringify({
      ...(body ? { body } : {}),
      ...(replyToId ? { replyToId } : {}),
      ...(audio?.audioKey ? { audioKey: audio.audioKey } : {}),
      ...(audio?.audioDurationMs != null ? { audioDurationMs: audio.audioDurationMs } : {}),
      ...(imageKey ? { imageKey } : {}),
    }) }),
  // Voice notes: presigned upload URL, PUT the blob, then sendMessage with the returned key.
  chatAudioUploadUrl: (token: string, id: string, contentType: string, sizeBytes: number) =>
    call<{ uploadUrl: string; key: string }>(`/jobs/${id}/messages/audio-upload-url`, { method: 'POST', token, body: JSON.stringify({ contentType, sizeBytes }) }),
  // Photos: presigned upload URL, PUT the file, then sendMessage with the returned key.
  chatImageUploadUrl: (token: string, id: string, contentType: string, sizeBytes: number) =>
    call<{ uploadUrl: string; key: string }>(`/jobs/${id}/messages/image-upload-url`, { method: 'POST', token, body: JSON.stringify({ contentType, sizeBytes }) }),
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
  jobCustomer: (token: string, id: string) => call<{ name?: string; photoUrl?: string; phone?: string; phoneMasked?: boolean; callMode?: 'proxy' | 'direct' }>(`/jobs/${id}/customer`, { token }),
  // Masked in-app call: server rings the caller then bridges to the counterparty. No number returned.
  requestCall: (token: string, id: string) => call<{ status: string }>(`/jobs/${id}/call`, { token, method: 'POST' }),
  avatarUploadUrl: (token: string, contentType: string, sizeBytes: number) => call<{ uploadUrl: string }>(`/me/avatar/upload-url`, { method: 'POST', token, body: JSON.stringify({ contentType, sizeBytes }) }),
  myAvatar: (token: string) => call<{ photoUrl: string | null }>(`/me/avatar`, { token }),
  me: (token: string) => call<{ id: string; phone: string | null }>(`/me`, { token }),
  deleteAccount: (token: string) => call<{ deleted: boolean }>(`/me`, { method: 'DELETE', token }),
  pendingRatings: (token: string) => call<PendingRating[]>(`/jobs/pending-ratings`, { token }),
  rateJob: (token: string, id: string, body: { stars: number; comment?: string }) =>
    call<{ id: string }>(`/jobs/${id}/rating`, { method: 'POST', token, body: JSON.stringify(body) }),
  adminVerifyRiderName: (token: string, riderId: string, verified: boolean) =>
    call<{ ok?: boolean }>(`/admin/documents/riders/${riderId}/verify-name`, { method: 'POST', token, body: JSON.stringify({ verified }) }),
  adminSettings: (token: string) => call<EffectiveSettings>(`/admin/settings`, { token }),
  adminUpdateSettings: (token: string, patch: Partial<Pick<EffectiveSettings, 'requireGuarantor' | 'enforceRiderClearance' | 'marketplaceEnabled' | 'launchCity'>>) =>
    call<EffectiveSettings>(`/admin/settings`, { method: 'PUT', token, body: JSON.stringify(patch) }),
  publicConfig: () => call<{ marketplaceEnabled: boolean }>(`/config`),
  adminOps: (token: string) => call<AdminOps>(`/admin/ops/jobs/active`, { token }),
  adminDeliveries: (token: string) => call<AdminDelivery[]>(`/admin/ops/deliveries`, { token }),
  adminFinance: (token: string) => call<AdminFinance>(`/admin/finance/reconciliation`, { token }),
  adminPendingPayouts: (token: string) => call<PendingPayout[]>(`/admin/finance/payouts/pending`, { token }),
  adminRetryPayout: (token: string, jobId: string, force = false) =>
    call<{ payoutPending: boolean; payoutError?: string }>(`/admin/finance/payouts/${jobId}/retry${force ? '?force=true' : ''}`, { method: 'POST', token }),
  adminTransferStatus: (token: string, jobId: string) =>
    call<{ jobId: string; payoutRef?: string; status: string; reason?: string }>(`/admin/finance/payouts/${jobId}/transfer-status`, { token }),
  adminResendPayout: (token: string, jobId: string) =>
    call<{ outcome: string; providerStatus: string; amountMinor?: number }>(`/admin/finance/payouts/${jobId}/resend`, { method: 'POST', token }),
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
  // ---- Support chat: user (any signed-in user) ----
  startSupportThread: (token: string, body: { category: SupportCategory; jobId?: string }) =>
    call<SupportThread>(`/support/threads`, { method: 'POST', token, body: JSON.stringify(body) }),
  answerSupport: (token: string, id: string, answer: string) =>
    call<{ thread: SupportThread; messages: SupportMessage[] }>(`/support/threads/${id}/answer`, { method: 'POST', token, body: JSON.stringify({ answer }) }),
  postSupportMessage: (token: string, id: string, body: string) =>
    call<SupportMessage>(`/support/threads/${id}/messages`, { method: 'POST', token, body: JSON.stringify({ body }) }),
  mySupportThreads: (token: string) => call<SupportThread[]>(`/support/threads`, { token }),
  supportMessages: (token: string, id: string) => call<SupportMessage[]>(`/support/threads/${id}/messages`, { token }),
  // ---- Support chat: agent (admin with SUPPORT scope) ----
  agentSupportThreads: (token: string) => call<SupportThread[]>(`/support/agent/threads`, { token }),
  agentSupportMessages: (token: string, id: string) =>
    call<{ thread: SupportThread; messages: SupportMessage[] }>(`/support/agent/threads/${id}/messages`, { token }),
  agentReply: (token: string, id: string, body: string) =>
    call<SupportMessage>(`/support/agent/threads/${id}/reply`, { method: 'POST', token, body: JSON.stringify({ body }) }),
  agentResolve: (token: string, id: string) =>
    call<SupportThread>(`/support/agent/threads/${id}/resolve`, { method: 'POST', token }),
  // ---- Vendors (marketplace) ----
  myVendor: (token: string) => call<Vendor | null>(`/vendors/me`, { token }),
  registerVendor: (token: string, body: { businessName: string; rcNumber?: string; category?: string; area?: string; description?: string }) =>
    call<Vendor>(`/vendors`, { method: 'POST', token, body: JSON.stringify(body) }),
  updateVendor: (token: string, body: { businessName?: string; rcNumber?: string; category?: string; area?: string; description?: string; logoKey?: string; shopLat?: number; shopLng?: number }) =>
    call<Vendor>(`/vendors/me`, { method: 'PATCH', token, body: JSON.stringify(body) }),
  vendorLogoUploadUrl: (token: string, contentType: string, sizeBytes: number) =>
    call<{ uploadUrl: string; key: string }>(`/vendors/me/logo-upload-url`, { method: 'POST', token, body: JSON.stringify({ contentType, sizeBytes }) }),
  vendorBusinessAccount: (token: string, bankCode: string, accountNumber: string) =>
    call<{ accountName: string; match: boolean }>(`/vendors/me/business-account`, { method: 'POST', token, body: JSON.stringify({ bankCode, accountNumber }) }),
  myProducts: (token: string) => call<Product[]>(`/vendors/me/products`, { token }),
  addProduct: (token: string, body: { name: string; priceMinor: number; description?: string; photoKeys?: string[]; available?: boolean }) =>
    call<Product>(`/vendors/me/products`, { method: 'POST', token, body: JSON.stringify(body) }),
  updateProduct: (token: string, productId: string, body: { name?: string; priceMinor?: number; description?: string; photoKeys?: string[]; available?: boolean }) =>
    call<Product>(`/vendors/me/products/${productId}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
  removeProduct: (token: string, productId: string) =>
    call<{ removed: boolean }>(`/vendors/me/products/${productId}`, { method: 'DELETE', token }),
  productPhotoUploadUrl: (token: string, contentType: string, sizeBytes: number) =>
    call<{ uploadUrl: string; key: string }>(`/vendors/me/products/photo-upload-url`, { method: 'POST', token, body: JSON.stringify({ contentType, sizeBytes }) }),
  vendors: (token: string) => call<Vendor[]>(`/vendors`, { token }),
  vendor: (token: string, id: string) => call<Vendor>(`/vendors/${id}`, { token }),
  vendorProducts: (token: string, id: string) => call<Product[]>(`/vendors/${id}/products`, { token }),
  createMarketplaceOrder: (token: string, body: { vendorId: string; items: { productId: string; quantity: number }[]; quoteToken: string; dropoffAddress?: string; dropoffArea?: string; customerName?: string; returnUrl?: string }) =>
    call<Job & { paymentLink?: string }>(`/jobs/marketplace`, { method: 'POST', token, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) }),
  vendorOrders: (token: string) => call<VendorOrder[]>(`/jobs/vendor-orders`, { token }),
  // ---- Admin: vendor approval ----
  adminPendingVendors: (token: string) => call<Vendor[]>(`/admin/vendors/pending`, { token }),
  adminApproveVendor: (token: string, id: string) => call<Vendor>(`/admin/vendors/${id}/approve`, { method: 'POST', token }),
  adminRejectVendor: (token: string, id: string, reason: string) =>
    call<Vendor>(`/admin/vendors/${id}/reject`, { method: 'POST', token, body: JSON.stringify({ reason }) }),
  adminSuspendVendor: (token: string, id: string) => call<Vendor>(`/admin/vendors/${id}/suspend`, { method: 'POST', token }),
};
