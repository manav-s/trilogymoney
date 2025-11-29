import { prisma } from '@/lib/db/db';
import { sendMessage } from '@/lib/integrations/blooio';
import { getBalancesBreakdown } from '@/lib/services/balances';
import { generateReply } from '@/lib/ai/llm';
import { splitIntoSmsSegments } from '@/lib/integrations/sms';
import { logError } from '@/lib/utils/logger';
import { checkAndAlertLowBalance } from '@/lib/lowBalanceAlert';
import { getPendingJobQuestion } from '@/lib/conversational';

type BalanceUpdateResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

type AskBalanceResult =
  | { status: 'asked' }
  | { status: 'skipped'; reason: string };

const ACTIVE_BILLING_STATUSES = ['active', 'trialing'];

function buildFallbackMessage(breakdown: Awaited<ReturnType<typeof getBalancesBreakdown>>): string {
  const totalAccounts = breakdown.cash.count + breakdown.credit.count;
  const cashTotal = Math.round(breakdown.cash.total);
  const creditOwed = Math.round(breakdown.credit.owedTotal);

  if (totalAccounts === 0) {
    return "we'll send your first balance pulse once your accounts sync.";
  }
  if (breakdown.credit.count === 0) {
    return `latest balance pulse: $${cashTotal} across ${breakdown.cash.count} account${breakdown.cash.count === 1 ? '' : 's'}.`;
  }
  if (breakdown.cash.count === 0) {
    return `latest balance pulse: $${creditOwed} owed across ${breakdown.credit.count} card${breakdown.credit.count === 1 ? '' : 's'}.`;
  }
  return `latest balance pulse: $${cashTotal} in cash and $${creditOwed} owed across ${totalAccounts} accounts.`;
}

export async function runBalanceUpdateForUser(userId: string): Promise<BalanceUpdateResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      isActive: true,
      messagingStatus: true,
      billingStatus: true,
    },
  });

  if (!user) return { status: 'skipped', reason: 'user_not_found' };
  if (!user.phone) return { status: 'skipped', reason: 'missing_phone' };
  if (!user.isActive || user.messagingStatus !== 'active') {
    return { status: 'skipped', reason: 'messaging_inactive' };
  }
  if (!user.billingStatus || !ACTIVE_BILLING_STATUSES.includes(user.billingStatus)) {
    return { status: 'skipped', reason: 'billing_inactive' };
  }

  const accountCount = await prisma.plaidAccount.count({
    where: { item: { userId: user.id }, isActive: true },
  });
  if (accountCount === 0) {
    return { status: 'skipped', reason: 'no_active_accounts' };
  }

  let breakdown;
  try {
    breakdown = await getBalancesBreakdown({ userId: user.id });
  } catch (error) {
    logError('balance-update.balances', error, { userId: user.id });
    return { status: 'failed', reason: 'balances_error' };
  }

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

  let body: string | null = null;
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
      userText: 'give the member a balance pulse',
      history: '',
      profile: {},
      quizAnswers: null,
      analysisSummary: null,
    });
  } catch (error) {
    logError('balance-update.llm', error, { userId: user.id });
  }

  if (!body || body.includes('having trouble')) {
    body = buildFallbackMessage(breakdown);
  }

  try {
    const segments = splitIntoSmsSegments(body);
    for (let i = 0; i < segments.length; i++) {
      await sendMessage({
        to: user.phone,
        body: segments[i],
        userId: user.id,
        shouldPersist: true,
      });
      if (i < segments.length - 1) await new Promise((r) => setTimeout(r, 150));
    }
  } catch (error) {
    logError('balance-update.send', error, { userId: user.id });
    return { status: 'failed', reason: 'send_error' };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastBalanceUpdateAt: new Date() },
    });
  } catch (error) {
    logError('balance-update.persist', error, { userId: user.id });
    return { status: 'failed', reason: 'persist_error' };
  }

  // Check for low balance and alert if needed
  try {
    await checkAndAlertLowBalance(user.id);
  } catch (error) {
    logError('balance-update.low-balance-check', error, { userId: user.id });
    // Don't fail the whole job if low balance check fails
  }

  return { status: 'sent' };
}

/**
 * Ask the user if they want their balance (conversational flow).
 * Sets pending state and sends the question. User's reply triggers runBalanceUpdateForUser.
 */
export async function askBalanceQuestion(userId: string): Promise<AskBalanceResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      isActive: true,
      messagingStatus: true,
      billingStatus: true,
      pendingJobType: true,
    },
  });

  if (!user) return { status: 'skipped', reason: 'user_not_found' };
  if (!user.phone) return { status: 'skipped', reason: 'missing_phone' };
  if (!user.isActive || user.messagingStatus !== 'active') {
    return { status: 'skipped', reason: 'messaging_inactive' };
  }
  if (!user.billingStatus || !ACTIVE_BILLING_STATUSES.includes(user.billingStatus)) {
    return { status: 'skipped', reason: 'billing_inactive' };
  }
  if (user.pendingJobType) {
    return { status: 'skipped', reason: 'already_pending' };
  }

  const accountCount = await prisma.plaidAccount.count({
    where: { item: { userId: user.id }, isActive: true },
  });
  if (accountCount === 0) {
    return { status: 'skipped', reason: 'no_active_accounts' };
  }

  // Set pending state atomically - only update if pendingJobType is still null
  // This prevents race conditions when multiple cron workers hit the same user
  let updateResult;
  try {
    updateResult = await prisma.user.updateMany({
      where: {
        id: user.id,
        pendingJobType: null, // Only claim if not already pending
      },
      data: {
        pendingJobType: 'balance',
        pendingJobAskedAt: new Date(),
      },
    });
  } catch (error) {
    logError('balance-ask.pending', error, { userId: user.id });
    return { status: 'skipped', reason: 'pending_error' };
  }

  // If no rows updated, another worker got there first
  if (updateResult.count === 0) {
    return { status: 'skipped', reason: 'already_pending' };
  }

  // Send the question
  try {
    await sendMessage({
      to: user.phone,
      body: getPendingJobQuestion('balance'),
      userId: user.id,
      shouldPersist: true,
    });
  } catch (error) {
    logError('balance-ask.send', error, { userId: user.id });
    // Clear pending state since we failed to send
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingJobType: null, pendingJobAskedAt: null },
    }).catch(() => {});
    return { status: 'skipped', reason: 'send_error' };
  }

  return { status: 'asked' };
}
