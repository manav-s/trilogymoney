import { getBalancesBreakdown } from '@/lib/balances';
import { sendMessage } from '@/lib/blooio';
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { generateWeeklyDigestMessage } from '@/lib/llm';
import { buildStoredTransactionsQuery, formatRangeLabel } from '@/lib/transactionsContext';
import { getTransactions, buildTransactionsSummary, isExcludedFromSummary } from '@/lib/transactions';
import { buildWeeklyDigestContext, extractHighlights } from '@/lib/weeklyDigest';

const MAX_TRANSACTIONS_FOR_WELCOME_DIGEST = 500;
const WELCOME_DUPLICATE_WINDOW_HOURS = 24;

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
  try {
    const hasActiveAccounts = await prisma.plaidAccount.count({
      where: { isActive: true, item: { userId: user.id } },
    });

    if (hasActiveAccounts === 0) {
      await sendMessage({
        to: user.phone,
        body: `i'll keep watching for new accounts. once you link something i'll send a weekly summary automatically. need the link again?`,
        userId: user.id,
        shouldPersist: true,
      });
      return;
    }

    const digestRange = getWelcomeDigestRange();
    const transactionsResult = await getTransactions({
      userId: user.id,
      from: digestRange.from,
      to: digestRange.to,
      limit: MAX_TRANSACTIONS_FOR_WELCOME_DIGEST,
      maxRows: MAX_TRANSACTIONS_FOR_WELCOME_DIGEST,
    });
    const filteredTransactions = transactionsResult.transactions.filter((txn) => !isExcludedFromSummary(txn));

    if (filteredTransactions.length === 0) {
      await sendMessage({
        to: user.phone,
        body: `accounts connected! i'll send your first weekly digest once there's spending to summarize.`,
        userId: user.id,
        shouldPersist: true,
      });
      return;
    }

    const digestSummary = buildTransactionsSummary(filteredTransactions, digestRange);
    const balances = await getBalancesBreakdown({ userId: user.id });
    const highlights = extractHighlights(digestSummary);
    const digestContext = buildWeeklyDigestContext({
      summary: digestSummary,
      transactions: filteredTransactions,
      balances,
      timezone: user.timezone,
      range: digestRange,
      highlights,
    });

    const digestMessage = await generateWeeklyDigestMessage(digestContext);
    if (!digestMessage) {
      logError('post-onboarding.no_digest_message', undefined, { userId: user.id });
      // Fallback: send a simple summary instead of failing silently
      await sendMessage({
        to: user.phone,
        body: `accounts connected! i've got ${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? '' : 's'} from the last week. your first full weekly digest will arrive next sunday.`,
        userId: user.id,
        shouldPersist: true,
      });
      return;
    }

    const now = new Date();
    const digestQuery = {
      kind: 'recent' as const,
      from: digestRange.from,
      to: digestRange.to,
      limit: MAX_TRANSACTIONS_FOR_WELCOME_DIGEST,
    };
    const snapshotTransactions = filteredTransactions.slice(0, MAX_TRANSACTIONS_FOR_WELCOME_DIGEST);

    try {
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
    } catch (persistError) {
      logError('post-onboarding.persist_failed', persistError, { userId: user.id });
      return;
    }

    await sendMessage({
      to: user.phone,
      body: digestMessage,
      userId: user.id,
      shouldPersist: true,
    });
  } catch (error) {
    logError('post-onboarding.digest_error', error, { userId: user.id });
    // Fallback: send a simple message so user knows something happened
    try {
      await sendMessage({
        to: user.phone,
        body: `accounts connected! i'm processing your first digest—check back in a moment or wait for next sunday's weekly summary.`,
        userId: user.id,
        shouldPersist: true,
      });
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

