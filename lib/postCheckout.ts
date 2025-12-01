import { prisma } from '@/lib/db/db';
import { sendMessage } from '@/lib/integrations/blooio';
import { logError, logger } from '@/lib/utils/logger';
import { runWeeklyDigestForUser } from '@/lib/jobs/weeklyDigestJob';

const WELCOME_SCRIPT = `welcome to trilogy! you're live now.

- weekly digest from last week will send soon
- visit trytrilogy.com to adjust your account settings or add more accounts
- you can always ask me about your balances or spending`;

/**
 * Coordinator: runs post-checkout activation flow.
 * Called by Stripe webhook after checkout.session.completed.
 */
export async function handlePostCheckoutActivation(userId: string): Promise<void> {
  try {
    logger.info('[post-checkout.start]', { userId });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        welcomeSentAt: true,
        messagingStatus: true,
        isActive: true,
      },
    });

    if (!user || !user.phone) {
      logger.info('[post-checkout.no_user_or_phone]', { userId });
      return;
    }

    if (user.messagingStatus !== 'active' || !user.isActive) {
      logger.info('[post-checkout.not_active]', { userId, messagingStatus: user.messagingStatus, isActive: user.isActive });
      return;
    }

    // Step 1: Send welcome script (idempotent)
    await sendWelcomeScript(user);

    // Step 2: Kick off an immediate weekly digest using the shared job helper
    const digestResult = await runWeeklyDigestForUser(user.id, { trigger: 'onboarding' });
    logger.info('[post-checkout.weekly_digest]', { userId: user.id, status: digestResult.status, reason: (digestResult as { reason?: string }).reason });

    logger.info('[post-checkout.complete]', { userId });
  } catch (error) {
    logError('post-checkout.coordinator', error, { userId });
  }
}

/**
 * Send the fixed welcome script once per user.
 */
async function sendWelcomeScript(user: { id: string; phone: string | null; welcomeSentAt: Date | null }): Promise<void> {
  if (!user.phone) return;
  try {
    // Idempotence check: atomic set welcomeSentAt if null
    if (user.welcomeSentAt) {
      logger.info('[post-checkout.welcome.already_sent]', { userId: user.id });
      return;
    }

    const updated = await prisma.user.updateMany({
      where: { id: user.id, welcomeSentAt: null },
      data: { welcomeSentAt: new Date() },
    });

    if (updated.count === 0) {
      // Another process already set it
      logger.info('[post-checkout.welcome.race_lost]', { userId: user.id });
      return;
    }

    logger.info('[post-checkout.welcome.sending]', { userId: user.id });
    await sendMessage({
      to: user.phone,
      body: WELCOME_SCRIPT,
      userId: user.id,
      shouldPersist: true,
    });
    logger.info('[post-checkout.welcome.sent]', { userId: user.id });
  } catch (error) {
    logError('post-checkout.welcome', error, { userId: user.id });
    throw error;
  }
}
