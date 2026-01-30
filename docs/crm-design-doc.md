# Evergreen CRM - Design Document

## Overview

A lightweight CRM that uses Blooio to agentically book free classes via iMessage. Features automated follow-up sequences, AI-powered conversations, and a real-time Kanban dashboard.

**Stack:** Next.js 14 (App Router), Prisma, PostgreSQL, Tailwind, shadcn/ui, Blooio (iMessage), Calendly, OpenAI

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              VA / ADMIN                                     │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌───────────────────────┐                               │
│                    │   Kanban Dashboard    │                               │
│                    │   /crm                │                               │
│                    │   - Add leads         │                               │
│                    │   - View convos       │                               │
│                    │   - Manual messages   │                               │
│                    └───────────┬───────────┘                               │
│                                │                                           │
├────────────────────────────────┼───────────────────────────────────────────┤
│                         NEXT.JS BACKEND                                    │
│                                │                                           │
│    ┌───────────────────────────┼───────────────────────────────┐          │
│    │                           │                               │          │
│    ▼                           ▼                               ▼          │
│ ┌──────────────┐    ┌──────────────────┐           ┌──────────────────┐   │
│ │ /api/crm/*   │    │ /api/cron/       │           │ /api/webhooks/   │   │
│ │ CRUD leads   │    │ crm-followup     │           │ blooio           │   │
│ │ Send manual  │    │ (daily 10am)     │           │ (inbound msgs)   │   │
│ └──────┬───────┘    └────────┬─────────┘           └────────┬─────────┘   │
│        │                     │                              │             │
│        │                     ▼                              ▼             │
│        │            ┌──────────────────┐           ┌──────────────────┐   │
│        │            │ Sequence Engine  │           │ CRM Agent (LLM)  │   │
│        │            │ - Check step     │           │ - Conversational │   │
│        │            │ - Get template   │           │ - Calendly tool  │   │
│        └────────────┤ - Personalize    │           │ - Update status  │   │
│                     └────────┬─────────┘           └────────┬─────────┘   │
│                              │                              │             │
│                              ▼                              ▼             │
│                    ┌─────────────────────────────────────────┐            │
│                    │              BLOOIO (iMessage)          │            │
│                    └─────────────────────────────────────────┘            │
│                                                                           │
├───────────────────────────────────────────────────────────────────────────┤
│                            POSTGRES                                       │
│    ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│    │    Lead      │───▶│   LeadMessage    │    │    Sequence      │       │
│    └──────────────┘    └──────────────────┘    └──────────────────┘       │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │    CALENDLY      │
                         │  (booking link)  │
                         └──────────────────┘
```

---

## Data Models (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Lead {
  id              String        @id @default(cuid())
  phone           String        @unique
  name            String?
  email           String?
  
  // Pipeline
  status          String        @default("NEW")  // NEW, CONTACTED, REPLIED, BOOKED, ATTENDED, CONVERTED, LOST
  source          String?                        // instagram, referral, website, etc.
  notes           String?       @db.Text
  
  // Sequence tracking
  sequenceId      String?
  sequenceStep    Int           @default(0)
  lastContactedAt DateTime?
  lastReplyAt     DateTime?
  nextFollowUpAt  DateTime?
  pauseSequence   Boolean       @default(false)
  
  // Calendly
  calendlyEventId String?
  bookedAt        DateTime?
  eventTime       DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  messages        LeadMessage[]
  sequence        Sequence?     @relation(fields: [sequenceId], references: [id])

  @@index([status])
  @@index([nextFollowUpAt])
}

model LeadMessage {
  id          String   @id @default(cuid())
  leadId      String
  direction   String                           // inbound | outbound
  content     String   @db.Text
  isAutomated Boolean  @default(false)         // true = sequence/agent
  sentAt      DateTime @default(now())
  status      String   @default("sent")        // sent | delivered | read | failed
  providerId  String?
  
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  @@index([leadId, sentAt])
}

model Sequence {
  id          String   @id @default(cuid())
  name        String
  description String?
  steps       Json     // [{ day: 0, message: "hey {{name}}..." }, ...]
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  leads       Lead[]
}
```

---

## API Endpoints

### Lead Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/leads` | List all leads (with filters: status, source) |
| POST | `/api/crm/leads` | Create new lead |
| GET | `/api/crm/leads/[id]` | Get lead details + messages |
| PATCH | `/api/crm/leads/[id]` | Update lead |
| DELETE | `/api/crm/leads/[id]` | Delete lead |
| POST | `/api/crm/leads/[id]/send` | Send manual message |

### Sequences
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/sequences` | List all sequences |
| POST | `/api/crm/sequences` | Create sequence |

### Cron
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cron/crm-followup` | Run daily follow-ups (Vercel cron) |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/blooio` | Handle inbound messages |
| POST | `/api/webhooks/calendly` | Handle booking confirmations |

---

## Blooio Integration

### Send Message
```typescript
const BLOOIO_API_KEY = process.env.BLOOIO_API_KEY;
const BLOOIO_BASE_URL = 'https://backend.blooio.com/v1/api';

export async function sendMessage(to: string, body: string): Promise<{ id: string }> {
  const response = await fetch(`${BLOOIO_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BLOOIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, text: body }),
  });
  
  if (!response.ok) throw new Error(`Blooio error: ${response.status}`);
  return response.json();
}
```

### Webhook Payload (Inbound)
```typescript
interface BlooioWebhookEvent {
  event: 'message.received';
  message_id: string;
  external_id: string;     // Phone number (E.164)
  text: string;
  timestamp: number;
}
```

### Webhook Handler Logic
```typescript
// POST /api/webhooks/blooio
1. Verify signature (HMAC SHA256)
2. Parse event
3. If event === 'message.received':
   a. Check if phone exists in Lead table
   b. If lead exists:
      - Save message to LeadMessage
      - Update lead: lastReplyAt = now, status = 'REPLIED', pauseSequence = true
      - Route to CRM Agent for AI response
   c. If no lead: ignore or create new lead
```

---

## Sequence Engine

### Logic: Event-Driven + 24-Hour Bumps

The sequence is NOT a daily batch job. Instead:

1. **On lead creation** → Send first message immediately, set `nextFollowUpAt = now + 24 hours`
2. **On lead reply** → Pause sequence, agent takes over
3. **If no reply after 24 hours** → Send next message, reset `nextFollowUpAt = now + 24 hours`
4. **Sequence exhausted** → Mark as LOST or leave for manual review

### Flow Diagram
```
Lead Created
     │
     ▼
Send Message #1 ──────────────────┐
Set nextFollowUpAt = +24hr        │
     │                            │
     ▼                            │
┌─────────────────┐               │
│ Wait 24 hours   │◄──────────────┤
└────────┬────────┘               │
         │                        │
    ┌────┴────┐                   │
    ▼         ▼                   │
 Reply?     No Reply              │
    │         │                   │
    ▼         ▼                   │
 Pause     More steps?            │
 Sequence     │                   │
    │    ┌────┴────┐              │
    ▼    ▼         ▼              │
 Agent  Yes        No             │
 Takes  │          │              │
 Over   │          ▼              │
        │       Mark LOST         │
        │                         │
        └─────────────────────────┘
              (loop)
```

### Cron Job (Hourly Check)

Runs every hour to check for leads that need follow-up:

```typescript
// GET /api/cron/crm-followup
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find leads where 24 hours have passed since last contact with no reply
  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: { lte: new Date() },
      pauseSequence: false,
      status: { notIn: ['BOOKED', 'CONVERTED', 'LOST'] },
      // No reply since our last message
      OR: [
        { lastReplyAt: null },
        { lastReplyAt: { lt: prisma.lead.fields.lastContactedAt } },
      ],
    },
    include: { sequence: true },
  });

  let processed = 0;
  let exhausted = 0;

  for (const lead of leads) {
    if (!lead.sequence) continue;
    
    const steps = lead.sequence.steps as Array<{ step: number; message: string }>;
    const currentStep = steps[lead.sequenceStep];
    
    if (!currentStep) {
      // Sequence exhausted - no more messages to send
      await prisma.lead.update({
        where: { id: lead.id },
        data: { 
          status: 'LOST',
          nextFollowUpAt: null,
        },
      });
      exhausted++;
      continue;
    }

    // Personalize message
    const message = currentStep.message
      .replace(/\{\{name\}\}/g, lead.name?.split(' ')[0] || 'hey');

    // Send via Blooio
    const result = await sendMessage(lead.phone, message);

    // Save message
    await prisma.leadMessage.create({
      data: {
        leadId: lead.id,
        direction: 'outbound',
        content: message,
        isAutomated: true,
        providerId: result.id,
      },
    });

    // Update lead - next follow-up in 24 hours
    const hasMoreSteps = lead.sequenceStep + 1 < steps.length;
    
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        sequenceStep: lead.sequenceStep + 1,
        lastContactedAt: new Date(),
        nextFollowUpAt: hasMoreSteps ? addHours(new Date(), 24) : null,
        status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
      },
    });

    processed++;
  }

  return Response.json({ processed, exhausted });
}
```

### On Lead Creation (Send First Message Immediately)

```typescript
// In POST /api/crm/leads
export async function POST(req: Request) {
  const body = await req.json();
  
  // Get default sequence
  const sequence = await prisma.sequence.findFirst({ 
    where: { isActive: true } 
  });
  
  // Create lead
  const lead = await prisma.lead.create({
    data: {
      phone: body.phone,
      name: body.name,
      source: body.source,
      notes: body.notes,
      sequenceId: sequence?.id,
      sequenceStep: 0,
      status: 'NEW',
    },
  });

  // Send first message immediately if sequence exists
  if (sequence && body.sendFirstMessage !== false) {
    const steps = sequence.steps as Array<{ step: number; message: string }>;
    const firstMessage = steps[0]?.message
      .replace(/\{\{name\}\}/g, lead.name?.split(' ')[0] || 'hey');

    if (firstMessage) {
      const result = await sendMessage(lead.phone, firstMessage);
      
      await prisma.leadMessage.create({
        data: {
          leadId: lead.id,
          direction: 'outbound',
          content: firstMessage,
          isAutomated: true,
          providerId: result.id,
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          sequenceStep: 1,
          lastContactedAt: new Date(),
          nextFollowUpAt: addHours(new Date(), 24), // Check again in 24 hours
          status: 'CONTACTED',
        },
      });
    }
  }

  return Response.json(lead);
}
```

### On Lead Reply (Pause Sequence, Agent Takes Over)

```typescript
// In POST /api/webhooks/blooio (inbound message handler)

// After saving the inbound message...
await prisma.lead.update({
  where: { id: lead.id },
  data: {
    lastReplyAt: new Date(),
    status: 'REPLIED',
    pauseSequence: true,      // Stop automated follow-ups
    nextFollowUpAt: null,     // Clear the timer
  },
});

// Route to CRM agent for AI response
await handleCrmAgentResponse(lead, inboundText);
```

### Vercel Cron Config (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/crm-followup",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs every hour at minute 0. The cron checks `nextFollowUpAt` so it will only message leads whose 24-hour window has passed.

---

## CRM Agent

### System Prompt
```typescript
const CRM_SYSTEM_PROMPT = `You're a friendly assistant for Evergreen Prep helping book free trial classes.

Your goal: Help the parent book a free class by finding a time that works for them.

Context:
- Lead name: {{name}}
- Lead phone: {{phone}}
- Lead email: {{email}}
- Their notes: {{notes}}

Guidelines:
- Be warm, casual, helpful - sound like a real human texting
- Use all lowercase, minimal punctuation
- Occasionally include natural typos (1 in ~5 messages): "satruday" → "saturday*", "thats" instead of "that's", skip apostrophes
- When they express interest, use get_available_slots to find times
- Offer 2-3 specific options: "i have saturday at 10am or 2pm, or sunday at 11am - which works?"
- When they pick a time, use book_class to confirm it
- If hesitant, acknowledge and offer flexibility
- If they ask about pricing: "lets get you into a free class first and see if its a good fit!"
- If they say "stop", "unsubscribe", or "not interested", use mark_not_interested

Keep responses short (1-3 sentences). No emojis unless they use them first.

Examples of natural typing style:
- "hey! yeah we have saturday openings, 10am or 2pm work?"
- "awesome, ill get you booked for saturday at 2"
- "oh nice, satruday works great - 10 or 2?"
- "sounds good! youre all set for saturday at 10am"
- "haha totally get it, weekends are tough. we have sunday too if thats easier"`;
```

### Agent Tools
```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: 'Get available time slots from Calendly for the next 7 days. Call this when the lead wants to book or asks about availability.',
      parameters: { 
        type: 'object', 
        properties: {
          preferred_day: {
            type: 'string',
            description: 'Optional: filter by day of week (e.g., "saturday", "sunday")',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_class',
      description: 'Book a free class for the lead at the specified time. Call this when the lead confirms a time slot.',
      parameters: { 
        type: 'object', 
        properties: {
          slot_start_time: {
            type: 'string',
            description: 'The ISO 8601 start time of the slot to book (from get_available_slots)',
          },
        },
        required: ['slot_start_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_not_interested',
      description: 'Mark lead as not interested when they explicitly decline or say stop',
      parameters: { type: 'object', properties: {} },
    },
  },
];
```

### Tool Implementations
```typescript
// lib/crm/calendly.ts

const CALENDLY_API_KEY = process.env.CALENDLY_API_KEY;
const CALENDLY_EVENT_TYPE = process.env.CALENDLY_EVENT_TYPE_URI; // e.g., https://api.calendly.com/event_types/xxx
const CALENDLY_BASE_URL = 'https://api.calendly.com';

interface CalendlySlot {
  start_time: string;
  status: 'available';
}

// Get available slots from Calendly
export async function getAvailableSlots(preferredDay?: string): Promise<Array<{ start_time: string; display: string }>> {
  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days out

  const response = await fetch(
    `${CALENDLY_BASE_URL}/event_type_available_times?event_type=${encodeURIComponent(CALENDLY_EVENT_TYPE)}&start_time=${startTime}&end_time=${endTime}`,
    {
      headers: {
        'Authorization': `Bearer ${CALENDLY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Calendly API error: ${response.status}`);
  }

  const data = await response.json();
  let slots = data.collection as CalendlySlot[];

  // Filter by preferred day if specified
  if (preferredDay) {
    const dayLower = preferredDay.toLowerCase();
    slots = slots.filter(slot => {
      const slotDay = new Date(slot.start_time).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      return slotDay.includes(dayLower);
    });
  }

  // Format for display
  return slots.slice(0, 10).map(slot => ({
    start_time: slot.start_time,
    display: new Date(slot.start_time).toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  }));
}

// Book a slot via Calendly
export async function bookClass(lead: Lead, slotStartTime: string): Promise<{ success: boolean; eventUri?: string; error?: string }> {
  const response = await fetch(`${CALENDLY_BASE_URL}/scheduled_events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CALENDLY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: CALENDLY_EVENT_TYPE,
      start_time: slotStartTime,
      invitee: {
        name: lead.name || 'Guest',
        email: lead.email || `${lead.phone.replace(/\D/g, '')}@placeholder.com`,
        phone_number: lead.phone,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  const data = await response.json();
  return { success: true, eventUri: data.resource.uri };
}
```

### Agent Handler
```typescript
async function handleCrmAgentResponse(lead: Lead, inboundText: string) {
  // Get conversation history
  const history = await prisma.leadMessage.findMany({
    where: { leadId: lead.id },
    orderBy: { sentAt: 'asc' },
    take: 20,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: buildPrompt(lead) },
    ...history.map(m => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: inboundText },
  ];

  let response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.7,
  });

  // Handle tool calls
  while (response.choices[0].message.tool_calls?.length) {
    const toolCalls = response.choices[0].message.tool_calls;
    messages.push(response.choices[0].message);

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      let result: unknown;

      switch (toolCall.function.name) {
        case 'get_available_slots': {
          const slots = await getAvailableSlots(args.preferred_day);
          result = { 
            slots: slots.map(s => s.display),
            raw_slots: slots, // For booking reference
          };
          break;
        }

        case 'book_class': {
          const booking = await bookClass(lead, args.slot_start_time);
          if (booking.success) {
            const eventTime = new Date(args.slot_start_time);
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                status: 'BOOKED',
                pauseSequence: true,
                calendlyEventId: booking.eventUri,
                bookedAt: new Date(),
                eventTime,
              },
            });
            result = { 
              success: true, 
              booked_time: eventTime.toLocaleString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }),
            };
          } else {
            result = { success: false, error: booking.error };
          }
          break;
        }

        case 'mark_not_interested': {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'LOST', pauseSequence: true },
          });
          result = { marked: true };
          break;
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Get next response after tool execution
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
    });
  }

  // Send final response via Blooio
  const reply = response.choices[0].message.content;
  if (reply) {
    await sendMessage(lead.phone, reply);
    
    await prisma.leadMessage.create({
      data: {
        leadId: lead.id,
        direction: 'outbound',
        content: reply,
        isAutomated: true,
      },
    });
  }
}
```

### Example Conversation Flow
```
Lead: "yeah my daughter would love that. do you have saturday?"

Agent: [calls get_available_slots({ preferred_day: "saturday" })]
       → Returns: ["Saturday, Jan 4 at 10:00 AM", "Saturday, Jan 4 at 2:00 PM"]

Agent: "nice! i have saturday at 10am or 2pm - which works better for you?"

Lead: "2pm works"

Agent: [calls book_class({ slot_start_time: "2025-01-04T14:00:00-08:00" })]
       → Returns: { success: true, booked_time: "Saturday, Jan 4 at 2:00 PM" }

Agent: "you're all set for saturday at 2pm! you'll get a calendar invite shortly. see you then 🎾"
```

---

## UI Components

### File Structure
```
app/
  crm/
    page.tsx                    # Inbox view (list + conversation)
  api/
    crm/
      leads/
        route.ts                # GET, POST
        [id]/
          route.ts              # GET, PATCH, DELETE
          send/
            route.ts            # POST manual message
      sequences/
        route.ts                # GET, POST
    cron/
      crm-followup/
        route.ts
    webhooks/
      blooio/
        route.ts
      calendly/
        route.ts
components/
  crm/
    LeadList.tsx                # Left sidebar with lead list
    LeadListItem.tsx            # Individual lead in list
    ConversationPanel.tsx       # Right side chat view
    AddLeadModal.tsx            # New lead form
    LeadHeader.tsx              # Lead info header in conversation
lib/
  crm/
    blooio.ts                   # Blooio client
    calendly.ts                 # Calendly API client (get slots, book)
    agent.ts                    # CRM agent with booking tools
    sequences.ts                # Sequence helpers
  db.ts                         # Prisma client
```

### Inbox View (`/crm`)

Single page with two panels: lead list on left, conversation on right.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Evergreen CRM                                                    [+ Add Lead]  │
├───────────────────────────┬─────────────────────────────────────────────────────┤
│ [All ▼] [🔍 Search]       │                                                     │
├───────────────────────────┤  John Smith                         [Mark as ▼]    │
│                           │  +1 (555) 123-4567 · Instagram                      │
│ 🔴 NEEDS ATTENTION        │  Notes: 8yr old, wants Saturday classes             │
│ ─────────────────────     ├─────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ │                                                     │
│ │ 🟢 John S         2m  │ │                        Today 10:15 AM               │
│ │ "2pm works"           │◄│                                                     │
│ │ Replied · Instagram   │ │  ┌───────────────────────────────┐                  │
│ └───────────────────────┘ │  │ hey john! saw you were        │                  │
│ ┌───────────────────────┐ │  │ interested in a free class.   │                  │
│ │ 🟢 Mike T         5m  │ │  │ want me to find you a time? 🎾 │                  │
│ │ "sounds good"         │ │  └───────────────────────────────┘                  │
│ │ Replied · Referral    │ │                              Auto                   │
│ └───────────────────────┘ │                                                     │
│                           │                  ┌───────────────────────────────┐  │
│ 📤 IN SEQUENCE            │                  │ yeah do you have saturday?    │  │
│ ─────────────────────     │                  └───────────────────────────────┘  │
│ ┌───────────────────────┐ │                                                     │
│ │ 🟡 Sarah J       23h  │ │  ┌───────────────────────────────┐                  │
│ │ Step 2 · Next: 1h     │ │  │ nice! i have saturday at 10am │                  │
│ │ No reply · Instagram  │ │  │ or 2pm - which works better?  │                  │
│ └───────────────────────┘ │  └───────────────────────────────┘                  │
│ ┌───────────────────────┐ │                                AI                   │
│ │ 🟡 Tom K          2d  │ │                                                     │
│ │ Step 3 · Next: 22h    │ │                  ┌───────────────────────────────┐  │
│ │ No reply · Website    │ │                  │ 2pm works                     │  │
│ └───────────────────────┘ │                  └───────────────────────────────┘  │
│                           │                                                     │
│ ✅ BOOKED                 │  ┌───────────────────────────────┐                  │
│ ─────────────────────     │  │ you're all set for saturday   │                  │
│ ┌───────────────────────┐ │  │ at 2pm! see you then 🎾        │                  │
│ │ ✅ Emma L       1hr   │ │  └───────────────────────────────┘                  │
│ │ Sat Jan 4, 2pm        │ │                                AI · Delivered       │
│ │ Booked · Website      │ │                                                     │
│ └───────────────────────┘ │                                                     │
│                           ├─────────────────────────────────────────────────────┤
│ ❌ LOST (2)          [+]  │  ┌─────────────────────────────────────────┐  [↑]  │
└───────────────────────────┴──┴─────────────────────────────────────────┴────────┘
```

### Conversation Bubble Styling

```css
/* Outbound messages (right side, blue like iMessage) */
.bubble-outbound {
  background: #007AFF;      /* iMessage blue */
  color: white;
  border-radius: 18px;
  border-bottom-right-radius: 4px;
  padding: 10px 14px;
  max-width: 70%;
  margin-left: auto;
}

/* Inbound messages (left side, gray) */
.bubble-inbound {
  background: #E9E9EB;      /* iMessage gray */
  color: #000;
  border-radius: 18px;
  border-bottom-left-radius: 4px;
  padding: 10px 14px;
  max-width: 70%;
}

/* Timestamps & labels */
.message-meta {
  font-size: 11px;
  color: #8E8E93;
  margin-top: 2px;
}
```

### Message Layout

```tsx
// ConversationPanel.tsx structure
<div className="flex flex-col gap-1 p-4">
  {/* Date separator */}
  <div className="text-center text-xs text-gray-500 my-2">Today 10:15 AM</div>
  
  {/* Outbound message (our message - right aligned, blue) */}
  <div className="flex flex-col items-end">
    <div className="bg-[#007AFF] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[70%]">
      hey john! saw you were interested in a free class. want me to find you a time? 🎾
    </div>
    <span className="text-[11px] text-gray-400 mt-1">Auto</span>
  </div>
  
  {/* Inbound message (their message - left aligned, gray) */}
  <div className="flex flex-col items-start">
    <div className="bg-[#E9E9EB] text-black rounded-2xl rounded-bl-sm px-4 py-2 max-w-[70%]">
      yeah do you have saturday?
    </div>
  </div>
  
  {/* Outbound AI response */}
  <div className="flex flex-col items-end">
    <div className="bg-[#007AFF] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[70%]">
      nice! i have saturday at 10am or 2pm - which works better?
    </div>
    <span className="text-[11px] text-gray-400 mt-1">AI</span>
  </div>
  
  {/* Inbound reply */}
  <div className="flex flex-col items-start">
    <div className="bg-[#E9E9EB] text-black rounded-2xl rounded-bl-sm px-4 py-2 max-w-[70%]">
      2pm works
    </div>
  </div>
  
  {/* Outbound with delivery status */}
  <div className="flex flex-col items-end">
    <div className="bg-[#007AFF] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[70%]">
      you're all set for saturday at 2pm! see you then 🎾
    </div>
    <span className="text-[11px] text-gray-400 mt-1">AI · Delivered</span>
  </div>
</div>
```

### Message Meta Labels

| Label | When |
|-------|------|
| `Auto` | Automated sequence message |
| `AI` | Agent-generated response |
| `Manual` | Sent by human from UI |
| `Delivered` | Blooio confirmed delivery |
| `Read` | iMessage read receipt (if available) |
| `Failed` | Message failed to send |

### Input Area

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐  [↑]  │
│  │ iMessage                                            │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

```tsx
// Input mimics iMessage style
<div className="border-t p-3">
  <div className="flex items-center gap-2">
    <input
      type="text"
      placeholder="iMessage"
      className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <button className="w-8 h-8 bg-[#007AFF] rounded-full flex items-center justify-center">
      <ArrowUpIcon className="w-4 h-4 text-white" />
    </button>
  </div>
</div>
```

### Lead List Sections

Leads are auto-grouped by priority:

| Section | Filter | Color |
|---------|--------|-------|
| 🔴 Needs Attention | `status = REPLIED` (waiting for human/AI) | Red dot |
| 📤 In Sequence | `status IN (NEW, CONTACTED)` & `pauseSequence = false` | Yellow dot |
| ✅ Booked | `status = BOOKED` | Green check |
| ❌ Lost | `status = LOST` | Gray, collapsed by default |
| ✨ Converted | `status = CONVERTED` | Gold, collapsed |

### Lead List Item States

```typescript
// Visual indicators
🟢 Green dot = replied recently (needs attention)
🟡 Yellow dot = in sequence, no reply yet
✅ Checkmark = booked
⚪ Gray = new, not yet contacted
❌ Red X = lost/unsubscribed
```

### Filter Options

Dropdown filter options:
- All
- Needs Attention
- In Sequence  
- Booked
- Lost
- By Source (Instagram, Referral, Website, etc.)

### Real-time Updates

```typescript
// Poll for updates every 3 seconds when page is focused
useEffect(() => {
  const interval = setInterval(async () => {
    if (document.hasFocus()) {
      const leads = await fetch('/api/crm/leads').then(r => r.json());
      setLeads(leads);
      
      if (selectedLeadId) {
        const lead = await fetch(`/api/crm/leads/${selectedLeadId}`).then(r => r.json());
        setSelectedLead(lead);
      }
    }
  }, 3000);
  
  return () => clearInterval(interval);
}, [selectedLeadId]);
```

### Add Lead Modal

```
┌─────────────────────────────────────────────────┐
│  Add New Lead                              [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Name                                           │
│  ┌───────────────────────────────────────────┐  │
│  │ Sarah Johnson                             │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Phone *                                        │
│  ┌───────────────────────────────────────────┐  │
│  │ +1 555 123 4567                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Source                                         │
│  ┌───────────────────────────────────────────┐  │
│  │ Instagram                              ▼  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Notes                                          │
│  ┌───────────────────────────────────────────┐  │
│  │ 8yr old, interested in Saturday classes   │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [x] Send first message immediately             │
│                                                 │
│              [Cancel]           [Add Lead]      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Empty State

When no lead is selected:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Evergreen CRM                                                    [+ Add Lead]  │
├───────────────────────────┬─────────────────────────────────────────────────────┤
│                           │                                                     │
│ (lead list)               │         Select a conversation                       │
│                           │                                                     │
│                           │     Click on a lead to view their conversation      │
│                           │                                                     │
└───────────────────────────┴─────────────────────────────────────────────────────┘
```

### Mobile Responsive

On mobile, show list view first. Clicking a lead navigates to conversation (full screen), with back button.

```
Mobile List                    Mobile Conversation
┌─────────────────────┐        ┌─────────────────────┐
│ CRM        [+ Add]  │        │ ← John Smith   [⋮]  │
├─────────────────────┤        ├─────────────────────┤
│ 🟢 John S      2m   │  tap   │                     │
│ "2pm works"         │ ────▶  │ (full conversation) │
│ Replied             │        │                     │
├─────────────────────┤        │                     │
│ 🟢 Mike T      5m   │        │                     │
│ "sounds good"       │        ├─────────────────────┤
└─────────────────────┘        │ [Message...]  [>]   │
                               └─────────────────────┘
```

---

## Default Sequence

Seed this on first deploy:

```json
{
  "name": "Free Class Drip",
  "steps": [
    { "step": 1, "message": "hey {{name}}! saw you were interested in a free class at evergreen prep. want me to find you a time? 🎾" },
    { "step": 2, "message": "just following up - we have spots this weekend if you're free!" },
    { "step": 3, "message": "hey! last ping on the free class - no pressure, just don't want you to miss out" },
    { "step": 4, "message": "circling back - free class is always open if timing works out later. just reply anytime 🙂" }
  ]
}
```

Each step is sent 24 hours after the previous one if no reply. No `day` field needed - it's always 24 hours.

---

## Calendly Integration

### Setup
1. Create a Calendly account and event type for "Free Class"
2. Get your API key from Calendly → Integrations → API & Webhooks
3. Get your Event Type URI from the API or Calendly dashboard
4. (Optional) Add webhook for backup status updates

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /event_type_available_times` | Fetch available slots |
| `POST /scheduled_events` | Book a slot programmatically |

### Webhook Handler (Backup)

The agent books directly via API, but this webhook catches manual bookings or edge cases:

```typescript
// POST /api/webhooks/calendly
export async function POST(req: Request) {
  const event = await req.json();
  
  if (event.event === 'invitee.created') {
    // Extract phone from custom questions or invitee data
    const phone = event.payload.questions_and_answers
      ?.find(q => q.question.toLowerCase().includes('phone'))?.answer
      || event.payload.invitee?.phone_number;
    
    if (!phone) return Response.json({ ok: true });
    
    const normalizedPhone = formatE164(phone);
    const lead = await prisma.lead.findUnique({ where: { phone: normalizedPhone } });
    
    if (!lead) return Response.json({ ok: true });
    
    // Only update if not already booked (agent may have already updated)
    if (lead.status !== 'BOOKED') {
      const eventTime = new Date(event.payload.event.start_time);
      
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: 'BOOKED',
          pauseSequence: true,
          calendlyEventId: event.payload.event.uuid,
          bookedAt: new Date(),
          eventTime,
        },
      });
      
      // Send confirmation if agent didn't already
      const recentMessages = await prisma.leadMessage.findMany({
        where: { leadId: lead.id, sentAt: { gte: new Date(Date.now() - 60000) } },
      });
      
      if (recentMessages.length === 0) {
        const dayName = eventTime.toLocaleDateString('en-US', { weekday: 'long' });
        await sendMessage(lead.phone, `you're all set for ${dayName}! see you then 🎾`);
      }
    }
  }
  
  return Response.json({ ok: true });
}
```

---

## Authentication

Simple password-based auth for the VA. No need for complex user management.

### Implementation
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect /crm routes
  if (!request.nextUrl.pathname.startsWith('/crm')) {
    return NextResponse.next();
  }

  const session = request.cookies.get('crm_session');
  
  if (!session || session.value !== process.env.CRM_SESSION_SECRET) {
    return NextResponse.redirect(new URL('/crm/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/crm/:path*',
};
```

### Login Page (`/crm/login`)
```tsx
// Simple password form
export default function LoginPage() {
  async function handleLogin(formData: FormData) {
    'use server';
    const password = formData.get('password');
    
    if (password === process.env.CRM_PASSWORD) {
      cookies().set('crm_session', process.env.CRM_SESSION_SECRET!, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      redirect('/crm');
    }
  }

  return (
    <form action={handleLogin}>
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  );
}
```

### Environment Variables
```env
CRM_PASSWORD="your-secure-password"
CRM_SESSION_SECRET="random-32-char-string"
```

---

## STOP Compliance

Legal requirement: Users must be able to opt out by texting STOP.

### Trigger Words
```typescript
const STOP_WORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];
const START_WORDS = ['start', 'resume', 'unstop', 'subscribe'];
```

### Webhook Handler
```typescript
// In /api/webhooks/blooio handler

const body = event.text.toLowerCase().trim();

// Check for STOP
if (STOP_WORDS.includes(body)) {
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: 'LOST',
      pauseSequence: true,
      notes: `${lead.notes || ''}\n[STOPPED via text ${new Date().toISOString()}]`,
    },
  });
  
  await sendMessage(lead.phone, "you've been unsubscribed. reply START anytime to resume.");
  return; // Don't process further
}

// Check for START (re-subscribe)
if (START_WORDS.includes(body)) {
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: 'REPLIED',
      pauseSequence: false,
      nextFollowUpAt: addHours(new Date(), 24),
    },
  });
  
  await sendMessage(lead.phone, "welcome back! would you still like to book a free class?");
  return;
}

// Normal message processing continues...
```

### Cron Job Check
```typescript
// Before sending any message in cron job
const lead = await prisma.lead.findUnique({ where: { id: leadId } });

if (lead.status === 'LOST' || lead.pauseSequence) {
  continue; // Skip this lead
}
```

---

## Manual Controls

VA needs to override automation when needed.

### Lead Actions (in UI header)
```
┌─────────────────────────────────────────────────────────────────┐
│  John Smith                              [Actions ▼]            │
│  +1 (555) 123-4567 · Instagram                                  │
│                                                                 │
│  ┌─────────────────────────────┐                               │
│  │ ✓ Pause AI                  │  ← Stop AI from responding    │
│  │   Resume Sequence           │  ← Restart follow-up sequence │
│  │ ─────────────────────────── │                               │
│  │   Mark as Booked            │                               │
│  │   Mark as Lost              │                               │
│  │   Mark as Converted         │                               │
│  │ ─────────────────────────── │                               │
│  │   Edit Lead Info            │  ← Change name, notes, etc.   │
│  │   Delete Lead               │                               │
│  └─────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints
```typescript
// PATCH /api/crm/leads/[id]
{
  "action": "pause_ai"      // Sets pauseSequence = true, keeps status
}
{
  "action": "resume_sequence", // Resets sequence to step 1, schedules next followup
  "sequenceId": "xxx"          // Optional: change sequence
}
{
  "action": "update_status",
  "status": "BOOKED"
}
{
  "action": "update_info",
  "name": "John Smith",
  "notes": "Updated notes..."
}
```

### Pause AI Toggle
When AI is paused:
- Inbound messages are saved but NOT auto-responded to
- Show indicator in conversation: "🔇 AI paused - manual responses only"
- VA can type and send manually
- Sequence does NOT continue

```tsx
// In conversation panel
{lead.pauseSequence && lead.status === 'REPLIED' && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm">
    🔇 AI is paused. Messages won't be auto-answered.
    <button onClick={resumeAI} className="ml-2 underline">Resume AI</button>
  </div>
)}
```

### Edit Lead Modal
```
┌─────────────────────────────────────────────────┐
│  Edit Lead                                 [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Name                                           │
│  ┌───────────────────────────────────────────┐  │
│  │ John Smith                                │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Phone (read-only)                              │
│  ┌───────────────────────────────────────────┐  │
│  │ +1 (555) 123-4567                    🔒   │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Email                                          │
│  ┌───────────────────────────────────────────┐  │
│  │ john@example.com                          │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Source                                         │
│  ┌───────────────────────────────────────────┐  │
│  │ Instagram                              ▼  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Notes                                          │
│  ┌───────────────────────────────────────────┐  │
│  │ 8yr old daughter, wants Saturday classes  │  │
│  │ Mom works during week                     │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│              [Cancel]              [Save]       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Error Handling

Graceful degradation when APIs fail.

### Blooio Errors
```typescript
async function sendMessageWithFallback(to: string, body: string, leadId: string) {
  try {
    const result = await sendMessage(to, body);
    return result;
  } catch (error) {
    // Log error
    console.error(`Blooio send failed for lead ${leadId}:`, error);
    
    // Save failed message for retry
    await prisma.leadMessage.create({
      data: {
        leadId,
        direction: 'outbound',
        content: body,
        status: 'failed',
        isAutomated: true,
      },
    });
    
    // Don't update sequence step - will retry on next cron
    throw error;
  }
}
```

### Calendly Errors
```typescript
// In agent tool handler
case 'get_available_slots': {
  try {
    const slots = await getAvailableSlots(args.preferred_day);
    result = { slots: slots.map(s => s.display), raw_slots: slots };
  } catch (error) {
    // Return friendly error for agent to communicate
    result = { 
      error: true, 
      message: "couldn't load the schedule right now, can you try again in a sec?" 
    };
  }
  break;
}

case 'book_class': {
  try {
    const booking = await bookClass(lead, args.slot_start_time);
    // ... success handling
  } catch (error) {
    result = { 
      success: false, 
      error: "booking didn't go through, let me try again" 
    };
    // Agent will communicate this and can retry
  }
  break;
}
```

### OpenAI Errors
```typescript
async function handleCrmAgentResponse(lead: Lead, inboundText: string) {
  try {
    // ... normal agent flow
  } catch (error) {
    console.error(`Agent error for lead ${lead.id}:`, error);
    
    // Fallback: Send safe default response
    await sendMessage(lead.phone, "hey! sorry, having a tech moment. can you say that again?");
    
    // Mark for manual review
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pauseSequence: true,
        notes: `${lead.notes || ''}\n[Agent error ${new Date().toISOString()} - needs review]`,
      },
    });
  }
}
```

### Failed Message Indicator in UI
```tsx
// In conversation panel
{message.status === 'failed' && (
  <div className="flex items-center gap-2 text-red-500 text-xs mt-1">
    <span>Failed to send</span>
    <button onClick={() => retryMessage(message.id)} className="underline">
      Retry
    </button>
  </div>
)}
```

### Cron Job Error Handling
```typescript
// In /api/cron/crm-followup

let processed = 0;
let failed = 0;
const errors: string[] = [];

for (const lead of leads) {
  try {
    // ... send message logic
    processed++;
  } catch (error) {
    failed++;
    errors.push(`Lead ${lead.id}: ${error.message}`);
    // Continue to next lead, don't fail entire batch
  }
}

// Log summary
console.log(`CRM Cron: processed=${processed}, failed=${failed}`);
if (errors.length > 0) {
  console.error('CRM Cron errors:', errors);
}

return Response.json({ processed, failed, errors: errors.slice(0, 5) });
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Blooio
BLOOIO_API_KEY="xxx"
BLOOIO_WEBHOOK_SECRET="xxx"

# OpenAI
OPENAI_API_KEY="sk-xxx"

# Calendly
CALENDLY_API_KEY="xxx"                           # From Calendly → Integrations → API
CALENDLY_EVENT_TYPE_URI="https://api.calendly.com/event_types/xxx"  # Your event type
CALENDLY_WEBHOOK_SECRET="xxx"                    # Optional, for webhook verification

# Auth
CRM_PASSWORD="your-secure-password"
CRM_SESSION_SECRET="random-32-char-string"

# App
CRON_SECRET="xxx"  # For securing cron endpoints
```

---

## Implementation Order

| Phase | Task | Time |
|-------|------|------|
| 1 | Prisma schema + migration | 15 min |
| 2 | Blooio client (`lib/crm/blooio.ts`) | 15 min |
| 3 | Calendly client (`lib/crm/calendly.ts`) | 30 min |
| 4 | API routes (CRUD) | 45 min |
| 5 | Cron job (sequence engine) | 45 min |
| 6 | Webhook handler (blooio) | 30 min |
| 7 | CRM agent with booking tools | 1 hr |
| 8 | Inbox UI (lead list + conversation) | 2 hr |
| 9 | Add lead modal | 30 min |
| 10 | Calendly webhook (backup) | 15 min |
| **Total** | | **~7 hr** |

---

## Testing Checklist

- [ ] **Auth:** Login with password works
- [ ] **Auth:** Unauthenticated user redirected to login
- [ ] Create lead via UI → appears in list
- [ ] Cron sends first message after lead creation
- [ ] 24hr follow-up sends if no reply
- [ ] Inbound reply → agent responds
- [ ] Agent messages sound human (occasional typos, lowercase)
- [ ] Agent fetches available Calendly slots
- [ ] Agent books class when lead confirms time
- [ ] Lead status updates to BOOKED after booking
- [ ] Manual message from UI → delivered
- [ ] Real-time conversation updates
- [ ] Sequence pauses on reply
- [ ] **STOP:** "stop" message → unsubscribes, sends confirmation
- [ ] **STOP:** "start" message → re-subscribes
- [ ] **Manual:** Pause AI stops auto-responses
- [ ] **Manual:** Resume sequence restarts follow-ups
- [ ] **Manual:** Edit lead info saves correctly
- [ ] **Manual:** Mark as Booked/Lost works
- [ ] **Errors:** Blooio failure → message marked failed, shows retry
- [ ] **Errors:** Calendly failure → agent sends friendly error
- [ ] **Errors:** OpenAI failure → fallback message sent
