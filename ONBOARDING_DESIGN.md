## Trilogy Onboarding & Funnel Design (Conversion-First)

### Goals
- Maximize conversion from first landing to paid subscription
- Demonstrate value early (plan + sample iMessage) before heavy asks
- Maintain resilience: reload-safe, resume-safe, idempotent APIs

### Non-Goals
- Deep financial coaching or complex ML scoring (simple, deterministic rules only)
- Collecting free-text PII in quiz responses

### Success Metrics (primary)
- profile_collected → quiz_complete conversion target ≥ 90%
- quiz_complete → analysis_complete target ≥ 95%
- analysis_complete → checkout_started target ≥ 50%
- checkout_started → subscribed target ≥ 40%
- subscribed → plaid_connected target ≥ 70% (for plaid-first variant this is measured before checkout)

### High-level Flow
1) Profile: name, email (required), timezone → onboardingStatus=profile_collected
2) Quiz (11 micro-questions): feelings/goals/behaviors → onboardingStatus=quiz_complete
3) Analyzing: 5–7s staged loader; compute summary → onboardingStatus=analysis_complete
4) Plan: 3 specific benefits + weekly cadence; “Send me a sample” → next step
5) Plaid connect → onboardingStatus=plaid_connected → Stripe checkout → onboardingStatus=subscribed
6) Dashboard: accounts, subscription (manage billing), settings, pause texts, delete data

Experimentation can be added later if needed (Stripe-first vs Plaid-first).

### State Machine (authoritative gate)
- pre_auth → profile_collected → quiz_complete → analysis_complete → plaid_connected → subscribed → complete
- Guards:
  - If user visits a later step, redirect forward/back to the correct next step based on status
  - Steps are idempotent; writing the same answers or analysis twice is safe

### Data Model (Prisma)
- User (add fields)
  - quizAnswers Json?            // compact enums only
  - analysisSummary Json?        // { score, bullets[], cadence: 'weekly', time: 'HH:mm', tz: 'America/New_York' }
  - stripeCustomerId String?
  - stripeSubscriptionId String?
  - stripePriceId String?
  - billingStatus String?        // trialing | active | incomplete | canceled
  - onboardingStatus String @default("pre_auth")

No schema migration is included in this doc; confirm fields match current repo before pushing.

### Quiz (11 questions)
Enums only; large, tappable options. One per screen; group 2 easy questions mid-flow to feel like ~7 steps.
- Confidence today: 1–5
- Stress about money: 1–5
- Primary goal: debt | emergency_fund | invest | automate_bills | control_spending
- Target timeline: 3m | 6m | 12m | 24m
- Paycheck stability: stable | variable | unpredictable
- Debt presence: none | student | credit | auto | other
- Savings cushion: none | lt_1m | m_1_3 | m_3_6 | gt_6m
- Tracking method: none | spreadsheets | app | mental
- Overspending frequency: never | rarely | sometimes | often
- Bill autopay usage: none | some | most | all
- Investing comfort: novice | intermediate | advanced

Client behavior: cache interim answers in sessionStorage; on Finish POST final payload.

### Analysis (simple, believable rules)
- Score 0–100 via weighted sum of answers
- 3 personalized bullets from rules, e.g.:
  - “Automate minimum debt payments this week to avoid fees”
  - “Build your 1‑month cushion by $X/mo”
  - “Weekly nudge at 9:00 AM keeps you consistent”
- Cadence: weekly; suggested time defaults to `User.preferredTime` (09:00) and shows local TZ abbreviation via `getTimezoneAbbreviation`.

### Pages (App Router)
- `app/onboard/quiz/page.tsx`
  - 11-step wizard, progress bar, Back/Next, validations, save on Finish
- `app/onboard/analyzing/page.tsx`
  - 5–7s staged loader phrases; POST analyze; then route → plan
- `app/onboard/plan/page.tsx`
  - Show analysis bullets, cadence, sample CTA (“Send me a sample iMessage”), primary CTA based on A/B variant
- `app/onboard/connect/page.tsx`
  - Plaid Link, success → update status, continue
- `app/onboard/checkout/page.tsx`
  - Create Stripe Checkout Session; redirect; success sets subscribed
- `app/dashboard/page.tsx` (enhanced)
  - Accounts list, subscription status + manage billing, settings (name/email/timezone), preferred send time, pause, delete account

Each page reads `onboardingStatus` and redirects to the correct next step.

### API Contracts (Zod-validated)
- POST `/api/onboard/quiz`
  - Req: `{ phone: string, answers: { q1: enum, ..., q11: enum }, version: 1 }`
  - Res: `{ ok: true, next: "/onboard/analyzing" }`
  - Side‑effects: saves `quizAnswers`, sets `onboardingStatus=quiz_complete` (idempotent)

- POST `/api/onboard/analyze`
  - Req: `{ phone: string }`
  - Res: `{ ok: true, summary: { score: number, bullets: string[], cadence: 'weekly', time: 'HH:mm', tz: string }, next: "/onboard/plan" }`
  - Side‑effects: saves `analysisSummary`, sets `onboardingStatus=analysis_complete`

- POST `/api/stripe/checkout`
  - Req: `{ phone: string, priceId?: string, successUrl?: string, cancelUrl?: string }`
  - Res: `{ url: string, sessionId: string }`
  - Side‑effects: ensures Stripe customer; associates price; emits analytics `checkout_opened`

- POST `/api/stripe/portal`
  - Req: `{ phone: string, returnUrl?: string }`
  - Res: `{ url: string }`

- DELETE `/api/users/delete`
  - Req: `{ phone: string, hard?: boolean }`
  - Res: `{ ok: true }`
  - Side‑effects: cascades delete of PlaidAccount, Message, MagicLink

Existing endpoints reused:
- Plaid token exchange endpoints already present in repo
- `app/api/onboard/update` (Step A) validates and stores name/email/timezone

### Experimentation (later)
- Keep the door open to add a Stripe-first variant; for now we use Plaid-first as default.

### Conversion Enhancers
- Upfront time expectation: “~90 seconds” on quiz intro
- Staged loader with credible tasks
- Plan includes “Send me a sample iMessage now” button (uses Blooio `sendMessage`)
- Trust copy near CTAs: “Cancel anytime”, “Data encrypted”, “Reply STOP to pause”
- If Plaid fails or is skipped, continue to next step; don’t dead‑end

### Copy Notes (short, direct)
- Quiz questions written in lowercase, empathetic tone
- Plan bullets: action‑able, 7–12 words each
- Confirmation microcopy: “nice. you’re set.”; “we’ll text you weekly at 9:00 am (edt)”

### Security & Privacy
- Quiz answers are enums only; no free‑text
- No PII in logs; continue AES‑256‑GCM for sensitive fields
- Delete endpoint fully purges data (or soft‑delete + background purge)

### Error States & Recovery
- Quiz POST failure → retry with toast; progress preserved client‑side
- Analyze POST failure → allow “try again” or proceed with default template plan
- Plaid linking canceled → route back to plan with “we’ll remind you weekly; link anytime in dashboard”
- Stripe incomplete → banner on dashboard to resume checkout

### Analytics (event map)
- profile_collected, quiz_started, quiz_qN_answered, quiz_complete
- analysis_started, analysis_complete, sample_sent
- plaid_opened, plaid_success, plaid_fail, plaid_skipped
- checkout_opened, checkout_success, checkout_abandon
- dashboard_first_visit
Each includes: variant, timeOnStep, device, timezone abbrev.

### Rollout Plan (review after each phase)
1) Skeleton pages and status guards (no logic) → review UX flow
2) Quiz UI + `/api/onboard/quiz` (Zod, idempotent) → review
3) Analyze loader + `/api/onboard/analyze` (deterministic scoring) → review
4) Plan screen + “Send sample” (Blooio) → review copy
5) Plaid connect wiring + status update → review success/failure paths
6) Stripe checkout + portal → review success and cancel flows
7) Dashboard enhancements (accounts, billing, settings, delete) → review
8) A/B switch + analytics events → review and choose final order

### Acceptance Criteria
- Status transitions reflect real progress and are reload‑safe
- Quiz cannot advance without an answer; final answers persist in DB
- Analysis produces stable bullets and cadence; shows local TZ (EDT/EST)
- Plan CTAs work; sample message sends immediately
- Plaid successfully links; accounts visible in dashboard
- Stripe payment returns active subscription and “Manage billing” works
- Dashboard supports pause texts, edit settings, and delete data

### Risks & Mitigations
- Long flow → group easy questions; progress bar; sample iMessage; skip Plaid option
- Network flakiness → idempotent APIs; optimistic UI; retries
- Plaid errors → non‑blocking; resume prompts in dashboard
- Payment drop‑off → guarantee copy; easy cancel; portal link prominent

### Open Questions
- Pricing strategy (trial vs. immediate charge); `STRIPE_PRICE_ID` variants
- Whether to send onboarding reminders via iMessage for partial progress (opt‑in copy)
- Additional plan personalization dimensions (later)


