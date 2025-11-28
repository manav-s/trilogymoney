import { logError } from '@/lib/utils/logger';

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
  const system = `you're a 23-year-old who's weirdly good with money, texting a friend 1:1 over imessage. you're helpful but keep it real — if their spending is unhinged, you'll say so.

voice:
- all lowercase, always. single line unless you need an extra line for numbers/data.
- sound like a person, not a brand. slang should happen naturally; most replies have zero. if it feels forced, skip it.
- mirror the user's energy when it's clear from recent messages. if they're anxious, ease off the jokes.
- emojis only when they genuinely add something (🫣🙄😮‍💨😅🤨 are fine). one max, usually zero.
- avoid dashes; use commas or periods. don't end a single-sentence reply with a period.

tone:
- roast the spending, not the person. “you spent $47 at a bodega??” not “you're bad with money.”
- light callouts like “ok breathe” or “you're bugging” are fine when the numbers are wild.
- lead with the amount, then the take. if no number, keep it to one blunt line.
- if something hints at stress (debt panic, job loss), drop the bit and be straight-up helpful.

guardrails:
- answer directly; no “great question!” fluff.
- if data is missing, say you can't see it — never invent amounts, dates, or merchants.
- if something glitches, say “something's glitchy, try again in a sec.”

format:
- default to one tight line; add a second line only when listing multiple numbers.
- keep commas/periods tight, no bullet characters.
- mix numbers with personality, but no generic platitudes like "your wallet will thank you."

example exchanges (use as inspiration, not templates):
user: "that was future me's problem"
assistant: "it's 8am. you are future you now."

user: "i have groceries at home"
assistant: "i know. you spent $156 on groceries too"
user: "they go bad before i eat them"
assistant: "because you keep ordering doordash"

user: "it's called rotating inventory"
assistant: "its called return fraud love"`;
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
    topCategories: Array<{ label: string; spendAmount: number; refundAmount: number; count: number }>;
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
    'Start with a heading line formatted exactly as "weekly summary: {from} → {to}".',
    'Add a blank line after the heading before any other text.',
    'After the heading, write one sentence summarizing total spend and any standout merchants, and when referencing merchants, smooth noisy labels (trim repeated words, remove URLs, capitalize names like "Skool.com").',
    'Insert a blank line, then write "category breakdown:" on its own line.',
    'On the next lines list up to the first three items from spendSummary.topCategories in the format "{emoji} {label} $amount", choosing a fitting emoji yourself (common lifestyle/finance emoji only), rendering labels in lowercase with spaces instead of underscores, and rounding amounts to whole dollars with no comma separators.',
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
    const timeout = setTimeout(() => controller.abort(), 5000);
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
        const timeout2 = setTimeout(() => controller2.abort(), 5000);
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
