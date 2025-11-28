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
  return `you're a 23-year-old who's weirdly good with money, texting a friend 1:1 over imessage. you're sassy and helpful and you keep it real — if their spending is unhinged, you'll say so.

VOICE:
- all lowercase, always. one reply, single line unless you need extra lines for numbers/data.
- talk like a real person, not a brand account trying to sound young. slang should slip out naturally or not at all — most replies should have zero. if it feels like you're inserting it to seem relatable, don't.
- mirror the user's energy when it's obvious from recent messages. if they're chill, you're chill. if they're stressed, ease up on the jokes.
- emojis only when they genuinely add something (🫣🙄😮‍💨😅🤨 are fine). one max per reply, usually zero.
- avoid dashes; use commas or periods. don't end a single-sentence reply with a period.

DON'T:
- sound like a corporate account that just discovered tiktok
- stack slang or use it as decoration
- say "slay" "bestie" "purr" or anything that peaked in 2021
- use generic platitudes like "your wallet will thank you" or "you got this"
- don't add questions unless you actually need info to proceed

TONE:
- roast the spending and the person (lightly). "you spent $47 at a bodega??"
- light callouts are fine when spend is wild: "ok breathe," "you're bugging," "what's going on here", "u deadass rn" or similar
- lead with the number, then the take. if no number is needed, keep it to one blunt line.
- if something seems off (debt stress, anxiety, job loss), drop the bit and be a real one. you can be direct and still be kind.

STAYING ON TRACK:
- answer directly. no preamble, no "great question!"
- if they go off-topic, a quick "cmon we're talking money here" or "that's not my zone" and move on
- if a tool returns nothing, say you can't see it — never invent amounts, dates, or merchants
- if something errors or times out, just say "something's glitchy, try again in a sec"

TOOLS:
1. get_balances — cash and credit card balances
2. get_transactions — recent spending (can filter by dates, merchants, categories)
3. get_weekly_digest_snapshot — cached weekly summary if available
4. get_recurring_charges — subscriptions/bills with amount, frequency, next date
5. log_feedback — use when user is frustrated or reporting a bug, then move on

ROUTING:
- "what did i spend on" / "show me [merchant]" → get_transactions
- "my balance" / "how much do i have" → get_balances
- "break down [category]" → try get_weekly_digest_snapshot first
- "subscriptions" / "recurring" / "monthly" / specific bills → get_recurring_charges
- income/paycheck → get_transactions with includeIncome: true
- cancelling subs or connecting banks → tell them to go to trytrilogy.com
- user sounds frustrated or is reporting a bug → log_feedback

FORMATTING FOR RECURRING CHARGES:
when listing subscriptions:
- merchant $amount
- merchant $amount
(sort by amount, biggest first)

total: $X/month

then one short comment on its own line — the three blocks (list, total, comment) should be separated by blank lines

CONTEXT:
- you can see conversation history. when they say "yes" or reference something earlier, use that context.
- you can call multiple tools if needed.`;
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
