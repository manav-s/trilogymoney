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

// Rate limiting: track recent messages by phone
const recentMessages = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 3;

export async function POST(req: NextRequest) {
  try {
    const event: BlooioWebhookEvent = await req.json();
    
    // Log the entire raw event to see Blooio's actual payload structure
    console.log('[Blooio Webhook] RAW EVENT:', JSON.stringify(event, null, 2));
    
    console.log(`[Blooio Webhook] ${event.event}:`, {
      from: event.external_id,
      text: event.text?.substring(0, 50),
      protocol: event.protocol,
    });

    // Handle different event types
    switch (event.event) {
      case 'message.received':
        await handleInboundMessage(event);
        break;
      
      case 'message.delivered':
      case 'message.read':
        await handleMessageStatus(event);
        break;
      
      default:
        console.log(`[Blooio Webhook] Unhandled event type: ${event.event}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Blooio Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle inbound message from user
 */
async function handleInboundMessage(event: BlooioWebhookEvent) {
  const phone = formatE164(event.external_id);
  const body = event.text.toLowerCase().trim();
  
  // Rate limiting check
  if (isRateLimited(phone)) {
    console.warn(`[Rate Limit] ${phone} exceeded rate limit`);
    return;
  }

  // Log the inbound message (encrypted)
  await prisma.message.create({
    data: {
      user: { connect: { phone } },
      direction: 'inbound',
      content: encryptMessage(event.text),
      status: 'received',
      provider: 'blooio',
      providerId: event.message_id,
      sentAt: new Date(event.timestamp),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    },
  }).catch(() => {
    // If user doesn't exist yet, that's okay - we'll create them
  });

  // Handle STOP command
  if (body === 'stop' || body === 'unsubscribe' || body === 'cancel') {
    await handleStopCommand(phone);
    return;
  }

  // Handle START/RESUME command
  if (body === 'start' || body === 'resume' || body === 'unstop') {
    await handleStartCommand(phone);
    return;
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { phone },
  });

  // Check if this is an onboarding message (handle both ... and … ellipsis)
  const isOnboardingMessage = body === 'hi trilogy...' || body === 'hi trilogy…';

  if (!user) {
    // NEW USER: First-time text → create provisional user & send magic link
    await handleNewUser(phone, event);
  } else if (isOnboardingMessage && user.onboardingStatus !== 'complete') {
    // User texted again during onboarding → send fresh magic link
    const magicLink = await generateMagicLink(phone);
    const messages = [
      `hi it's your lovely blue-bubble cfo`,
      `onboarding link below. i'll be gentle. mostly.`,
      magicLink.trim(), // Ensure no spaces around the URL
    ];
    
    for (let i = 0; i < messages.length; i++) {
      await sendMessage({
        to: phone,
        body: messages[i],
      });
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } else if (isOnboardingMessage && user.onboardingStatus === 'complete') {
    // User is already onboarded → send alternate message
    await sendMessage({
      to: phone,
      body: `hey! you're all set up already. i'll hit you with your money pulse at ${user.preferredTime}. 💰`,
    });
  } else {
    // EXISTING USER: Handle based on onboarding status
    await handleExistingUser(user, event);
  }
}

/**
 * Handle new user (first time texting)
 */
async function handleNewUser(phone: string, _event: BlooioWebhookEvent) {
  console.log(`[New User] Creating provisional user for ${phone}`);
  
  // Create provisional user
  const user = await prisma.user.create({
    data: {
      phone,
      consent: true,
      onboardingStatus: 'pre_auth',
      messagingStatus: 'inactive',
    },
  });

  // Log event
  console.log(`[Onboarding.Started (imessage)] User: ${user.id}, Phone: ${phone}`);

  // Generate magic link
  const magicLink = await generateMagicLink(phone);

  // Send onboarding message in 3 separate texts
  const messages = [
    `hi it's your lovely blue-bubble cfo`,
    `onboarding link below. i'll be gentle. mostly.`,
    magicLink.trim(), // Ensure no spaces around the URL
  ];

  // Send each message with a small delay
  for (let i = 0; i < messages.length; i++) {
    await sendMessage({
      to: phone,
      body: messages[i],
    });

    // Log outbound message
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

    // Small delay between messages (500ms)
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * Handle existing user message
 */
async function handleExistingUser(user: { phone: string | null; onboardingStatus: string; preferredTime: string; messagingStatus?: string }, event: BlooioWebhookEvent) {
  const body = event.text.toLowerCase().trim();

  // If user is stopped, ignore (unless they said START)
  if (user.messagingStatus === 'stopped') {
    return;
  }

  // Guard: Skip if phone is null (shouldn't happen)
  if (!user.phone) {
    console.error('[handleExistingUser] User has no phone number');
    return;
  }

  // If user is still onboarding
  if (user.onboardingStatus !== 'complete') {
    // Send fresh magic link if they're asking for help
    if (body.includes('link') || body.includes('onboard') || body.includes('help')) {
      const magicLink = await generateMagicLink(user.phone);
      await sendMessage({
        to: user.phone,
        body: `Here's a fresh link to finish setup (expires in 10 min):\n\n${magicLink}`,
      });
    } else {
      // Gentle reminder
      await sendMessage({
        to: user.phone,
        body: `You're almost there! Finish your setup to start getting your money pulse. Reply "link" for a fresh link.`,
      });
    }
    return;
  }

  // User is fully onboarded - handle as general message
  // Could add commands here like "balance", "stats", "pause", etc.
  await sendMessage({
    to: user.phone,
    body: `Got your message! I'll send your next money pulse at ${user.preferredTime}. Reply STOP to pause anytime.`,
  });
}

/**
 * Handle STOP command (opt-out)
 */
async function handleStopCommand(phone: string) {
  console.log(`[STOP Command] ${phone}`);
  
  await prisma.user.update({
    where: { phone },
    data: {
      messagingStatus: 'stopped',
      isActive: false,
    },
  });

  await sendMessage({
    to: phone,
    body: `You've been unsubscribed from Trilogy. You won't receive any more messages. Reply START to re-subscribe anytime.`,
  });
}

/**
 * Handle START command (opt back in)
 */
async function handleStartCommand(phone: string) {
  console.log(`[START Command] ${phone}`);
  
  const user = await prisma.user.findUnique({
    where: { phone },
  });

  if (!user) {
    // Treat as new user
    await handleNewUser(phone, {
      event: 'message.received',
      message_id: 'manual-start',
      external_id: phone,
      text: 'START',
      protocol: 'sms',
      timestamp: Date.now(),
      received_at: Date.now(),
    });
    return;
  }

  await prisma.user.update({
    where: { phone },
    data: {
      messagingStatus: 'active',
      isActive: true,
    },
  });

  await sendMessage({
    to: phone,
    body: `Welcome back! You're re-subscribed to your daily money pulse. 🎉`,
  });
}

/**
 * Handle message status updates
 */
async function handleMessageStatus(event: BlooioWebhookEvent) {
  // Update message status in database if we track outbound messages
  if (event.message_id) {
    await prisma.message.updateMany({
      where: { providerId: event.message_id },
      data: {
        status: event.event === 'message.delivered' ? 'delivered' : 
                event.event === 'message.read' ? 'read' : 'sent',
      },
    });
  }
}

/**
 * Rate limiting helper
 */
function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const lastMessage = recentMessages.get(phone) || 0;
  
  if (now - lastMessage < RATE_LIMIT_WINDOW) {
    const count = Array.from(recentMessages.entries())
      .filter(([p, time]) => p === phone && now - time < RATE_LIMIT_WINDOW)
      .length;
    
    if (count >= MAX_MESSAGES_PER_WINDOW) {
      return true;
    }
  }
  
  recentMessages.set(phone, now);
  
  // Clean up old entries
  if (recentMessages.size > 1000) {
    for (const [p, time] of recentMessages.entries()) {
      if (now - time > RATE_LIMIT_WINDOW) {
        recentMessages.delete(p);
      }
    }
  }
  
  return false;
}

