/**
 * Blooio Webhook Handler
 * Receives inbound message events from Blooio
 * 
 * Events:
 * - message.received: User sends us a message
 * - message.delivered: Our outbound message delivered
 * - message.read: User read our message (iMessage only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BlooioWebhookEvent, formatE164 } from '@/lib/blooio';
import { generateMagicLink } from '@/lib/magic-link';
import { sendMessage } from '@/lib/blooio';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { generateReply, chooseIntentFromText } from '@/lib/llm';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { RATE_LIMIT_WINDOW_MS, MAX_MESSAGES_PER_WINDOW } from '@/lib/constants';
import { getBalances, getBalancesBreakdown } from '@/lib/balances';

const WEBHOOK_SECRET = process.env.BLOOIO_WEBHOOK_SECRET;

function verifySignature(rawBody: string, headerSig: string | null, secret: string): boolean {
  if (!headerSig) return false;
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = headerSig.startsWith('sha256=') ? headerSig.slice(7) : headerSig;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const sig =
      req.headers.get('x-blooio-signature') ||
      req.headers.get('x-blooio-signature-sha256') ||
      req.headers.get('x-signature');
    if (WEBHOOK_SECRET) {
      const ok = verifySignature(rawBody, sig, WEBHOOK_SECRET);
      if (!ok) {
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
    }

    const event: BlooioWebhookEvent = JSON.parse(rawBody);

    z.object({ event: z.string() }).parse(event);

    switch (event.event) {
      case 'message.received':
        await handleInboundMessage(event);
        break;
      case 'message.delivered':
      case 'message.read':
        await handleMessageStatus(event);
        break;
      default:
        break;
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleInboundMessage(event: BlooioWebhookEvent) {
  const phone = formatE164(event.external_id);
  const body = event.text.toLowerCase().trim();

  if (event.message_id) {
    const existing = await prisma.message.findFirst({ where: { providerId: event.message_id } });
    if (existing) return;
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await prisma.message.count({
    where: { direction: 'inbound', sentAt: { gte: since }, user: { phone } },
  });
  if (recentCount >= MAX_MESSAGES_PER_WINDOW) return;

  await prisma.message.create({
    data: {
      user: { connect: { phone } },
      direction: 'inbound',
      content: encryptMessage(event.text),
      status: 'received',
      provider: 'blooio',
      providerId: event.message_id,
      sentAt: new Date(event.timestamp),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  }).catch(() => {});

  if (body === 'stop' || body === 'unsubscribe' || body === 'cancel') {
    await handleStopCommand(phone);
    return;
  }
  if (body === 'start' || body === 'resume' || body === 'unstop') {
    await handleStartCommand(phone);
    return;
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  const isOnboardingMessage = body === 'hi trilogy...';

  // Sign-in cue
  if (body === 'pass the sign in link') {
    if (!user) {
      // No account yet → start onboarding flow and send onboarding messages
      await handleNewUser(phone, event);
      return;
    }

    const isBillingOk = !!user?.billingStatus && (user.billingStatus === 'active' || user.billingStatus === 'trialing');
    const isMessagingActive = user?.messagingStatus === 'active' && user?.isActive !== false;
    const isOnboardingComplete = user?.onboardingStatus === 'complete' || user?.onboardingStatus === 'subscribed';

    if (isBillingOk && isMessagingActive && isOnboardingComplete) {
      // Happy path → send sign-in magic link
      const magicLink = await generateMagicLink(phone);
      await sendMessage({ to: phone, body: `here's your sign-in link (expires in 10 min):\n\n${magicLink}` });
      return;
    }

    // If paused/stopped
    if (user.messagingStatus === 'stopped' || user.isActive === false) {
      await sendMessage({ to: phone, body: `you're paused. reply START to resume.` });
      return;
    }

    // If onboarding not finished (or explicitly inactive) → push onboarding messages with fresh link
    if (user.messagingStatus === 'inactive' || !isOnboardingComplete) {
      const magicLink = await generateMagicLink(phone);
      const messages = [
        `hi it's your lovely blue-bubble cfo`,
        `onboarding link below. i'll be gentle. mostly.`,
        magicLink.trim(),
      ];
      for (let i = 0; i < messages.length; i++) {
        await sendMessage({ to: phone, body: messages[i] });
        if (i < messages.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      return;
    }

    // Billing not active/trialing → advise to re-subscribe
    if (!isBillingOk) {
      await sendMessage({ to: phone, body: `your subscription isn't active. sign in from the link in your email or visit the billing portal to re-subscribe.` });
      return;
    }

    return;
  }

  if (!user) {
    await handleNewUser(phone, event);
  } else if (isOnboardingMessage && !(user.onboardingStatus === 'complete' || user.onboardingStatus === 'subscribed')) {
    const magicLink = await generateMagicLink(phone);
    const messages = [
      `hi it's your lovely blue-bubble cfo`,
      `onboarding link below. i'll be gentle. mostly.`,
      magicLink.trim(),
    ];
    for (let i = 0; i < messages.length; i++) {
      await sendMessage({ to: phone, body: messages[i] });
      if (i < messages.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  } else if (isOnboardingMessage && (user.onboardingStatus === 'complete' || user.onboardingStatus === 'subscribed')) {
    await sendMessage({ to: phone, body: `you’re set up already my love, go away` });
  } else {
    await handleExistingUser(user, event);
  }
}

async function handleNewUser(phone: string, _event: BlooioWebhookEvent) {
  const user = await prisma.user.create({
    data: { phone, consent: true, onboardingStatus: 'pre_auth', messagingStatus: 'inactive' },
  });

  const magicLink = await generateMagicLink(phone);
  const messages = [
    `hi it's your lovely blue-bubble cfo`,
    `onboarding link below. i'll be gentle. mostly.`,
    magicLink.trim(),
  ];

  for (let i = 0; i < messages.length; i++) {
    await sendMessage({ to: phone, body: messages[i] });
    await prisma.message.create({
      data: {
        userId: user.id,
        direction: 'outbound',
        content: encryptMessage(messages[i]),
        status: 'sent',
        provider: 'blooio',
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    if (i < messages.length - 1) await new Promise(r => setTimeout(r, 500));
  }
}

type ExistingUserContext = {
  phone: string | null;
  onboardingStatus: string;
  preferredTime: string;
  messagingStatus?: string;
  billingStatus?: string | null;
  isActive?: boolean | null;
};

async function handleExistingUser(user: ExistingUserContext, event: BlooioWebhookEvent) {
  const body = event.text.toLowerCase().trim();
  if (user.messagingStatus === 'stopped') return;
  if (!user.phone) return;

  const onboardingComplete = user.onboardingStatus === 'complete' || user.onboardingStatus === 'subscribed';
  const isPaid = user.billingStatus === 'active' || user.billingStatus === 'trialing';
  const isActive = user.messagingStatus === 'active' && user.isActive !== false;

  if (!onboardingComplete) {
    if (isPaid && isActive) {
      await handleLLMConversation(user.phone, body);
    } else {
      if (body.includes('link') || body.includes('onboard') || body.includes('help')) {
        const magicLink = await generateMagicLink(user.phone);
        await sendMessage({ to: user.phone, body: `Here's a fresh link to finish setup (expires in 10 min):\n\n${magicLink}` });
      } else {
        await sendMessage({ to: user.phone, body: `You're almost there! Finish your setup to start getting your money pulse. Reply "link" for a fresh link.` });
      }
    }
    return;
  }
  // Subscribed/complete users: route to conversational LLM (no tools yet)
  await handleLLMConversation(user.phone, body);
  return;
}

async function handleLLMConversation(phone: string, userText: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return;
  const isPaid = user.billingStatus === 'active' || user.billingStatus === 'trialing';
  const isActive = user.messagingStatus === 'active' && user.isActive !== false;
  if (!(isPaid && isActive)) return;

  const history = await getRecentHistorySnippet(user.id, 30, 30);
  let body = '';
  try {
    const profile = { name: user.name, timezone: user.timezone, preferredTime: user.preferredTime } as const;
    const intent = await chooseIntentFromText(userText);
    if (intent === 'balances') {
      const breakdown = await getBalancesBreakdown({ userId: user.id });
      const cashInstitutions = [...new Set(breakdown.cash.accounts.map(a => a.institution).filter(Boolean))] as string[];
      const cardInstitutions = [...new Set(breakdown.credit.accounts.map(a => a.institution).filter(Boolean))] as string[];
      const cashAccountsJson = JSON.stringify(
        breakdown.cash.accounts.slice(0, 5).map(a => ({
          name: a.name,
          institution: a.institution ?? 'unknown',
          mask: a.mask ?? undefined,
        })),
      );
      const cardAccountsJson = JSON.stringify(
        breakdown.credit.accounts.slice(0, 5).map(a => ({
          name: a.name,
          institution: a.institution ?? 'unknown',
          mask: a.mask ?? undefined,
        })),
      );
      body = await generateReply('balances', {
        cashTotal: breakdown.cash.total,
        cashCount: breakdown.cash.count,
        cashInstitutions: cashInstitutions.length > 0 ? cashInstitutions : null,
        cashAccountsJson,
        cardOwedTotal: breakdown.credit.owedTotal,
        cardCount: breakdown.credit.count,
        cardInstitutions: cardInstitutions.length > 0 ? cardInstitutions : null,
        cardAccountsJson,
        history,
        userText,
        profile,
        quizAnswers: (user as unknown as { quizAnswers?: unknown }).quizAnswers ?? null,
        analysisSummary: (user as unknown as { analysisSummary?: unknown }).analysisSummary ?? null,
      });
    } else {
      body = await generateReply('chat', {
        history,
        userText,
        quizAnswers: (user as unknown as { quizAnswers?: unknown }).quizAnswers ?? null,
        analysisSummary: (user as unknown as { analysisSummary?: unknown }).analysisSummary ?? null,
        profile,
      });
    }
  } catch {
    body = /^(hi|hey|hello|yo|sup|howdy)\b/i.test(userText)
      ? 'hey—what money thing can I help with today? balance, last‑week spend, or a recent charge?'
      : 'how can I help with money today? balance, last‑week spend, or a recent charge?';
  }
  await sendMessage({ to: phone, body });
}

async function getRecentHistorySnippet(userId: string, days = 30, limit = 30): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const msgs = await prisma.message.findMany({
    where: { userId, sentAt: { gte: since } },
    orderBy: { sentAt: 'desc' },
    take: limit,
  });
  const lines: string[] = [];
  for (const m of msgs.reverse()) {
    try {
      const role = m.direction === 'inbound' ? 'you' : 'trilogy';
      const text = decryptMessage(m.content).replace(/\s+/g, ' ').slice(0, 140);
      lines.push(`${role}: ${text}`);
    } catch {}
  }
  return lines.join('\n');
}

async function handleStopCommand(phone: string) {
  await prisma.user.update({ where: { phone }, data: { messagingStatus: 'stopped', isActive: false } });
  await sendMessage({ to: phone, body: `You've been unsubscribed from Trilogy. You won't receive any more messages. Reply START to re-subscribe anytime.` });
}

async function handleStartCommand(phone: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    await handleNewUser(phone, { event: 'message.received', message_id: 'manual-start', external_id: phone, text: 'START', protocol: 'sms', timestamp: Date.now(), received_at: Date.now() });
    return;
  }
  await prisma.user.update({ where: { phone }, data: { messagingStatus: 'active', isActive: true } });
  await sendMessage({ to: phone, body: `Welcome back! You're re-subscribed to your daily money pulse. 🎉` });
}

async function handleMessageStatus(event: BlooioWebhookEvent) {
  if (event.message_id) {
    await prisma.message.updateMany({
      where: { providerId: event.message_id },
      data: { status: event.event === 'message.delivered' ? 'delivered' : event.event === 'message.read' ? 'read' : 'sent' },
    });
  }
}

