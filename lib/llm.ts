/**
 * Minimal LLM intent chooser using OpenAI
 * Returns one of: 'balances' | 'transactions' | 'chat'
 */
export type Intent = 'balances' | 'transactions' | 'chat';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini';
import { logError } from './logger';
import { TransactionSummary } from './transactions';
import { TransactionQuery } from './transactionQuery';

export async function chooseIntentFromText(userText: string): Promise<Intent> {
  const lowered = (userText || '').toLowerCase();
  const wantsInstitutions = /\b(institution|bank)\b/.test(lowered);
  const wantsCards = /\bcard(s)?\b/.test(lowered) && /\b(what|which|list|show|tell|where)\b/.test(lowered);
  if (wantsInstitutions || wantsCards) {
    return 'balances';
  }

  if (!OPENAI_API_KEY) {
    logError('llm.intent', undefined, { reason: 'missing_api_key' });
    return 'chat';
  }

  const system = `Classify a short SMS into EXACTLY ONE of: balances | transactions | chat.

Use balances for cash/balance requests.
Use transactions for transactions/charges (recent or merchant-specific).
Use chat for greetings, opinions, budgeting questions, general advice, or anything that does not clearly require a tool.
Return the bare token ONLY.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    let res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: String(userText || '') },
        ],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { }
      logError('llm.intent', undefined, { reason: 'openai_error', status: res.status, model: MODEL, body: errText?.slice(0, 200) });
      return 'chat';
    }
    let data = await res.json();
    let rawText = extractTextFromOpenAI(data);
    if (!rawText) {
      // Try Responses API once in case this model prefers it
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 4000);
        res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            input: [
              { role: 'system', content: system },
              { role: 'user', content: String(userText || '') },
            ],
            max_output_tokens: 5,
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
      logError('llm.intent', undefined, { reason: 'empty_completion', model: MODEL });
      return 'chat';
    }
    const text: string = rawText.toLowerCase();
    if (text === 'balances' || text === 'transactions' || text === 'chat') return text as Intent;
    return 'chat';
  } catch (e) {
    const name = (e as Error)?.name;
    logError('llm.intent', e, { model: MODEL, error: name || 'unknown' });
    return 'chat';
  }
}

/**
 * Ask the model to produce the final SMS copy given tool results.
 * Pass only small, non-sensitive summaries.
 */
export async function generateReply(tool: Intent, context: Record<string, unknown>): Promise<string> {
  if (!OPENAI_API_KEY) {
    logError('llm.reply', undefined, { reason: 'missing_api_key' });
    return 'sorry the model is having trouble';
  }
  const system = `You are Trilogy, a concise, warm money coach over SMS.
style: lowercase, short, playful-but-respectful, no doom.
format: default to one short line; use up to two lines only when presenting numbers or lists. put numbers first. plain language. no emojis.
behavior: answer directly; do NOT add a question at the end unless a question is strictly required to proceed (e.g., choose dates). never append soft check-ins like “does that help?”. avoid menus/boilerplate.
tools you can call (server will provide data when needed):
- balances: cash totals plus card owed amounts by institution.
- transactions: recent transactions with amount, merchant, date, and account. mention pending status if present.`;
  const user = buildUserPrompt(tool, context);
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
    return rawText;
  } catch (e) {
    const name = (e as Error)?.name;
    logError('llm.reply', e, { model: MODEL, error: name || 'unknown' });
    return 'sorry the model is having trouble';
  }
}

function buildUserPrompt(tool: Intent, ctx: Record<string, unknown>): string {
  if (tool === 'balances') {
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
    return `Respond with a natural 1–2 sentence SMS in lowercase (no bullet lists or strict templates).
${questionLine}
Use the structured data below. Mention totals only if they help answer the question. If the user asks about banks or cards, name the institutions and account labels from the data—never guess. If information is missing, say you can’t see it.
Data: cash_total=${Math.round(cashTotal)}, cash_accounts=${cashCount}, cash_institutions=${cashInstStr}, cash_accounts_json=${cashAccountsJson}, cards_owed=${Math.round(cardOwed)}, cards=${cardCount}, card_institutions=${cardInstStr}, card_accounts_json=${cardAccountsJson}`;
  }
  if (tool === 'transactions') {
    const transactionsJson =
      typeof ctx.transactionsJson === 'string'
        ? ctx.transactionsJson
        : JSON.stringify((ctx.transactions as TransactionSummary[]) ?? []);
    const summaryJson =
      typeof ctx.summaryJson === 'string'
        ? ctx.summaryJson
        : JSON.stringify(null);
    const question = ((ctx.userText as string) || '').trim();
    const questionLine = question ? `User question: "${question}".` : 'User question: transactions summary.';
    const query = (ctx.query as TransactionQuery | undefined) ?? null;
    const queryJson = JSON.stringify(query);
    const categorySummaryLines =
      Array.isArray(ctx.categorySummaryLines) && (ctx.categorySummaryLines as string[]).length > 0
        ? (ctx.categorySummaryLines as string[])
        : null;
    const rangeLabel = (ctx.rangeLabel as string) || '';
    const categoryBreakdownJson =
      typeof ctx.categoryBreakdownJson === 'string' ? ctx.categoryBreakdownJson : null;
    const categoryFocusLabel = (ctx.categoryFocusLabel as string) || '';
    const categoryFocusTotalsJson =
      typeof ctx.categoryFocusTotalsJson === 'string' ? ctx.categoryFocusTotalsJson : null;
    const guidance = [
      'Respond with 1–2 short sentences in lowercase using ONLY the JSON data provided.',
      'Use summary.totalSpend for overall spend and summary.totalRefund for refunds/credits.',
      categorySummaryLines
        ? 'When mentioning category totals, quote from categorySummaryLines exactly (do not recompute).'
        : 'When mentioning category totals, read them from summary.perCategory (do not recompute from raw transactions).',
      'When mentioning merchant totals, use summary.perMerchant when available.',
      'CRITICAL: NEVER invent sub-categories (like "plumbing", "electrical", "groceries") or merchant details that are not explicitly in the JSON.',
      'If the user asks for a breakdown and the JSON data is missing it, explicitly say "i don\'t have that level of detail" or "i can\'t see that breakdown".',
      'Do not guess. Do not hallucinate.',
      'Mention pending spend when summary.pendingSpend > 0 and pending refunds when summary.pendingRefund > 0.',
      'Do not offer to fetch more data.',
      rangeLabel
        ? `Unless the user clearly asked for different dates, keep all amounts scoped to ${rangeLabel} and start your answer with "for ${rangeLabel},".`
        : '',
      categoryBreakdownJson
        ? categoryFocusLabel
          ? `You are describing ${categoryFocusLabel}. Mention ONLY merchants listed in categoryBreakdownJson; never invent other store names or amounts.`
          : 'Mention ONLY merchants listed in categoryBreakdownJson; never invent other store names or amounts.'
        : 'If asked to break down a category, say you don\'t have those details.',
      categoryFocusTotalsJson
        ? 'Use the spend/pending/refund amounts from categoryFocusTotalsJson exactly when talking about this category.'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    const categoriesLine = categorySummaryLines
      ? `Category summary lines: ${JSON.stringify(categorySummaryLines)}`
      : '';
    const categoryFocusLine = categoryFocusLabel ? `Category focus: ${categoryFocusLabel}` : '';
    const categoryBreakdownLine = categoryBreakdownJson ? `Category breakdown JSON: ${categoryBreakdownJson}` : '';
    const categoryTotalsLine = categoryFocusTotalsJson ? `Category focus totals JSON: ${categoryFocusTotalsJson}` : '';
    return `${guidance}
${questionLine}
${categoriesLine}
${categoryFocusLine}
${categoryBreakdownLine}
${categoryTotalsLine}
Query JSON: ${queryJson}
Summary JSON: ${summaryJson}
Transactions JSON: ${transactionsJson}`;
  }
  const history = (ctx.history as string) || '';
  const userMsg = (ctx.userText as string) || '';
  const profile = (ctx.profile as { name?: string | null; timezone?: string; preferredTime?: string }) || {};
  const quiz = (ctx.quizAnswers as unknown) ?? null;
  const analysis = (ctx.analysisSummary as unknown) ?? null;
  const toShortJson = (v: unknown) => {
    try {
      const s = JSON.stringify(v);
      if (!s || s === 'null' || s === 'undefined') return '';
      return s.length > 300 ? s.slice(0, 300) + '…' : s;
    } catch { return ''; }
  };
  const quizStr = toShortJson(quiz);
  const analysisStr = toShortJson(analysis);
  const balances = ctx.balances as { total: number; count: number } | undefined;
  const txns = ctx.txns as { date: string; merchant: string; amount: number }[] | undefined;
  const txnLine = (txns || []).slice(0, 3).map(t => `$${t.amount.toFixed(2)} ${t.merchant} (${t.date})`).join('; ');
  return `You are chatting over SMS. Give ONE concise reply.
Default for casual/small‑talk: one very short line (≈3–7 words). Use ≤2 lines only when showing numbers.
Do not include a question unless you truly cannot proceed without a specific detail (e.g., dates). If not required, end with a statement (no question mark).
If the message clearly asks for balances/spend/transactions, write the answer using the data. Otherwise, reply conversationally in one short line. Avoid generic menus; tailor to the latest user message and recent history.
Data (may be partial):
balances: total=${balances ? Math.round(balances.total) : 'n/a'}, accounts=${balances?.count ?? 'n/a'}
txns_3: ${txnLine}
 Recent messages:\n${history}
  Latest user message: ${userMsg}
  Profile: name=${profile.name || ''}, tz=${profile.timezone || ''}, time=${profile.preferredTime || ''}
  Quiz: ${quizStr}
  Analysis: ${analysisStr}`;
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
    'After the heading, write one sentence summarizing total spend and any standout merchants—when referencing merchants, smooth noisy labels (trim repeated words, remove URLs, capitalize names like "Skool.com").',
    'Insert a blank line, then write "category breakdown:" on its own line.',
    'On the next lines list up to the first three items from spendSummary.topCategories in the format "{emoji} {label} $amount", choosing a fitting emoji yourself (common lifestyle/finance emoji only), rendering labels in lowercase with spaces instead of underscores, and rounding amounts to whole dollars with no comma separators.',
    'After the category block, add a blank line.',
    'If pending spend exists, write "pending to watch: $X still clearing." (rounded whole dollars); otherwise omit this line.',
    'After that, add another blank line, write "balances:" on its own line, then list every cash account (available balance when present, otherwise current) followed by every credit account (as "owes $amount"), one per line in the format "{name or institution} $amount" (mask optional).',
    'Finish with one short, sass-forward riff about the top merchant or category (no labels like "quip") that reads like a fresh judgy poke—invent a new line each week, no recycled wording.',
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

