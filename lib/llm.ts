/**
 * Minimal LLM intent chooser using OpenAI
 * Returns one of: 'balances' | 'spend_7d' | 'txns_3' | 'help'
 */
export type Intent = 'balances' | 'spend_7d' | 'txns_3' | 'help';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

export async function chooseIntentFromText(userText: string): Promise<Intent> {
  if (!OPENAI_API_KEY) return 'help';

  const system = `You classify a short SMS into EXACTLY ONE of these tokens:
balances | spend_7d | txns_3 | help

Guidelines:
- "balance", "what's my balance", "how much money do i have", "cash" => balances
- "spent", "spend", "what did i spend this week", "weekly spend", "last 7 days" => spend_7d
- "transactions", "recent charges", "latest transactions", "what just posted" => txns_3
- Anything else => help
RETURN THE BARE TOKEN ONLY (no punctuation, no quotes).`;

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
      return 'help';
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim()?.toLowerCase?.() || 'help';
    if (text === 'balances' || text === 'spend_7d' || text === 'txns_3' || text === 'help') return text as Intent;
    return 'help';
  } catch (e) {
    const name = (e as Error)?.name;
    console.error('[llm.intent] exception', { model: MODEL, error: name || 'unknown' });
    return 'help';
  }
}

/**
 * Ask the model to produce the final SMS copy given tool results.
 * Pass only small, non-sensitive summaries.
 */
export async function generateReply(tool: Intent, context: Record<string, unknown>): Promise<string> {
  if (!OPENAI_API_KEY) return fallbackReply(tool, context);
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
      return fallbackReply(tool, context);
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() || fallbackReply(tool, context);
    return text;
  } catch (e) {
    const name = (e as Error)?.name;
    console.error('[llm.reply] exception', { model: MODEL, error: name || 'unknown' });
    return fallbackReply(tool, context);
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
  const balances = ctx.balances as { total: number; count: number } | undefined;
  const spend = ctx.spend as { total: number; top: { name: string; amount: number }[] } | undefined;
  const txns = ctx.txns as { date: string; merchant: string; amount: number }[] | undefined;
  const topLine = spend?.top?.slice(0,2).map(t => `${t.name} $${Math.round(t.amount)}`).join(', ') || '';
  const txnLine = (txns || []).slice(0,3).map(t => `$${t.amount.toFixed(2)} ${t.merchant} (${t.date})`).join('; ');
  return `User asked a general money question. Use the data below to give ONE concise, actionable tip if relevant.
If the question clearly asks for balances/spend/transactions, craft a 1–2 line answer using the data. Otherwise, give a useful tip.
Data (may be partial):
balances: total=${balances ? Math.round(balances.total) : 'n/a'}, accounts=${balances?.count ?? 'n/a'}
spend_7d: total=${spend ? Math.round(spend.total) : 'n/a'}, top=${topLine}
txns_3: ${txnLine}
Recent messages:\n${history}`;
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
  if (history) return `tip: ask for “balance”, “spent”, or “transactions” to get a quick read.`;
  return `tip: ask for “balance” to see cash, or “spent” for last 7 days.`;
}


