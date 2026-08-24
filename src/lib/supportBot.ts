/**
 * Client-side mirror of the support bot script.
 *
 * The backend seeds the BOT prompt messages into the thread, but it does NOT return the
 * tap-choice options in its payload — so we replicate the per-category option lists here to
 * render the tap buttons for each step. This MUST stay faithful to the backend flow.
 *
 * Source of truth: backend/src/modules/support/domain/support.ts (SCRIPTS). Keep in sync:
 * each category is one or two `choice` steps followed by a final `freetext` step. Answering
 * the free-text step completes the flow and escalates the thread to a human agent.
 */

export type SupportCategory =
  | 'PAYMENT'
  | 'DELIVERY_ISSUE'
  | 'CONDUCT'
  | 'ACCOUNT'
  | 'APP_ISSUE'
  | 'OTHER';

export type SupportStatus = 'BOT' | 'AWAITING_AGENT' | 'AGENT_JOINED' | 'RESOLVED';

export const SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  'PAYMENT', 'DELIVERY_ISSUE', 'CONDUCT', 'ACCOUNT', 'APP_ISSUE', 'OTHER',
];

/** Friendly labels for the category picker + thread headers. */
export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  PAYMENT: 'Payment',
  DELIVERY_ISSUE: 'Delivery issue',
  CONDUCT: 'Conduct or safety',
  ACCOUNT: 'Account',
  APP_ISSUE: 'App problem',
  OTHER: 'Something else',
};

/** One-line helper shown under each category in the picker. */
export const CATEGORY_HINTS: Record<SupportCategory, string> = {
  PAYMENT: 'Charges, refunds, wallet or payout',
  DELIVERY_ISSUE: 'A rider, item or drop-off problem',
  CONDUCT: 'Report behaviour or a safety concern',
  ACCOUNT: 'Login, verification or your details',
  APP_ISSUE: 'A bug, crash or something not loading',
  OTHER: 'Anything not covered above',
};

export interface BotStep {
  kind: 'choice' | 'freetext';
  prompt: string;
  options?: readonly string[];
}

/**
 * Mirrors backend SCRIPTS exactly (prompts + tap options, in order). See file header.
 */
const SCRIPTS: Readonly<Record<SupportCategory, readonly BotStep[]>> = {
  PAYMENT: [
    {
      kind: 'choice',
      prompt: 'Sorry about the wahala with payment. Which one is it?',
      options: ['I was charged but no delivery', 'Money removed twice', 'Refund never came', 'Wallet or payout issue'],
    },
    {
      kind: 'freetext',
      prompt: 'Got it. Please tell us exactly what happened — amount, date and anything else that can help us sort it fast.',
    },
  ],
  DELIVERY_ISSUE: [
    {
      kind: 'choice',
      prompt: 'Let’s look into your delivery. What went wrong?',
      options: ['Rider never showed up', 'Item arrived damaged', 'Wrong or missing item', 'Delivered to wrong place'],
    },
    {
      kind: 'choice',
      prompt: 'Thanks. Where is the delivery now?',
      options: ['Still not delivered', 'Already delivered', 'I’m not sure'],
    },
    {
      kind: 'freetext',
      prompt: 'Please describe the issue in your own words so an agent can help you quickly.',
    },
  ],
  CONDUCT: [
    {
      kind: 'choice',
      prompt: 'We take this serious. Who is the complaint about?',
      options: ['The rider', 'The customer', 'A recipient', 'Someone else'],
    },
    {
      kind: 'freetext',
      prompt: 'Please tell us what happened. Share as much detail as you can — we’ll review it carefully.',
    },
  ],
  ACCOUNT: [
    {
      kind: 'choice',
      prompt: 'Let’s sort your account. What do you need help with?',
      options: ['Can’t log in', 'Verification (KYC) issue', 'Change my details', 'Delete my account'],
    },
    {
      kind: 'freetext',
      prompt: 'Please describe the problem so we can help you get back on track.',
    },
  ],
  APP_ISSUE: [
    {
      kind: 'choice',
      prompt: 'Sorry the app is misbehaving. What are you seeing?',
      options: ['App keeps crashing', 'A screen is stuck', 'Something is not loading', 'Other bug'],
    },
    {
      kind: 'freetext',
      prompt: 'Please describe the problem — and if you can, tell us your phone model. It helps us fix it.',
    },
  ],
  OTHER: [
    {
      kind: 'freetext',
      prompt: 'No problem — tell us how we can help and an agent will get back to you.',
    },
  ],
};

/** The full step at an index, or undefined past the end. */
export function botStep(category: SupportCategory, step: number): BotStep | undefined {
  return SCRIPTS[category][step];
}

/**
 * The tap options for the step the user is currently answering (empty for the free-text step or
 * once the script is finished). `step` is zero-based.
 */
export function botFollowUps(category: SupportCategory, step: number): readonly string[] {
  const s = SCRIPTS[category][step];
  return s && s.kind === 'choice' && s.options ? s.options : [];
}

/** How many scripted steps a category has. */
export function scriptLength(category: SupportCategory): number {
  return SCRIPTS[category].length;
}

/**
 * How many steps the user has already answered, inferred from the thread's message history.
 * The backend records each user tap/answer as a USER message and each bot prompt as a BOT
 * message, so the number of USER messages equals the next step index the user must answer.
 */
export function answeredSteps(userMessageCount: number): number {
  return userMessageCount;
}
