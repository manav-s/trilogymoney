/**
 * Minimal LLM intent chooser using OpenAI
 * Returns one of: 'balances' | 'spend_7d' | 'txns_3' | 'help'
 */
export type Intent = 'balances' | 'spend_7d' | 'txns_3' | 'chat';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

export async function chooseIntentFromText(userText: string): Promise<Intent> {
  if (!OPENAI_API_KEY) return 'chat';

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
        temperature: 0,
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
      try { errText = await res.text(); } catch {}
      console.error('[llm.intent] openai_error', { status: res.status, model: MODEL, body: errText?.slice(0, 200) });
      return 'chat';
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim()?.toLowerCase?.() || 'chat';
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
  if (!OPENAI_API_KEY) return 'sorry the model is having trouble';
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
        temperature: 0.3,
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        max_tokens: 120,
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
    const text: string = data?.choices?.[0]?.message?.content?.trim() || 'sorry the model is having trouble';
    return text;
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

function fallbackReply(tool: Intent, ctx: Record<string, unknown>): string {
  if (tool === 'balances') {
    const total = (ctx.total as number) ?? 0;
    const count = (ctx.count as number) ?? 0;
    return `cash: $${Math.round(total)} across ${count} accts.`;
  }
  if (tool === 'spend_7d') {
    const total = (ctx.total as number) ?? 0;
    const top = (ctx.top as { name: string; amount: number }[]) ?? [];
    const topLine = top.slice(0, 2).map(t => `${t.name} $${Math.round(t.amount)}`).join(', ');
    return `last 7d: $${Math.round(total)}${topLine ? '. top: ' + topLine : ''}`;
  }
  if (tool === 'txns_3') {
    const list = (ctx.list as { date: string; merchant: string; amount: number }[]) ?? [];
    const line = list.map(t => `$${t.amount.toFixed(2)} ${t.merchant} (${t.date})`).join('; ');
    return `latest: ${line}`;
  }
  const history = (ctx.history as string) || '';
  const userMsg = (ctx.userText as string) || '';
  // Generic, non-branching fallback to avoid hard-coded behavior
  return `what’s on your mind?`;
}


