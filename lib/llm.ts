/**
 * Minimal LLM intent chooser using OpenAI
 * Returns one of: 'balances' | 'spend_7d' | 'txns_3' | 'help'
 */
export type Intent = 'balances' | 'spend_7d' | 'txns_3' | 'chat';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

export async function chooseIntentFromText(userText: string): Promise<Intent> {
  if (!OPENAI_API_KEY) {
    console.error('[llm.intent] missing_api_key');
    return 'chat';
  }

  const system = `Classify a short SMS into EXACTLY ONE of: balances | spend_7d | txns_3 | chat.

Use balances for cash/balance requests. Use spend_7d for weekly/spend/last 7 days.
Use txns_3 for recent/transactions/charges.
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
        max_completion_tokens: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch {}
      console.error('[llm.intent] openai_error', { status: res.status, model: MODEL, body: errText?.slice(0, 200) });
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
      } catch {}
    }
    if (!rawText) {
      console.error('[llm.intent] empty_completion', { model: MODEL });
      return 'chat';
    }
    const text: string = rawText.toLowerCase();
    if (text === 'balances' || text === 'spend_7d' || text === 'txns_3' || text === 'chat') return text as Intent;
    return 'chat';
  } catch (e) {
    const name = (e as Error)?.name;
    console.error('[llm.intent] exception', { model: MODEL, error: name || 'unknown' });
    return 'chat';
  }
}

/**
 * Ask the model to produce the final SMS copy given tool results.
 * Pass only small, non-sensitive summaries.
 */
export async function generateReply(tool: Intent, context: Record<string, unknown>): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.error('[llm.reply] missing_api_key');
    return 'sorry the model is having trouble';
  }
  const system = `You are Trilogy, a concise, warm money coach over SMS.
style: lowercase, short, playful‑but‑respectful, and sassy (never rude), no doom.
format: default to one short line; use up to two lines only when presenting numbers or lists. put numbers first. plain language. no emojis.
behavior: answer directly; do NOT add a question at the end unless a question is strictly required to proceed (e.g., choose dates). never append soft check‑ins like “does that help?”. avoid menus/boilerplate.`;
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
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        max_completion_tokens: 120,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch {}
      console.error('[llm.reply] openai_error', { status: res.status, model: MODEL, body: errText?.slice(0, 200) });
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
            input: [ { role: 'system', content: system }, { role: 'user', content: user } ],
            max_output_tokens: 120,
          }),
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        if (res.ok) {
          data = await res.json();
          rawText = extractTextFromOpenAI(data);
        }
      } catch {}
    }
    if (!rawText) {
      console.error('[llm.reply] empty_completion', { model: MODEL });
      return 'sorry the model is having trouble';
    }
    return rawText;
  } catch (e) {
    const name = (e as Error)?.name;
    console.error('[llm.reply] exception', { model: MODEL, error: name || 'unknown' });
    return 'sorry the model is having trouble';
  }
}

function buildUserPrompt(tool: Intent, ctx: Record<string, unknown>): string {
  if (tool === 'balances') {
    const total = (ctx.total as number) ?? 0;
    const count = (ctx.count as number) ?? 0;
    return `Write a single SMS about cash across accounts.
Data: total=${Math.round(total)}, accounts=${count}`;
  }
  if (tool === 'spend_7d') {
    const total = (ctx.total as number) ?? 0;
    const top = (ctx.top as { name: string; amount: number }[]) ?? [];
    const topLine = top.slice(0, 2).map(t => `${t.name} $${Math.round(t.amount)}`).join(', ');
    return `Write a single SMS about last 7 days spend.
Data: total=${Math.round(total)}, top=${topLine}`;
  }
  if (tool === 'txns_3') {
    const list = (ctx.list as { date: string; merchant: string; amount: number }[]) ?? [];
    const line = list.map(t => `$${t.amount.toFixed(2)} ${t.merchant} (${t.date})`).join('; ');
    return `Write a single SMS listing recent transactions.
Data: ${line}`;
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
  const spend = ctx.spend as { total: number; top: { name: string; amount: number }[] } | undefined;
  const txns = ctx.txns as { date: string; merchant: string; amount: number }[] | undefined;
  const topLine = spend?.top?.slice(0,2).map(t => `${t.name} $${Math.round(t.amount)}`).join(', ') || '';
  const txnLine = (txns || []).slice(0,3).map(t => `$${t.amount.toFixed(2)} ${t.merchant} (${t.date})`).join('; ');
  return `You are chatting over SMS. Give ONE concise reply.
Default for casual/small‑talk: one very short line (≈3–7 words). Use ≤2 lines only when showing numbers.
Do not include a question unless you truly cannot proceed without a specific detail (e.g., dates). If not required, end with a statement (no question mark).
If the message clearly asks for balances/spend/transactions, write the answer using the data. Otherwise, reply conversationally in one short line. Avoid generic menus; tailor to the latest user message and recent history.
Data (may be partial):
balances: total=${balances ? Math.round(balances.total) : 'n/a'}, accounts=${balances?.count ?? 'n/a'}
spend_7d: total=${spend ? Math.round(spend.total) : 'n/a'}, top=${topLine}
txns_3: ${txnLine}
 Recent messages:\n${history}
  Latest user message: ${userMsg}
  Profile: name=${profile.name || ''}, tz=${profile.timezone || ''}, time=${profile.preferredTime || ''}
  Quiz: ${quizStr}
  Analysis: ${analysisStr}`;
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

