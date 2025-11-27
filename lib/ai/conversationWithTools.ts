import { prisma } from '@/lib/db/db';
import { sendMessage } from '@/lib/integrations/blooio';
import { splitIntoSmsSegments } from '@/lib/integrations/sms';
import { decryptMessage } from '@/lib/db/encryption';
import { logError } from '@/lib/utils/logger';
import {
  executeToolCall,
  getBalancesToolSchema,
  getTransactionsToolSchema,
  getWeeklyDigestSnapshotToolSchema,
  logFeedbackToolSchema,
  getRecurringChargesToolSchema,
  type ToolCall,
  type ToolSchema,
} from '@/lib/ai/tools';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type OpenAIResponse = {
  message: ChatMessage;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini';
const MAX_TOOL_ROUNDS = 2;

export async function handleLLMConversationWithTools(phone: string, userText: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return;
  const isPaid = user.billingStatus === 'active' || user.billingStatus === 'trialing';
  const isActive = user.messagingStatus === 'active' && user.isActive !== false;
  if (!(isPaid && isActive)) return;

  const history = await getRecentHistorySnippet(user.id, 30, 30);
  const conversationMessages = convertHistorySnippetToMessages(history);

  if (!OPENAI_API_KEY) {
    await sendMessage({
      to: phone,
      body: 'how can i help with money today? balance or a recent charge?',
      userId: user.id,
      shouldPersist: true,
    });
    return;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationMessages,
    { role: 'user', content: userText },
  ];

  const tools = [
    { type: 'function' as const, function: getBalancesToolSchema() },
    { type: 'function' as const, function: getTransactionsToolSchema() },
    { type: 'function' as const, function: getWeeklyDigestSnapshotToolSchema() },
    { type: 'function' as const, function: getRecurringChargesToolSchema() },
    { type: 'function' as const, function: logFeedbackToolSchema() },
  ];

  let response = await callOpenAI({ messages, tools });
  let rounds = 0;

  while (response?.message?.tool_calls && response.message.tool_calls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    const toolResults: ChatMessage[] = [];
    for (const toolCall of response.message.tool_calls) {
      const result = await executeToolCall(user.id, toolCall);
      toolResults.push({
        role: 'tool',
        name: toolCall.function.name,
        tool_call_id: toolCall.id,
        content: JSON.stringify(result ?? {}),
      });
    }

    messages.push(response.message);
    messages.push(...toolResults);

    response = await callOpenAI({ messages, tools });
  }

  const body =
    (typeof response?.message?.content === 'string' && response.message.content.trim()) ||
    (rounds >= MAX_TOOL_ROUNDS
      ? "i hit a snag while fetching that. try again?"
      : 'how can i help with money today? balance or a recent charge?');

  const parts = splitIntoSmsSegments(sanitizeOutput(body));
  for (const segment of parts) {
    await sendMessage({ to: phone, body: segment, userId: user.id, shouldPersist: true });
  }
}

async function callOpenAI({
  messages,
  tools,
}: {
  messages: ChatMessage[];
  tools: { type: 'function'; function: ToolSchema }[];
}): Promise<OpenAIResponse | null> {
  try {
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
      throw new Error(`openai_error_${res.status}: ${errText?.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    if (!choice?.message) return null;
    return { message: choice.message as ChatMessage };
  } catch (err) {
    logError('conversation.tools.openai', err);
    return null;
  }
}

function buildSystemPrompt(): string {
  return `you are a gen z finance bot texting someone 1:1 over imessage. you’re playful and a little cocky, but still a helpful money coach.
STYLE:
- all lowercase, one reply, single line unless you need extra lines to include required numbers/data. mirror the user's tone and pacing when it's obvious from recent messages, but keep it lowercase.
- slang only if it flows and is natural like an actual gen z person; max one slang word total per reply —if you use one, keep the rest straight. if it feels forced, skip it. slang list: ate that, fr, twin, ayeee, goated, chopped, glaze, lore, lowkey, highkey, gassing it, bro cmon, deadass, mad, bet, gas, valid, off that, bugging.
- use emojis very sparingly and only when they really fit (🫣🙄😮‍💨😅🤣🤨👹😹😻 are fine). avoid dashes; use commas or periods instead. don't end a single-sentence reply with a period.
BEHAVIOR:
- roast spending choices/habits, not the person or their identity. playful, not try-hard. light callouts are fine when spend is wild (e.g., “what’s your vibe right now,” “you’re bugging for real,” “breathe for a sec”); keep advice minimal unless the user asks for it.
- lead with the amount, then the take. if no number is needed, keep it to one blunt line. no generic platitudes like “your wallet will thank you.”
- answer directly; don’t add extra questions unless required to proceed. stay on finance; if off-topic say “stay on topic twin” or “cmon lock in.”
- if a tool returns nothing, say you can’t see it; never invent amounts, dates, or merchants.
TOOLS YOU CAN CALL:
1. get_balances: cash and credit card balances.
2. get_transactions: recent spending with filters (dates, merchants, categories).
3. get_weekly_digest_snapshot: cached weekly summary (if available and recent).
4. get_recurring_charges: active subscriptions/bills (netflix, rent, gym) with amount, frequency, next date.
5. log_feedback: log user frustration/bug feedback (use when user is upset).
FORMATTING FOR RECURRING CHARGES:
- when showing subscriptions, list each on its own line with a bullet (•)
- format: • merchant $amount
- sort by amount descending (biggest first)
- after the list, add a blank line, then "total: $X/month"
- after the total, add another blank line, then one short sassy comment
- this creates 3 separate text blocks (list, total, comment) separated by blank lines
ROUTING HINTS:
- “what did i spend on” / “show me [merchant]” → get_transactions
- “my balance” / “how much do i have” → get_balances
- “break down [category from last week]” → try get_weekly_digest_snapshot first
- “subscriptions” / “recurring” / “monthly bill” / “netflix” / “gym” / “rent” → get_recurring_charges
- income/paycheck questions → get_transactions with includeIncome: true
- if they ask about cancelling or adding/connecting more accounts/banks, tell them to go to trytrilogy.com
- if the user sounds frustrated/angry or is reporting a bug, call log_feedback with sentiment and move on
MULTI-TURN:
- you can see conversation history; when they say “yes” or “what about X,” use prior context.
- you can call multiple tools if needed (e.g., balances + transactions).`;
}

async function getRecentHistorySnippet(userId: string, days = 30, limit = 30): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const msgs = await prisma.message.findMany({
    where: { userId, sentAt: { gte: since } },
    orderBy: { sentAt: 'desc' },
    take: limit,
  });
  const lines: string[] = [];
  for (const m of msgs.reverse()) {
    try {
      const role = m.direction === 'inbound' ? 'you' : 'trilogy';
      const text = decryptMessage(m.content).replace(/\s+/g, ' ').slice(0, 140);
      lines.push(`${role}: ${text}`);
    } catch {
      // ignore malformed message entries
    }
  }
  return lines.join('\n');
}

export function sanitizeOutput(text: string): string {
  // replace long dashes but preserve short hyphens
  return text.replace(/[–—]/g, ',');
}

function convertHistorySnippetToMessages(history: string): ChatMessage[] {
  if (!history) return [];
  const messages: ChatMessage[] = [];
  for (const raw of history.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const separatorIndex = line.indexOf(':');
    const content = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
    if (lower.startsWith('you:')) {
      messages.push({ role: 'user', content });
    } else if (lower.startsWith('trilogy:')) {
      messages.push({ role: 'assistant', content });
    }
  }
  return messages;
}
