import { prisma } from '@/lib/db';
import { sendMessage } from '@/lib/blooio';
import { getBalancesBreakdown } from '@/lib/balances';
import { generateReply } from '@/lib/llm';
import { splitIntoSmsSegments } from '@/lib/sms';
import { logError, logger } from '@/lib/logger';

const WELCOME_SCRIPT = `welcome to trilogy! you're live now.

- weekly digest will send soon
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
        postCheckoutBalanceSentAt: true,
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

    // Step 2: Send balance summary via LLM (idempotent)
    await sendBalanceSummary(user);

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

/**
 * Generate and send balance summary using existing LLM + balance fetcher.
 */
async function sendBalanceSummary(user: { id: string; phone: string | null; postCheckoutBalanceSentAt: Date | null }): Promise<void> {
  if (!user.phone) return;
  try {
    // Idempotence check
    if (user.postCheckoutBalanceSentAt) {
      logger.info('[post-checkout.balance.already_sent]', { userId: user.id });
      return;
    }

    const updated = await prisma.user.updateMany({
      where: { id: user.id, postCheckoutBalanceSentAt: null },
      data: { postCheckoutBalanceSentAt: new Date() },
    });

    if (updated.count === 0) {
      logger.info('[post-checkout.balance.race_lost]', { userId: user.id });
      return;
    }

    logger.info('[post-checkout.balance.fetching]', { userId: user.id });
    const breakdown = await getBalancesBreakdown({ userId: user.id });

    const cashInstitutions = [...new Set(breakdown.cash.accounts.map((a) => a.institution).filter(Boolean))] as string[];
    const cardInstitutions = [...new Set(breakdown.credit.accounts.map((a) => a.institution).filter(Boolean))] as string[];

    const cashAccountsJson = JSON.stringify(
      breakdown.cash.accounts.slice(0, 5).map((a) => ({
        name: a.name,
        institution: a.institution ?? 'unknown',
        mask: a.mask ?? undefined,
      }))
    );

    const cardAccountsJson = JSON.stringify(
      breakdown.credit.accounts.slice(0, 5).map((a) => ({
        name: a.name,
        institution: a.institution ?? 'unknown',
        mask: a.mask ?? undefined,
      }))
    );

    logger.info('[post-checkout.balance.calling_llm]', {
      userId: user.id,
      cashCount: breakdown.cash.count,
      cardCount: breakdown.credit.count,
    });

    let body: string;
    try {
      body = await generateReply('balances', {
        cashTotal: breakdown.cash.total,
        cashCount: breakdown.cash.count,
        cashInstitutions: cashInstitutions.length > 0 ? cashInstitutions : null,
        cashAccountsJson,
        cardOwedTotal: breakdown.credit.owedTotal,
        cardCount: breakdown.credit.count,
        cardInstitutions: cardInstitutions.length > 0 ? cardInstitutions : null,
        cardAccountsJson,
        userText: 'give the new member a quick balance snapshot',
        history: '',
        profile: {},
        quizAnswers: null,
        analysisSummary: null,
      });

      if (!body || body.includes('having trouble')) {
        throw new Error('LLM returned empty or error message');
      }

      logger.info('[post-checkout.balance.llm_success]', { userId: user.id, bodyLength: body.length });
    } catch (llmError) {
      logError('post-checkout.balance.llm_fallback', llmError, { userId: user.id });
      // Fallback message
      const totalAccounts = breakdown.cash.count + breakdown.credit.count;
      const cashTotal = Math.round(breakdown.cash.total);
      const creditOwed = Math.round(breakdown.credit.owedTotal);

      if (totalAccounts === 0) {
        body = "we'll send your first digest once your accounts sync.";
      } else if (breakdown.credit.count === 0) {
        body = `latest sync shows $${cashTotal} across ${breakdown.cash.count} account${breakdown.cash.count === 1 ? '' : 's'}.`;
      } else if (breakdown.cash.count === 0) {
        body = `latest sync shows $${creditOwed} owed across ${breakdown.credit.count} card${breakdown.credit.count === 1 ? '' : 's'}.`;
      } else {
        body = `latest sync shows $${cashTotal} in cash and $${creditOwed} owed across ${totalAccounts} accounts.`;
      }
      logger.info('[post-checkout.balance.using_fallback]', { userId: user.id });
    }

    logger.info('[post-checkout.balance.sending]', { userId: user.id });
    const segments = splitIntoSmsSegments(body);
    for (const segment of segments) {
      await sendMessage({
        to: user.phone,
        body: segment,
        userId: user.id,
        shouldPersist: true,
      });
    }
    logger.info('[post-checkout.balance.sent]', { userId: user.id, segments: segments.length });
  } catch (error) {
    logError('post-checkout.balance', error, { userId: user.id });
    throw error;
  }
}

