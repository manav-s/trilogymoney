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
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    const data = await res.json();
    const rawText = extractTextFromOpenAI(data);
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
  const system = `You are Trilogy, a concise, warm money coach over SMS. 1–2 lines, numbers first, plain language. No emojis.`;
  const user = buildUserPrompt(tool, context);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    const data = await res.json();
    const rawText = extractTextFromOpenAI(data);
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
  const balances = ctx.balances as { total: number; count: number } | undefined;
  const spend = ctx.spend as { total: number; top: { name: string; amount: number }[] } | undefined;
  const txns = ctx.txns as { date: string; merchant: string; amount: number }[] | undefined;
  const topLine = spend?.top?.slice(0,2).map(t => `${t.name} $${Math.round(t.amount)}`).join(', ') || '';
  const txnLine = (txns || []).slice(0,3).map(t => `$${t.amount.toFixed(2)} ${t.merchant} (${t.date})`).join('; ');
  return `You are chatting over SMS. Give ONE concise, helpful reply in ≤2 lines.
If the message clearly asks for balances/spend/transactions, write the answer using the data. Otherwise, reply conversationally and, if useful, ask at most one short follow‑up. Avoid generic menus; tailor to the latest user message and recent history.
Data (may be partial):
balances: total=${balances ? Math.round(balances.total) : 'n/a'}, accounts=${balances?.count ?? 'n/a'}
spend_7d: total=${spend ? Math.round(spend.total) : 'n/a'}, top=${topLine}
txns_3: ${txnLine}
 Recent messages:\n${history}
  Latest user message: ${userMsg}`;
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
      for (const part of content) {
        const text = (part?.text || part?.value || '').toString().trim();
        if (text) return text;
      }
    }
    // Responses API style
    const outputText = (dc?.output_text || dc?.text || '').toString().trim();
    if (outputText) return outputText;
    const content0 = dc?.content?.[0]?.text;
    if (typeof content0 === 'string' && content0.trim()) return content0.trim();
    return null;
  } catch {
    return null;
  }
}

