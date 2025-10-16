# Trilogy - Complete Rebuild Specification

## Product Overview

**Name:** Trilogy (formerly 3Numbers)  
**Tagline:** your money's personal assistant.  
**Value Prop:** Daily SMS with 3 numbers (balance, yesterday's spending, this week's spending). No app to open. Just awareness.

---

## Core User Flow (MVP)

### 1. Landing Page (Public)
- Hero with value prop + iPhone mockup
- Explain the 3 numbers
- How it works (3 steps)
- Why this works
- CTA: "text to join 💬" → sign up

### 2. Sign Up Flow
```
User clicks "text to join" 
→ Clerk sign up (email/phone)
→ Redirect to onboarding
```

### 3. Onboarding (4 Simple Steps)
```
Step 1: Welcome screen
  - "let's get you set up"
  - Button: "let's go"

Step 2: Connect bank
  - "connect your bank account"
  - Plaid Link button
  - Skip option (but encourage completion)

Step 3: Choose time
  - "when do you want your daily text?"
  - Time picker (default: 9:00 AM)
  - Timezone auto-detected

Step 4: Phone number
  - "where should we text you?"
  - Phone input (pre-filled from Clerk if available)
  - Button: "start getting texts"
```

### 4. Dashboard
```
Clean, simple dashboard showing:
- Next text scheduled for: [time]
- Preview of what today's text looks like
- Settings:
  - Change time
  - Update phone number
  - Reconnect bank (if needed)
  - Pause texts
  - Delete account
```

### 5. Daily SMS (Automated)
```
Cron job runs daily at user's preferred time
→ Fetch latest Plaid data
→ Calculate 3 numbers
→ Send via Blooio
→ Log delivery status
```

---

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (minimal usage)
- **Auth:** Clerk

### Backend
- **API:** Next.js API routes
- **Database:** PostgreSQL + Prisma
- **Cron:** Vercel Cron or dedicated service
- **Bank Integration:** Plaid
- **SMS:** Blooio

### Infrastructure
- **Hosting:** Vercel
- **Database:** Supabase or Neon
- **Secrets:** Vercel env vars

---

## Design System

### Visual Identity
- **Background:** Pure white (`bg-white`)
- **Primary Color:** `indigo-600` (buttons, accents)
- **Secondary Colors:** `purple-600`, `blue-600` (step badges)
- **Typography:** ALL LOWERCASE everywhere
- **Tone:** Conversational, friendly, slightly playful

### Typography
```css
Headlines: text-5xl sm:text-6xl lg:text-7xl font-bold lowercase text-gray-900
Subheads: text-xl sm:text-2xl text-gray-600 lowercase
Body: text-lg sm:text-xl text-gray-700 lowercase
Small: text-sm text-gray-500 lowercase
```

### Colors
```
Primary: indigo-600
Secondary: purple-600, blue-600
Text: gray-900 (headlines), gray-600 (body), gray-500 (helper)
Backgrounds: white, gray-50 (alternating)
Borders: gray-200
```

### Components

**Button (Primary CTA)**
```tsx
className="inline-flex px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg hover:shadow-xl hover:-translate-y-0.5"
```

**Button (Secondary)**
```tsx
className="px-8 py-4 text-lg font-medium rounded-full border-2 border-gray-300 text-gray-700 hover:border-indigo-600 hover:text-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase"
```

**Input Field**
```tsx
className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 outline-none transition-all lowercase"
```

**Card**
```tsx
className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm"
```

**Number Badge**
```tsx
className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold"
```

**Badge/Pill**
```tsx
className="inline-block px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-sm text-indigo-600 font-medium lowercase"
```

### Layout
- **Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- **Section spacing:** `py-16 sm:py-24`
- **Alternating backgrounds:** white → gray-50 → white

---

## Database Schema

```prisma
model User {
  id                String   @id @default(cuid())
  clerkId           String   @unique
  email             String   @unique
  phoneNumber       String?
  
  // Preferences
  preferredTime     String   @default("09:00") // HH:mm format
  timezone          String   @default("America/Los_Angeles")
  isActive          Boolean  @default(true)
  
  // Plaid
  plaidAccessToken  String?  @db.Text // Encrypted
  plaidItemId       String?
  plaidAccountId    String?  // Primary checking account
  
  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  lastSmsAt         DateTime?
  
  // Relations
  smsLogs           SmsLog[]
}

model SmsLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Content
  balance     Float
  yesterday   Float
  thisWeek    Float
  message     String   @db.Text
  
  // Status
  status      String   // sent, failed, pending
  provider    String   @default("blooio")
  providerId  String?
  
  // Metadata
  sentAt      DateTime @default(now())
  error       String?  @db.Text
  
  @@index([userId])
  @@index([sentAt])
}

model PlaidWebhook {
  id          String   @id @default(cuid())
  webhookType String
  itemId      String
  payload     Json
  processed   Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  @@index([itemId])
  @@index([processed])
}
```

---

## API Endpoints

### Public Routes
```
GET  /                          - Landing page
GET  /signin                    - Sign in page
GET  /signup                    - Sign up page
```

### Protected Routes (requires auth)
```
GET  /onboarding                - Onboarding start
GET  /onboarding/1              - Welcome
GET  /onboarding/2              - Connect bank
GET  /onboarding/3              - Choose time
GET  /onboarding/4              - Phone number
GET  /dashboard                 - Main dashboard

POST /api/users                 - Create/update user
GET  /api/users                 - Get current user

POST /api/plaid/link-token      - Create Plaid Link token
POST /api/plaid/exchange-token  - Exchange public token
POST /api/plaid/webhook         - Plaid webhook handler

POST /api/sms/send-test         - Send test SMS
GET  /api/daily-numbers         - Get user's current numbers

POST /api/sync-user             - Manual sync (dev only)
```

### Cron Routes
```
GET  /api/cron/send-daily-sms   - Trigger daily SMS for all users
```

---

## Key Features & Logic

### 1. Plaid Integration
```typescript
// On onboarding step 2
- Generate Plaid Link token
- User connects bank via Plaid Link
- Exchange public_token for access_token
- Store encrypted access_token + itemId + accountId
- Fetch initial balance
```

### 2. Daily Numbers Calculation
```typescript
// Calculate 3 numbers
const balance = await getBalance(accessToken, accountId)
const yesterday = await getSpending(startOfYesterday, endOfYesterday)
const thisWeek = await getSpending(startOfWeek, now)

// Format message
const message = `checking in on you 👀

💰 chase checking:
$${balance.toFixed(2)}

💸 yesterday:
-$${yesterday.toFixed(2)}

📊 this week:
-$${thisWeek.toFixed(2)}

${getPlayfulComment(yesterday, thisWeek)}`
```

### 3. SMS Sending (Blooio)
```typescript
// Use Blooio API
await fetch('https://api.blooio.com/v1/sms/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${BLOOIO_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: user.phoneNumber,
    message: formattedMessage,
  })
})
```

### 4. Cron Job Logic
```typescript
// Run at every minute (check if user needs SMS)
const users = await db.user.findMany({
  where: {
    isActive: true,
    plaidAccessToken: { not: null },
    phoneNumber: { not: null },
  }
})

for (const user of users) {
  const userTime = new Date().toLocaleTimeString('en-US', {
    timeZone: user.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  if (userTime === user.preferredTime) {
    await sendDailyNumbers(user)
  }
}
```

---

## Onboarding Flow (Detailed)

### Step 1: Welcome
```tsx
<div className="text-center space-y-8">
  <h1 className="text-5xl font-bold lowercase">
    let's get you set up
  </h1>
  <p className="text-xl text-gray-600 lowercase">
    takes about 2 minutes. you'll love it.
  </p>
  <button>let's go</button>
</div>
```

### Step 2: Connect Bank
```tsx
<div className="text-center space-y-8">
  <h1 className="text-4xl font-bold lowercase">
    connect your bank account
  </h1>
  <p className="text-xl text-gray-600 lowercase">
    we use plaid. bank-level security. read-only access.
  </p>
  <PlaidLinkButton />
  <button variant="ghost">skip for now</button>
</div>
```

### Step 3: Choose Time
```tsx
<div className="text-center space-y-8">
  <h1 className="text-4xl font-bold lowercase">
    when do you want your daily text?
  </h1>
  <TimePicker defaultValue="09:00" />
  <p className="text-sm text-gray-500 lowercase">
    you can change this anytime
  </p>
  <button>continue</button>
</div>
```

### Step 4: Phone Number
```tsx
<div className="text-center space-y-8">
  <h1 className="text-4xl font-bold lowercase">
    where should we text you?
  </h1>
  <input type="tel" placeholder="+1 (555) 123-4567" />
  <button>start getting texts</button>
</div>
```

---

## Dashboard Layout

```tsx
<div className="min-h-screen bg-white">
  <nav>
    {/* trilogy logo + user menu */}
  </nav>
  
  <main className="max-w-4xl mx-auto px-4 py-16">
    {/* Next text */}
    <Card>
      <h2>next text scheduled for</h2>
      <p className="text-4xl">9:00 AM</p>
      <p>tomorrow morning</p>
    </Card>
    
    {/* Preview */}
    <Card>
      <h3>here's what it'll look like:</h3>
      <div className="bg-blue-500 rounded-3xl p-4 text-white">
        {/* SMS preview */}
      </div>
    </Card>
    
    {/* Settings */}
    <Card>
      <h3>settings</h3>
      <button>change time</button>
      <button>update phone number</button>
      <button>reconnect bank</button>
      <button>pause texts</button>
      <button variant="destructive">delete account</button>
    </Card>
  </main>
</div>
```

---

## Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/signin
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Database
DATABASE_URL=

# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox  # or production
NEXT_PUBLIC_PLAID_ENV=sandbox

# Blooio
BLOOIO_API_KEY=

# Encryption
ENCRYPTION_KEY=  # 32-byte key for encrypting Plaid tokens

# Cron
CRON_SECRET=  # For authenticating cron requests
```

---

## Security Checklist

- [ ] Plaid access tokens encrypted at rest
- [ ] CRON_SECRET required for automated endpoints
- [ ] Rate limiting on all API endpoints
- [ ] Input validation on all user inputs
- [ ] Clerk webhooks validated
- [ ] Plaid webhooks validated
- [ ] No sensitive data in logs
- [ ] HTTPS only in production
- [ ] Proper CORS configuration

---

## Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up Next.js project
- [ ] Configure Tailwind + design system
- [ ] Set up Clerk auth
- [ ] Build landing page
- [ ] Build sign up/in flows

### Phase 2: Onboarding (Week 1-2)
- [ ] Build onboarding layouts (4 steps)
- [ ] Integrate Plaid Link
- [ ] Build time picker
- [ ] Build phone number input
- [ ] Save user preferences to DB

### Phase 3: Core Logic (Week 2)
- [ ] Set up Prisma + database
- [ ] Build Plaid token exchange
- [ ] Build daily numbers calculation
- [ ] Build SMS sending (Blooio)
- [ ] Test end-to-end flow

### Phase 4: Dashboard (Week 3)
- [ ] Build dashboard UI
- [ ] Show next scheduled text
- [ ] Preview functionality
- [ ] Settings panel
- [ ] Account management

### Phase 5: Automation (Week 3)
- [ ] Set up cron job
- [ ] Build user scheduling logic
- [ ] SMS logging
- [ ] Error handling + retry logic
- [ ] Monitoring

### Phase 6: Polish (Week 4)
- [ ] Mobile responsive testing
- [ ] Loading states
- [ ] Error messages
- [ ] Success toasts
- [ ] Edge case handling
- [ ] Performance optimization

---

## Success Metrics

### User Onboarding
- % who complete all 4 steps
- Time to complete onboarding
- Bank connection success rate

### Engagement
- Daily SMS delivery rate
- SMS open rate (if trackable)
- User retention (7-day, 30-day)
- Churn rate

### Technical
- SMS delivery latency
- Plaid sync errors
- Cron job reliability
- API response times

---

## Future Features (Post-MVP)

- Multiple bank accounts
- Custom SMS templates
- Weekly summaries
- Monthly reports
- Budget alerts ("you're over budget this week")
- Savings goals
- Split by category (dining, shopping, etc.)
- Referral program
- Family plans

---

## Final Notes

**Philosophy:**
- Keep it dead simple
- No feature bloat
- Just 3 numbers, that's it
- Conversational tone always
- Beautiful, minimal UI
- Fast, reliable, boring tech

**Non-negotiables:**
- Everything lowercase
- Clean white aesthetic
- No dark mode (for now)
- Mobile-first design
- Sub-2 minute onboarding
- Bank-level security

**When in doubt:**
- Make it simpler
- Remove features, don't add
- Ask: "Does this serve the core value prop?"
- If no, cut it

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Set up database
npx prisma generate
npx prisma db push

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

**Last Updated:** October 12, 2025  
**Version:** 1.0  
**Status:** Ready to build

