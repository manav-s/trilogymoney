/**
 * Conversational job helpers.
 * Handles the "ask first, then deliver" flow for scheduled jobs.
 */

import { logError } from '@/lib/utils/logger';

const MODEL = 'gpt-4.1-mini';

export type PendingJobType = 'balance' | 'weekly' | 'subscriptions';
export type PendingReplyIntent = 'YES' | 'NO' | 'OTHER';

const PENDING_JOB_QUESTIONS: Record<PendingJobType, string> = {
  balance: "hey! wanna hear your balance?",
  weekly: "your week in money is ready—want the recap?",
  subscriptions: "want to hear your subscriptions?",
};

const DECLINE_RESPONSES = [
  "okay hollywood 💅",
  "damn my fault",
  "lol damn, noted 📝",
  "my fault og 🫡",
  "say less 🤐",
  "aight bet",
];

export function getDeclineResponse(): string {
  return DECLINE_RESPONSES[Math.floor(Math.random() * DECLINE_RESPONSES.length)];
}

export function getPendingJobQuestion(jobType: PendingJobType): string {
  return PENDING_JOB_QUESTIONS[jobType];
}

/**
 * Use LLM to classify user's reply to a pending job question.
 * Returns YES (send data), NO (send sass), or OTHER (route to normal conversation).
 */
export async function classifyPendingReply(
  pendingJobType: string,
  userReply: string
): Promise<{ intent: PendingReplyIntent; followUp?: string }> {
  const question = PENDING_JOB_QUESTIONS[pendingJobType as PendingJobType] ?? "want this info?";

  // Default to OTHER if LLM fails - this routes to normal conversation, safest fallback
  const safeDefault: { intent: PendingReplyIntent; followUp?: string } = {
    intent: 'OTHER',
    followUp: userReply,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logError('conversational.classify', undefined, { reason: 'missing_api_key' });
    return safeDefault;
  }

  const prompt = `Classify the user's reply to a yes/no question.

We asked: "${question}"
User replied: "${userReply}"

What is their intent?
- YES = they want the information (e.g., "sure", "yeah", "👍", "send it", "ok", "yes please")
- NO = they declined (e.g., "nah", "no", "I'm good", "not now", "🙄", "later", "skip")
- OTHER = they ignored the question and asked something else entirely

Reply with exactly one word: YES, NO, or OTHER
If OTHER, add their actual question on line 2.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You classify user intent. Reply only with YES, NO, or OTHER.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      logError('conversational.classify', undefined, { reason: 'openai_error', status: res.status });
      return safeDefault;
    }

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!rawText) {
      logError('conversational.classify', undefined, { reason: 'empty_response' });
      return safeDefault;
    }

    const lines = rawText.split('\n');
    const intentRaw = lines[0].trim().toUpperCase();

    let intent: PendingReplyIntent;
    if (intentRaw === 'YES') {
      intent = 'YES';
    } else if (intentRaw === 'NO') {
      intent = 'NO';
    } else {
      intent = 'OTHER';
    }

    return {
      intent,
      followUp: intent === 'OTHER' ? (lines[1]?.trim() || userReply) : undefined,
    };
  } catch (error) {
    logError('conversational.classify', error, { reason: 'fetch_error' });
    return safeDefault;
  }
}
