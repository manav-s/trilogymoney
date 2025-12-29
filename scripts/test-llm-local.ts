/**
 * Local LLM test script - mocks blooio, uses real OpenAI + real Plaid data
 * Usage: npx tsx scripts/test-llm-local.ts <phone> "<message>"
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { prisma } from '../lib/db/db';
import { splitIntoSmsSegments } from '../lib/integrations/sms';
import { decryptMessage } from '../lib/db/encryption';
import {
  executeToolCall,
  getTransactionsToolSchema,
  getWeeklyDigestSnapshotToolSchema,
  logFeedbackToolSchema,
  getRecurringChargesToolSchema,
  type ToolCall,
  type ToolSchema,
} from '../lib/ai/tools';
import { sanitizeOutput } from '../lib/ai/conversationWithTools';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini';
const MAX_TOOL_ROUNDS = 2;

// ============ MOCK SEND MESSAGE ============
const sentMessages: string[] = [];

function mockSendMessage(body: string) {
  sentMessages.push(body);
  console.log('\x1b[36m📤 [MESSAGE SENT]\x1b[0m');
  console.log(`   "${body}"`);
  console.log('');
}

// ============ SYSTEM PROMPT (copy from conversationWithTools) ============
function buildSystemPrompt(): string {
  return `you are a gen z finance bot texting someone 1:1 over imessage. you're playful and a little cocky, but still a helpful money coach.
STYLE:
- all lowercase, one reply, single line unless you need extra lines to include required numbers/data. mirror the user's tone and pacing when it's obvious from recent messages, but keep it lowercase.
- slang only if it flows and is natural like an actual gen z person; max one slang word total per reply —if you use one, keep the rest straight. if it feels forced, skip it. slang list: ate that, fr, twin, ayeee, goated, chopped, glaze, lore, lowkey, highkey, gassing it, bro cmon, deadass, mad, bet, gas, valid, off that, bugging.
- use emojis very sparingly and only when they really fit (🫣🙄😮‍💨😅🤣🤨👹😹😻 are fine). avoid dashes; use commas or periods instead. don't end a single-sentence reply with a period.
BEHAVIOR:
- roast spending choices/habits, not the person or their identity. playful, not try-hard. light callouts are fine when spend is wild (e.g., "what's your vibe right now," "you're bugging for real," "breathe for a sec"); keep advice minimal unless the user asks for it.
- lead with the amount, then the take. if no number is needed, keep it to one blunt line. no generic platitudes like "your wallet will thank you."
- answer directly; don't add extra questions unless required to proceed. stay on finance; if off-topic say "stay on topic twin" or "cmon lock in."
- if a tool returns nothing, say you can't see it; never invent amounts, dates, or merchants.
TOOLS YOU CAN CALL:
1. get_transactions: recent spending with filters (dates, merchants, categories).
2. get_weekly_digest_snapshot: cached weekly summary (if available and recent).
3. get_recurring_charges: active subscriptions/bills (netflix, rent, gym) with amount, frequency, next date.
4. log_feedback: log user frustration/bug feedback (use when user is upset).
FORMATTING FOR RECURRING CHARGES:
- when showing subscriptions, list each on its own line with a bullet (•)
- format: • merchant $amount
- sort by amount descending (biggest first)
- after the list, add a blank line, then "total: $X/month"
- after the total, add another blank line, then one short playful comment
- this creates 3 separate text blocks (list, total, comment) separated by blank lines
ROUTING HINTS:
- "what did i spend on" / "show me [merchant]" → get_transactions
- "break down [category from last week]" → try get_weekly_digest_snapshot first
- "subscriptions" / "recurring" / "monthly bill" / "netflix" / "gym" / "rent" → get_recurring_charges
- income/paycheck questions → get_transactions with includeIncome: true
- if they ask about cancelling or adding/connecting more accounts/banks, tell them to go to trytrilogy.com
- if the user sounds frustrated/angry or is reporting a bug, call log_feedback with sentiment and move on
MULTI-TURN:
- you can see conversation history; when they say "yes" or "what about X," use prior context.
- you can call multiple tools if needed (e.g., balances + transactions).`;
}

// ============ OPENAI CALL ============
async function callOpenAI({
  messages,
  tools,
}: {
  messages: ChatMessage[];
  tools: { type: 'function'; function: ToolSchema }[];
}): Promise<{ message: ChatMessage } | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${errText?.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice?.message) return null;
  return { message: choice.message as ChatMessage };
}

// ============ MAIN ============
async function main() {
  const [, , phone, ...rest] = process.argv;
  if (!phone || rest.length === 0) {
    console.error('Usage: npx tsx scripts/test-llm-local.ts <phone> "<message>"');
    process.exit(1);
  }

  const userMessage = rest.join(' ');

  console.log('\n\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[33m LOCAL LLM TEST (real OpenAI + real Plaid, mocked blooio)\x1b[0m');
  console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

  // Find user
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    console.error(`❌ User not found for phone: ${phone}`);
    process.exit(1);
  }
  console.log(`\x1b[32m✓ User found:\x1b[0m ${user.id}`);
  console.log(`\x1b[32m✓ User message:\x1b[0m "${userMessage}"\n`);

  // Build messages
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: userMessage },
  ];

  const tools = [
    { type: 'function' as const, function: getTransactionsToolSchema() },
    { type: 'function' as const, function: getWeeklyDigestSnapshotToolSchema() },
    { type: 'function' as const, function: getRecurringChargesToolSchema() },
    { type: 'function' as const, function: logFeedbackToolSchema() },
  ];

  // Call LLM
  console.log('\x1b[35m🤖 Calling OpenAI...\x1b[0m\n');
  let response = await callOpenAI({ messages, tools });
  let rounds = 0;

  while (response?.message?.tool_calls && response.message.tool_calls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    console.log(`\x1b[35m🔧 Tool calls (round ${rounds}):\x1b[0m`);

    const toolResults: ChatMessage[] = [];
    for (const toolCall of response.message.tool_calls) {
      console.log(`   → ${toolCall.function.name}(${toolCall.function.arguments})`);
      const result = await executeToolCall(user.id, toolCall);
      console.log(`   ← Result: ${JSON.stringify(result).slice(0, 200)}...`);
      toolResults.push({
        role: 'tool',
        name: toolCall.function.name,
        tool_call_id: toolCall.id,
        content: JSON.stringify(result ?? {}),
      });
    }
    console.log('');

    messages.push(response.message);
    messages.push(...toolResults);

    console.log('\x1b[35m🤖 Calling OpenAI again...\x1b[0m\n');
    response = await callOpenAI({ messages, tools });
  }

  // Get final response
  const body =
    (typeof response?.message?.content === 'string' && response.message.content.trim()) ||
    'how can i help with money today?';

  console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[33m RAW LLM OUTPUT:\x1b[0m');
  console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log(body);
  console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

  // Split into segments (this is what we're testing)
  const parts = splitIntoSmsSegments(sanitizeOutput(body));

  console.log(`\x1b[32m📱 MESSAGES THAT WOULD BE SENT (${parts.length} total):\x1b[0m\n`);
  for (let i = 0; i < parts.length; i++) {
    mockSendMessage(parts[i]);
  }

  console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log(`\x1b[32m✓ Done! ${parts.length} message(s) would be sent.\x1b[0m`);
  console.log('\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
