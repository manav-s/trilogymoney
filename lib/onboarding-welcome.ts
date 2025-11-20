import { getBalancesBreakdown } from '@/lib/balances';
import { sendMessage } from '@/lib/blooio';
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { generateWeeklyDigestMessage } from '@/lib/llm';
import { buildStoredTransactionsQuery, formatRangeLabel } from '@/lib/transactionsContext';
import { getTransactions, buildTransactionsSummary, isExcludedFromSummary } from '@/lib/transactions';
import { buildWeeklyDigestContext, extractHighlights } from '@/lib/weeklyDigest';

const MAX_TRANSACTIONS_FOR_WELCOME_DIGEST = 500;

type UserForDigest = {
  id: string;
  phone: string;
  timezone: string;
};

export async function postOnboardingWelcome(userId: string): Promise<void> {
  try {
    // Atomic check-and-set: only proceed if welcomeSentAt is null
    // This prevents race conditions when multiple triggers fire simultaneously
    const now = new Date();
    const updateResult = await prisma.user.updateMany({
      where: {
        id: userId,
        welcomeSentAt: null, // Only update if not already set
        messagingStatus: 'active',
        isActive: true,
        billingStatus: { in: ['active', 'trialing'] },
      },
      data: { welcomeSentAt: now },
    });

    // If no rows were updated, someone else already sent the welcome (or user not eligible)
    if (updateResult.count === 0) {
      return;
    }

    // Fetch user details now that we've won the race
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        timezone: true,
      },
    });

    if (!user || !user.phone) {
      return;
    }

    await sendWelcomeMessage(user.id, user.phone);
    await sendFirstDigestIfPossible({
      id: user.id,
      phone: user.phone,
      timezone: user.timezone,
    });
  } catch (error) {
    logError('post-onboarding.error', error, { userId });
  }
}

// Removed isUserEligibleForWelcome - eligibility now checked atomically in updateMany WHERE clause

async function sendWelcomeMessage(userId: string, phone: string): Promise<void> {
  const welcomeBody = `welcome to trilogy! you're live now.
• weekly digest drops every sunday afternoon
• reply anytime for a spending breakdown or to pause texts`;

  await sendMessage({
    to: phone,
    body: welcomeBody,
    userId,
    shouldPersist: true,
  });
}

async function sendFirstDigestIfPossible(user: UserForDigest): Promise<void> {
  if (!user.phone) return;
  let lastRange: { from: string; to: string } | null = null;
  let lastSummary: ReturnType<typeof buildTransactionsSummary> | null = null;
  let lastBalances: Awaited<ReturnType<typeof getBalancesBreakdown>> | null = null;
  try {
    console.info('post-onboarding.digest_start', { userId: user.id, phone: user.phone });

    const hasActiveAccounts = await prisma.plaidAccount.count({
      where: { isActive: true, item: { userId: user.id } },
    });

    console.info('post-onboarding.account_check', { userId: user.id, hasActiveAccounts });

    if (hasActiveAccounts === 0) {
      console.info('post-onboarding.no_accounts', { userId: user.id });
      await sendMessage({
        to: user.phone,
        body: `i'll keep watching for new accounts. once you link something i'll send a weekly summary automatically. need the link again?`,
        userId: user.id,
        shouldPersist: true,
      });
      return;
    }

    const digestRange = getWelcomeDigestRange();
    lastRange = digestRange;
    console.info('post-onboarding.fetching_transactions', { userId: user.id, range: digestRange });

    const transactionsResult = await getTransactions({
      userId: user.id,
      from: digestRange.from,
      to: digestRange.to,
      limit: MAX_TRANSACTIONS_FOR_WELCOME_DIGEST,
      maxRows: MAX_TRANSACTIONS_FOR_WELCOME_DIGEST,
    });
    const filteredTransactions = transactionsResult.transactions.filter((txn) => !isExcludedFromSummary(txn));

    console.info('post-onboarding.transactions_fetched', {
      userId: user.id,
      total: transactionsResult.transactions.length,
      filtered: filteredTransactions.length,
    });

    console.info('post-onboarding.building_summary', { userId: user.id });
    lastSummary = buildTransactionsSummary(filteredTransactions, digestRange);
    lastBalances = await getBalancesBreakdown({ userId: user.id });
    const highlights = extractHighlights(lastSummary);
    const digestContext = buildWeeklyDigestContext({
      summary: lastSummary,
      transactions: filteredTransactions,
      balances: lastBalances,
      timezone: user.timezone,
      range: digestRange,
      highlights,
    });

    let digestMessage: string | null = null;

    if (filteredTransactions.length > 0) {
      console.info('post-onboarding.generating_message', { userId: user.id, highlights });
      digestMessage = await generateWeeklyDigestMessage(digestContext);
      if (!digestMessage) {
        logError('post-onboarding.no_digest_message', undefined, {
          userId: user.id,
          transactionCount: filteredTransactions.length,
          summaryTotalSpend: lastSummary.totalSpend,
        });
      } else {
        console.info('post-onboarding.message_generated', {
          userId: user.id,
          messageLength: digestMessage.length,
        });
      }
    } else {
      console.info('post-onboarding.no_transactions', { userId: user.id });
    }

    if (!digestMessage && lastSummary && lastBalances) {
      digestMessage = buildPlaintextDigestMessage({
        range: digestRange,
        summary: lastSummary,
        balances: lastBalances,
      });
    }

    const now = new Date();
    const digestQuery = {
      kind: 'recent' as const,
      from: digestRange.from,
      to: digestRange.to,
      limit: MAX_TRANSACTIONS_FOR_WELCOME_DIGEST,
    };
    const snapshotTransactions = filteredTransactions.slice(0, MAX_TRANSACTIONS_FOR_WELCOME_DIGEST);

    let snapshotPersisted = false;
    try {
      console.info('post-onboarding.persisting_snapshot', { userId: user.id, snapshotCount: snapshotTransactions.length });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastWeeklyDigestAt: now,
          lastTransactionsQuery: buildStoredTransactionsQuery(digestQuery, now, {
            source: 'welcome_digest',
            label: formatRangeLabel(digestRange, { prefix: 'welcome digest' }),
            tags: digestContext.spendSummary.topCategories
              .map((cat) => normalizeCategoryLabel(cat.label))
              .filter((label): label is string => Boolean(label)),
            storedTransactions: snapshotTransactions,
          }),
        },
      });
      snapshotPersisted = true;
      console.info('post-onboarding.snapshot_persisted', { userId: user.id });
    } catch (persistError) {
      logError('post-onboarding.persist_failed', persistError, {
        userId: user.id,
        snapshotCount: snapshotTransactions.length,
      });
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastWeeklyDigestAt: now },
        });
        console.info('post-onboarding.persist_fallback_success', { userId: user.id });
      } catch (fallbackError) {
        logError('post-onboarding.persist_fallback_failed', fallbackError, { userId: user.id });
      }
    }

    const messageBody =
      digestMessage ||
      buildPlaintextDigestMessage({
        range: digestRange,
        summary: lastSummary!,
        balances: lastBalances!,
      });

    console.info('post-onboarding.sending_digest', { userId: user.id });
    await sendMessage({
      to: user.phone,
      body: messageBody,
      userId: user.id,
      shouldPersist: true,
    });
    console.info('post-onboarding.digest_sent', { userId: user.id, snapshotPersisted });
  } catch (error) {
    logError('post-onboarding.digest_error', error, {
      userId: user.id,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    try {
      if (lastSummary && lastBalances && lastRange) {
        const fallbackMessage = buildPlaintextDigestMessage({
          range: lastRange,
          summary: lastSummary,
          balances: lastBalances,
        });
        await sendMessage({
          to: user.phone,
          body: fallbackMessage,
          userId: user.id,
          shouldPersist: true,
        });
      } else {
        await sendMessage({
          to: user.phone,
          body: `accounts connected! i'm processing your first digest—check back in a moment or wait for next sunday's weekly summary.`,
          userId: user.id,
          shouldPersist: true,
        });
      }
    } catch (fallbackError) {
      logError('post-onboarding.fallback_send_failed', fallbackError, { userId: user.id });
    }
  }
}

function getWelcomeDigestRange(): { from: string; to: string } {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 7);
  return {
    from: toIsoDay(from),
    to: toIsoDay(to),
  };
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeCategoryLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const normalized = label
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

function buildPlaintextDigestMessage(args: {
  range: { from: string; to: string };
  summary: ReturnType<typeof buildTransactionsSummary>;
  balances: Awaited<ReturnType<typeof getBalancesBreakdown>>;
}): string {
  const { range, summary, balances } = args;
  const lines: string[] = [];
  lines.push(`weekly summary: ${range.from} → ${range.to}`);
  lines.push('');

  if (summary.count === 0) {
    lines.push(`no transactions posted yet. i'm watching and will nudge the moment something clears.`);
  } else {
    lines.push(
      `spent ${formatCurrency(summary.totalSpend)} across ${summary.count} purchase${summary.count === 1 ? '' : 's'}.`
    );
    const topCategories = summary.perCategory
      .filter((cat) => cat.spendAmount > 0)
      .slice(0, 3);
    if (topCategories.length) {
      lines.push('');
      lines.push('category breakdown:');
      for (const cat of topCategories) {
        const label = normalizeCategoryLabel(cat.label) || 'uncategorized';
        lines.push(`- ${label} ${formatCurrency(cat.spendAmount)}`);
      }
    }
    if (summary.pendingSpend > 0) {
      lines.push('');
      lines.push(`pending to watch: ${formatCurrency(summary.pendingSpend)} still clearing.`);
    }
  }

  lines.push('');
  lines.push('balances:');
  lines.push(`cash ${formatCurrency(balances.cash.total)}`);
  lines.push(`credit owes ${formatCurrency(balances.credit.owedTotal)}`);
  lines.push('');
  lines.push('reply anytime for a deeper cut.');

  return lines.join('\n');
}

function formatCurrency(amount: number): string {
  const numeric = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round(numeric);
  const formatted = Math.abs(rounded).toLocaleString('en-US');
  return `$${formatted}`;
}

