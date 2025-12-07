import { getRecurringStreams } from '@/lib/services/recurring';
import { sendMessage } from '@/lib/integrations/blooio';
import { logError } from '@/lib/utils/logger';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type MonthlyDigestResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export async function sendMonthlyDigest(
  userId: string,
  phone: string
): Promise<MonthlyDigestResult> {
  let streams;
  try {
    streams = await getRecurringStreams(userId);
  } catch (e) {
    logError('monthly_digest.recurring', e, { userId });
    return { status: 'failed', reason: 'recurring_error' };
  }

  const active = streams
    .filter((s) => s.isActive)
    .sort((a, b) => b.amount - a.amount);

  if (active.length === 0) {
    await sendMessage({
      to: phone,
      body: "no recurring charges found. either you're debt-free or your banks aren't synced",
      userId,
      shouldPersist: true,
    });
    return { status: 'sent' };
  }

  const total = active.reduce((sum, s) => sum + s.amount, 0);
  const count = active.length;

  // Message 1: Count
  await sendMessage({
    to: phone,
    body: `monthly check-in. ${count} subscription${count !== 1 ? 's' : ''} on autopilot:`,
    userId,
    shouldPersist: true,
  });
  await delay(600);

  // Message 2: List (top 12)
  const list = active
    .slice(0, 12)
    .map((s) => `- ${cleanMerchant(s.merchant)} $${formatAmount(s.amount)}`)
    .join('\n');
  await sendMessage({ to: phone, body: list, userId, shouldPersist: true });
  await delay(600);

  // Message 3: Total
  await sendMessage({
    to: phone,
    body: `total: $${formatAmount(total)}/month`,
    userId,
    shouldPersist: true,
  });
  await delay(600);

  // Message 4: LLM Commentary
  const commentary = await generateMonthlyCommentary(active, total);
  await sendMessage({ to: phone, body: commentary, userId, shouldPersist: true });

  return { status: 'sent' };
}

function cleanMerchant(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatAmount(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  const str = n.toFixed(2);
  return str.endsWith('.00') ? str.slice(0, -3) : str;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateMonthlyCommentary(
  subs: Array<{ merchant: string; amount: number }>,
  total: number
): Promise<string> {
  const fallback = 'just a friendly reminder these are all on autopilot';

  if (!OPENAI_API_KEY) return fallback;

  const topMerchants = subs
    .slice(0, 5)
    .map((s) => `${s.merchant} $${s.amount}`)
    .join(', ');

  const prompt = `You're a brutally honest money friend commenting on someone's subscriptions.

Their subscriptions: ${topMerchants}
Total: $${total}/month
Count: ${subs.length}

Write ONE short, direct comment (under 100 chars). Lowercase, no emoji unless they're being ridiculous. Be judgy if warranted. Be specific to their merchants.

Examples:
- "that's a lot of streaming for someone who rewatches the office"
- "$2k/month on autopilot. you sure about all these?"
- "spotify and apple music? pick one"`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.9,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return fallback;

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    return text || fallback;
  } catch {
    return fallback;
  }
}
