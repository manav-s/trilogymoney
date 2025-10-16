/**
 * Blooio SMS/iMessage API client
 * Docs: https://imessages.readme.io/reference
 */

import { createHmac, timingSafeEqual } from 'crypto';

const BLOOIO_API_KEY = process.env.BLOOIO_API_KEY;
const BLOOIO_BASE_URL = 'https://edge.blooio.com/v1/api';

// Note: intentionally no logs in production

export interface SendMessageOptions {
  to: string; // E.164 format: +15551234567
  body: string;
  mediaUrl?: string; // Optional attachment URL
}

export interface BlooioMessageResponse {
  id: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  to: string;
  body: string;
  direction: 'outbound';
  createdAt: string;
}

export interface BlooioWebhookEvent {
  event: 'message.received' | 'message.sent' | 'message.delivered' | 'message.failed' | 'message.read';
  message_id: string;
  external_id: string; // E.164 format - the sender's phone number
  text: string;
  attachments?: unknown[];
  protocol: 'imessage' | 'sms';
  timestamp: number;
  received_at: number;
  device_id?: string;
}

/**
 * Send an outbound message via Blooio
 */
export async function sendMessage(options: SendMessageOptions): Promise<BlooioMessageResponse> {
  if (!BLOOIO_API_KEY) {
    throw new Error('BLOOIO_API_KEY not configured');
  }

  let lastError: unknown = undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${BLOOIO_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BLOOIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: options.to,
          text: options.body, // Blooio uses 'text' not 'body'
          ...(options.mediaUrl && { media_url: options.mediaUrl }),
        }),
      });

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const hasBody = response.status !== 204;
      const data = (isJson && hasBody) ? await response.json() : {} as Record<string, unknown>;

      if (!response.ok) {
        // retry on 5xx/network errors
        if (response.status >= 500 && response.status <= 599 && attempt < 3) {
          const backoff = 200 * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        throw new Error(`Blooio API error: ${response.status} - ${String((data as any)?.error || (data as any)?.message || 'Unknown error')}`);
      }

      return {
        id: (data as any)?.id || (data as any)?.messageId || (data as any)?.message_id || 'unknown',
        status: 'sent',
        to: options.to,
        body: options.body,
        direction: 'outbound',
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        const backoff = 200 * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown error sending message');
}

/**
 * Configure webhook URL for receiving message events
 * Should be called once during setup
 */
export async function configureWebhook(webhookUrl: string): Promise<void> {
  if (!BLOOIO_API_KEY) {
    throw new Error('BLOOIO_API_KEY not configured');
  }

  const response = await fetch(`${BLOOIO_BASE_URL}/config/webhook`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${BLOOIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({ webhook_url: webhookUrl }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to configure webhook: ${response.status} - ${error}`);
  }
}

/**
 * Get current webhook configuration
 */
export async function getWebhookConfig(): Promise<{ url: string }> {
  if (!BLOOIO_API_KEY) {
    throw new Error('BLOOIO_API_KEY not configured');
  }

  const response = await fetch(`${BLOOIO_BASE_URL}/config/webhook`, {
    headers: {
      'Authorization': `Bearer ${BLOOIO_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get webhook config: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Verify Blooio webhook signature (sha256 HMAC over raw body)
 */
export function verifyBlooioSignature(rawBody: string, headerSig: string | null, secret: string): boolean {
  if (!headerSig) return false;
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = headerSig.startsWith('sha256=') ? headerSig.slice(7) : headerSig;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * Format phone number to E.164
 */
export function formatE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 1 and has 11 digits (US/Canada)
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }
  
  // If has 10 digits, assume US/Canada
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If already has country code
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  throw new Error(`Invalid phone number format: ${phone}`);
}

/**
 * Send onboarding welcome message with magic link
 */
export async function sendOnboardingWelcome(phone: string, magicLink: string): Promise<void> {
  const message = `Yo, I'm Trilogy—WHOOP for your wallet. 90-sec setup to get your money pulse. Ready?\n\n${magicLink}\n\nMsg/data rates may apply. Reply STOP to opt out.`;
  
  await sendMessage({
    to: phone,
    body: message,
  });
}

/**
 * Send money pulse (daily update)
 */
export async function sendMoneyPulse(
  phone: string,
  balance: number,
  yesterday: number,
  thisWeek: number
): Promise<void> {
  const message = `checking in on you 👀

💰 balance:
$${balance.toFixed(2)}

💸 yesterday:
${yesterday < 0 ? '-' : '+'}$${Math.abs(yesterday).toFixed(2)}

📊 this week:
${thisWeek < 0 ? '-' : '+'}$${Math.abs(thisWeek).toFixed(2)}

${getPlayfulComment(yesterday, thisWeek)}`;

  await sendMessage({
    to: phone,
    body: message,
  });
}

/**
 * Generate playful comment based on spending
 */
function getPlayfulComment(yesterday: number, thisWeek: number): string {
  const comments = {
    good: [
      "you're killing it! 🎯",
      "financial discipline unlocked 🔓",
      "chef's kiss on that budget 👨‍🍳💋",
    ],
    warning: [
      "maybe lay off the doordash today? 🤨",
      "those coffee runs adding up... ☕️",
      "your wallet called, it's tired 😴",
    ],
    neutral: [
      "keeping it steady 📊",
      "another day, another dollar 💵",
      "you do you 🤷",
    ],
  };

  if (yesterday > 150 || thisWeek > 500) {
    return comments.warning[Math.floor(Math.random() * comments.warning.length)];
  } else if (yesterday < 50 && thisWeek < 200) {
    return comments.good[Math.floor(Math.random() * comments.good.length)];
  } else {
    return comments.neutral[Math.floor(Math.random() * comments.neutral.length)];
  }
}
