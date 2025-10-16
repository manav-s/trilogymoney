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
import { encryptMessage } from '@/lib/encryption';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { RATE_LIMIT_WINDOW_MS, MAX_MESSAGES_PER_WINDOW } from '@/lib/constants';

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
    // Temporary production log for debugging webhook receipt
    // eslint-disable-next-line no-console
    console.log('[Blooio] Webhook hit', {
      ts: new Date().toISOString(),
      contentType: req.headers.get('content-type'),
    });

    if (WEBHOOK_SECRET) {
      const sig = req.headers.get('x-blooio-signature');
      const ok = verifySignature(rawBody, sig, WEBHOOK_SECRET);
      if (!ok) {
        // eslint-disable-next-line no-console
        console.warn('[Blooio] Invalid signature');
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
    }

    const event: BlooioWebhookEvent = JSON.parse(rawBody);

    z.object({ event: z.string() }).parse(event);

    // eslint-disable-next-line no-console
    console.log('[Blooio] Event received', {
      event: event.event,
      from: event.external_id?.slice(-4),
      hasMessageId: Boolean(event.message_id),
    });

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
  const isOnboardingMessage = body === 'hi trilogy...' || body === 'hi trilogy…';

  if (!user) {
    // eslint-disable-next-line no-console
    console.log('[Blooio] No user found, creating new user for', phone);
    await handleNewUser(phone, event);
  } else if (isOnboardingMessage && user.onboardingStatus !== 'complete') {
    const magicLink = await generateMagicLink(phone);
    // eslint-disable-next-line no-console
    console.log('[Blooio] Onboarding message from existing user - sending link', { phone: phone.slice(-4) });
    const messages = [
      `hi it's your lovely blue-bubble cfo`,
      `onboarding link below. i'll be gentle. mostly.`,
      magicLink.trim(),
    ];
    for (let i = 0; i < messages.length; i++) {
      await sendMessage({ to: phone, body: messages[i] });
      if (i < messages.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  } else if (isOnboardingMessage && user.onboardingStatus === 'complete') {
    await sendMessage({ to: phone, body: `hey! you're all set up already. i'll hit you with your money pulse at ${user.preferredTime}. 💰` });
  } else {
    await handleExistingUser(user, event);
  }
}

async function handleNewUser(phone: string, _event: BlooioWebhookEvent) {
  const user = await prisma.user.create({
    data: { phone, consent: true, onboardingStatus: 'pre_auth', messagingStatus: 'inactive' },
  });
  // eslint-disable-next-line no-console
  console.log('[Blooio] New user created', { userId: user.id, last4: phone.slice(-4) });

  const magicLink = await generateMagicLink(phone);
  // eslint-disable-next-line no-console
  console.log('[Blooio] Sending onboarding magic link', { last4: phone.slice(-4), magicLink });
  const messages = [
    `hi it's your lovely blue-bubble cfo`,
    `onboarding link below. i'll be gentle. mostly.`,
    magicLink.trim(),
  ];

  for (let i = 0; i < messages.length; i++) {
    await sendMessage({ to: phone, body: messages[i] });
    // eslint-disable-next-line no-console
    console.log('[Blooio] Sent onboarding message', { index: i + 1, last4: phone.slice(-4) });
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

async function handleExistingUser(user: { phone: string | null; onboardingStatus: string; preferredTime: string; messagingStatus?: string }, event: BlooioWebhookEvent) {
  const body = event.text.toLowerCase().trim();
  if (user.messagingStatus === 'stopped') return;
  if (!user.phone) return;

  if (user.onboardingStatus !== 'complete') {
    if (body.includes('link') || body.includes('onboard') || body.includes('help')) {
      const magicLink = await generateMagicLink(user.phone);
      await sendMessage({ to: user.phone, body: `Here's a fresh link to finish setup (expires in 10 min):\n\n${magicLink}` });
    } else {
      await sendMessage({ to: user.phone, body: `You're almost there! Finish your setup to start getting your money pulse. Reply "link" for a fresh link.` });
    }
    return;
  }

  await sendMessage({ to: user.phone, body: `Got your message! I'll send your next money pulse at ${user.preferredTime}. Reply STOP to pause anytime.` });
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

