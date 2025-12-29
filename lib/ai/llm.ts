import { logError } from '@/lib/utils/logger';
import { PERSONA, VOICE, STYLE, DONT, TONE, GUARDRAILS, EXAMPLES } from '@/lib/ai/prompts';
import type { MidweekContext } from '@/lib/midweekCheckin';

/**
 * LLM utilities for replies and digests.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini';

/**
 * Ask the model to produce the final SMS copy given tool results.
 * Pass only small, non-sensitive summaries.
 */
export async function generateReply(_tool: 'balances', context: Record<string, unknown>): Promise<string> {
  if (!OPENAI_API_KEY) {
    logError('llm.reply', undefined, { reason: 'missing_api_key' });
    return 'sorry the model is having trouble';
  }
  const system = `${PERSONA}

${VOICE}

${STYLE}

${DONT}

${TONE}

${GUARDRAILS}

format:
- default to one tight line; add a second line only when listing multiple numbers.
- keep commas/periods tight, no bullet characters.
- mix numbers with personality.

${EXAMPLES}`;
  const user = buildUserPrompt(context);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: 120,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { }
      logError('llm.reply', undefined, { reason: 'openai_error', status: res.status, model: MODEL, body: errText?.slice(0, 200) });
      return 'sorry the model is having trouble';
    }
    let data = await res.json();
    let rawText = extractTextFromOpenAI(data);
    if (!rawText) {
      // Try Responses API once if chat completion content is empty
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 5000);
        res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            input: [{ role: 'system', content: system }, { role: 'user', content: user }],
            max_output_tokens: 120,
          }),
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        if (res.ok) {
          data = await res.json();
          rawText = extractTextFromOpenAI(data);
        }
      } catch { }
    }
    if (!rawText) {
      logError('llm.reply', undefined, { reason: 'empty_completion', model: MODEL });
      return 'sorry the model is having trouble';
    }
    return sanitizeOutput(rawText);
  } catch (e) {
    const name = (e as Error)?.name;
    logError('llm.reply', e, { model: MODEL, error: name || 'unknown' });
    return 'sorry the model is having trouble';
  }
}

function buildUserPrompt(ctx: Record<string, unknown>): string {
  const cashTotal = (ctx.cashTotal as number) ?? (ctx.total as number) ?? 0;
  const cashCount = (ctx.cashCount as number) ?? (ctx.count as number) ?? 0;
  const cardOwed = (ctx.cardOwedTotal as number) ?? 0;
  const cardCount = (ctx.cardCount as number) ?? 0;
  const cashInsts = (ctx.cashInstitutions as string[] | null) ?? null;
  const cardInsts = (ctx.cardInstitutions as string[] | null) ?? null;
  const cashAccountsJson = (ctx.cashAccountsJson as string) || '[]';
  const cardAccountsJson = (ctx.cardAccountsJson as string) || '[]';
  const cashInstStr = cashInsts && cashInsts.length > 0 ? cashInsts.join(', ') : 'unknown';
  const cardInstStr = cardInsts && cardInsts.length > 0 ? cardInsts.join(', ') : 'unknown';
  const question = ((ctx.userText as string) || '').trim();
  const questionLine = question
    ? `User question: "${question}".`
    : 'User question: general balance check.';
  return `Respond with a natural 1 to 2 sentence SMS in lowercase (no bullet lists or strict templates).
${questionLine}
Use the structured data below. Mention totals only if they help answer the question. If the user asks about banks or cards, name the institutions and account labels from the data; never guess. If information is missing, say you can’t see it.
Data: cash_total=${Math.round(cashTotal)}, cash_accounts=${cashCount}, cash_institutions=${cashInstStr}, cash_accounts_json=${cashAccountsJson}, cards_owed=${Math.round(cardOwed)}, cards=${cardCount}, card_institutions=${cardInstStr}, card_accounts_json=${cardAccountsJson}`;
}

export function sanitizeOutput(text: string): string {
  // replace long dashes but preserve short hyphens
  return text.replace(/[–—]/g, ',');
}

export type WeeklyDigestContext = {
  week: { from: string; to: string };
  timezone: string;
  spendSummary: {
    totalSpend: number;
    pendingSpend: number;
    count: number;
    pendingCount: number;
    topCategories: Array<{ label: string; spendAmount: number; refundAmount: number; count: number; topMerchants: string[] }>;
    topMerchants: Array<{ label: string; spendAmount: number; refundAmount: number; count: number }>;
    topTransactions: Array<{ merchant: string; amount: number; date: string; category: string | null; pending: boolean }>;
  };
  balances: {
    cashTotal: number;
    cashCount: number;
    cashAccounts: Array<{ name: string; institution: string | null; available: number | null; current: number | null; mask: string | null }>;
    creditOwedTotal: number;
    creditCount: number;
    creditAccounts: Array<{ name: string; institution: string | null; balance: number | null; mask: string | null }>;
  };
  highlights: string[];
};

export async function generateWeeklyDigestMessage(context: WeeklyDigestContext): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    logError('llm.weekly_digest', undefined, { reason: 'missing_api_key' });
    return null;
  }

  const instructions = [
    'Write a weekly money digest SMS in lowercase with a warm, confident, professional tone (no slang or filler).',
    'Start with a heading line formatted exactly as "weekly summary: {mon} {day} → {mon} {day}" using lowercase 3-letter month and day number (e.g. "weekly summary: nov 17 → nov 23").',
    'Add a blank line after the heading before any other text.',
    'After the heading, write one sentence summarizing total spend and any standout merchants, and when referencing merchants, smooth noisy labels (trim repeated words, remove URLs, capitalize names like "Skool.com").',
    'Insert a blank line, then write "category breakdown:" on its own line.',
    'On the next lines list up to the first three items from spendSummary.topCategories in the format "{emoji} {label} $amount — {merchant1}, {merchant2}" where merchant1 and merchant2 come from the topMerchants array for that category (if available), choosing a fitting emoji yourself (common lifestyle/finance emoji only), rendering labels in lowercase with spaces instead of underscores, and rounding amounts to whole dollars with no comma separators. If topMerchants is empty or has one item, adjust accordingly (omit the dash if no merchants).',
    'After the category block, add a blank line.',
    'If pending spend exists, write "pending to watch: $X still clearing." (rounded whole dollars); otherwise omit this line.',
    'After that, add another blank line, write "balances:" on its own line, then list every cash account (available balance when present, otherwise current) followed by every credit account (as "owes $amount"), one per line in the format "{name or institution} $amount" (mask optional).',
    'Finish with one short, sass-forward riff about the top merchant or category (no labels like "quip") that reads like a fresh judgy poke; invent a new line each week, no recycled wording.',
    'Do not mention refunds or credits.',
    'If spend was zero, reassure the user instead of forcing amounts.',
    'Do not ask questions or offer to fetch more data.',
    'Use only the numbers from the JSON when quoting amounts.',
  ].join(' ');

  const userContent = `${instructions}
JSON: ${JSON.stringify(context)}`;

  const system = `You are Trilogy, a weekly "money pulse" writer for SMS.
voice: confident, encouraging, lowercase, professional.
format: heading + short paragraphs. keep output compact, no bullet characters other than the emoji list.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        max_tokens: 200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let errText = '';
      try {
        errText = await res.text();
      } catch { }
      logError('llm.weekly_digest', undefined, {
        reason: 'openai_error',
        status: res.status,
        model: MODEL,
        body: errText?.slice(0, 200),
      });
      return null;
    }
    let data = await res.json();
    let rawText = extractTextFromOpenAI(data);
    if (!rawText) {
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 15000);
        res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            input: [
              { role: 'system', content: system },
              { role: 'user', content: userContent },
            ],
            max_output_tokens: 200,
          }),
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        if (res.ok) {
          data = await res.json();
          rawText = extractTextFromOpenAI(data);
        }
      } catch { }
    }
    if (!rawText) {
      logError('llm.weekly_digest', undefined, { reason: 'empty_completion', model: MODEL });
      return null;
    }
    return rawText;
  } catch (error) {
    const name = (error as Error)?.name;
    logError('llm.weekly_digest', error, { model: MODEL, error: name || 'unknown' });
    return null;
  }
}

export async function generateMidweekMessage(context: MidweekContext): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    logError('llm.midweek', undefined, { reason: 'missing_api_key' });
    return null;
  }

  const variantInstructions: Record<string, string> = {
    pace: `Write a "pace check" message comparing current week spend so far ($${context.currentWeekSpend}) to last week's spend by this point ($${context.lastWeekByWednesday}). Comment on whether they're pacing ahead, behind, or similar.`,
    spike: `Write a "category spike" alert. The user spent $${context.topCategory?.amount} on ${context.topCategory?.label} already this week, which is unusually high compared to their average of $${context.categoryAvgMonthly[context.topCategory?.label ?? ''] ?? 0}/week. Gently flag this.`,
    quiet: `Write a "quiet week" message. The user has only spent $${context.currentWeekSpend} so far, wallet's taking a breather. Acknowledge this positively with light sass.`,
    big_txn: `Write a "big transaction" callout. Their biggest purchase this week was $${context.biggestTransaction?.amount} at ${context.biggestTransaction?.merchant}. Mention it without judgment.`,
    pending: `Write a "pending watch" message. The user has $${context.pendingTotal} in pending charges still clearing. Remind them to keep an eye on their balance.`,
  };

  const instructions = [
    'Write a midweek check-in SMS.',
    'Keep it SHORT: ONE paragraph, ideally under 160 characters, max 200.',
    'Start with "midweek pulse:" or "heads up:" or similar casual opener.',
    variantInstructions[context.variant],
    'End with one relevant emoji.',
    'Use a real emoji character, do not write the word "emoji".',
    'Do not ask questions.',
    'Do not mention specific days like "monday" or "wednesday".',
    'Do not use long dashes (— or –). If you would use a dash, use a comma.',
    'Use only the numbers provided, rounded to whole dollars.',
  ].join(' ');

  const userContent = `${instructions}
JSON: ${JSON.stringify(context)}`;

  const system = `You are Trilogy, a midweek money check-in writer for SMS.

${VOICE}

${DONT}

format: single short paragraph, one emoji at end. no bullet points.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        max_tokens: 100,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let errText = '';
      try {
        errText = await res.text();
      } catch { }
      logError('llm.midweek', undefined, {
        reason: 'openai_error',
        status: res.status,
        model: MODEL,
        body: errText?.slice(0, 200),
      });
      return null;
    }
    const data = await res.json();
    const rawText = extractTextFromOpenAI(data);
    if (!rawText) {
      logError('llm.midweek', undefined, { reason: 'empty_completion', model: MODEL });
      return null;
    }
    const compact = rawText.replace(/\s*\n\s*/g, ' ').trim();
    return sanitizeOutput(compact);
  } catch (error) {
    const name = (error as Error)?.name;
    logError('llm.midweek', error, { model: MODEL, error: name || 'unknown' });
    return null;
  }
}

function extractTextFromOpenAI(data: unknown): string | null {
  try {
    // Chat Completions classic shape
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const dc = data as any;
    const choice = dc?.choices?.[0];
    const msg = choice?.message;
    const content = msg?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const parts: string[] = [];
      for (const part of content) {
        const t1 = typeof part?.text === 'string' ? part.text : undefined;
        const t2 = typeof part?.text?.value === 'string' ? part.text.value : undefined;
        const t3 = typeof part?.value === 'string' ? part.value : undefined;
        const pick = t1 || t2 || t3;
        if (typeof pick === 'string' && pick.trim()) parts.push(pick.trim());
      }
      if (parts.length) return parts.join(' ');
    }
    // Responses API style
    const outputTextAny = dc?.output_text ?? dc?.text;
    if (typeof outputTextAny === 'string' && outputTextAny.trim()) return outputTextAny.trim();
    const content0 = dc?.content?.[0]?.text;
    if (typeof content0 === 'string' && content0.trim()) return content0.trim();
    return null;
  } catch {
    return null;
  }
}
