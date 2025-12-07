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
import { PERSONA, VOICE, DONT, TONE, GUARDRAILS, EXAMPLES } from '@/lib/ai/prompts';

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
  return `${PERSONA}

${VOICE}

${DONT}

${TONE}

${GUARDRAILS}

STAYING ON TRACK:
- if they go off-topic, a quick "we're talking money here" and move on

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
- you can call multiple tools if needed.

${EXAMPLES}`;
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
