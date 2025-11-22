import { prisma } from '@/lib/db';
import { sendMessage } from '@/lib/blooio';
import { splitIntoSmsSegments } from '@/lib/sms';
import { decryptMessage } from '@/lib/encryption';
import { detectFeedbackIntent, captureFeedback } from '@/lib/feedback';
import { logError } from '@/lib/logger';
import {
  executeToolCall,
  getBalancesToolSchema,
  getTransactionsToolSchema,
  getWeeklyDigestSnapshotToolSchema,
  type ToolCall,
  type ToolSchema,
} from '@/lib/tools';

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

  const feedbackDetection = detectFeedbackIntent(userText);
  if (feedbackDetection.isFeedback && feedbackDetection.sentiment) {
    await captureFeedback({
      userId: user.id,
      userMessage: userText,
      sentiment: feedbackDetection.sentiment,
      context: {
        history: history.slice(0, 500),
        timestamp: new Date().toISOString(),
      },
    });

    let acknowledgment = '';
    if (feedbackDetection.sentiment === 'frustrated') {
      acknowledgment = "i hear you—that's frustrating. i've logged this for the team to review. what else can i help with?";
    } else if (feedbackDetection.sentiment === 'bug_report') {
      acknowledgment = "thanks for reporting this. i've logged it for the team to investigate. anything else i can help with?";
    } else {
      acknowledgment = "thanks for the feedback! i've passed it along to the team. what else can i help with?";
    }

    await sendMessage({
      to: phone,
      body: acknowledgment,
      userId: user.id,
      shouldPersist: true,
    });
    return;
  }

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

  const parts = splitIntoSmsSegments(body);
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
  return `You are Trilogy, a concise, warm money coach over SMS.
STYLE:
- Lowercase, short, playful-but-respectful
- Default to one short line; use two lines only for numbers/lists
- Put numbers first. Plain language. No emojis.
- Answer directly; do NOT add questions unless strictly required to proceed
- Never append soft check-ins like "does that help?"
TOOLS:
You have access to three tools:
1. get_balances: Cash and credit card balances
2. get_transactions: Recent spending with filters (dates, merchants, categories)
3. get_weekly_digest_snapshot: Cached weekly summary (if available and recent)
RULES:
- For "what did I spend on" or "show me [merchant]" → use get_transactions
- For "my balance" or "how much do I have" → use get_balances
- For "break down [category from last week]" → try get_weekly_digest_snapshot first (faster)
- For income/paycheck questions → use get_transactions with includeIncome: true
- NEVER invent amounts, dates, or merchants not in tool results
- If tool returns no data, say "i can't see that" or similar (don't hallucinate)
MULTI-TURN:
- You can see conversation history
- When user says "yes" or "what about X", use context from previous messages
- You can call multiple tools if needed (e.g., balances + transactions)`;
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
