/**
 * Blooio SMS/iMessage API client
 * Docs: https://imessages.readme.io/reference
 */

const BLOOIO_API_KEY = process.env.BLOOIO_API_KEY;
const BLOOIO_BASE_URL = 'https://edge.blooio.com/v1/api';

if (!BLOOIO_API_KEY) {
  console.warn('⚠️  BLOOIO_API_KEY not set - SMS functionality will not work');
}

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

  console.log('[sendMessage] Sending to:', options.to);
  console.log('[sendMessage] Message:', options.body);

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

  console.log('[sendMessage] Response status:', response.status);
  
  const data = await response.json();
  console.log('[sendMessage] Response data:', JSON.stringify(data));

  if (!response.ok) {
    console.error('[sendMessage] Blooio API error:', data);
    throw new Error(`Blooio API error: ${response.status} - ${data.error || data.message || 'Unknown error'}`);
  }

  console.log('[sendMessage] Success! Message ID:', data.id || data.messageId);

  return {
    id: data.id || data.messageId || data.message_id,
    status: 'sent',
    to: options.to,
    body: options.body,
    direction: 'outbound',
    createdAt: new Date().toISOString(),
  };
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
 * Validate Blooio webhook signature (if they provide one)
 * Check their docs for signature validation
 */
export function validateWebhookSignature(
  _payload: string,
  _signature: string,
  _secret: string
): boolean {
  // TODO: Implement based on Blooio's signature scheme
  // For now, we'll validate based on API key match or implement later
  return true;
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
