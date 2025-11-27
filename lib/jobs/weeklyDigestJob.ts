import { Prisma } from '@prisma/client';

import { getBalancesBreakdown } from '@/lib/services/balances';
import { sendMessage } from '@/lib/integrations/blooio';
import { prisma } from '@/lib/db/db';
import { logError } from '@/lib/utils/logger';
import { generateWeeklyDigestMessage } from '@/lib/ai/llm';
import { getTransactions, buildTransactionsSummary, isExcludedFromSummary, isIncome } from '@/lib/services/transactions';
import { buildWeeklyDigestContext, extractHighlights } from '@/lib/weeklyDigest';
import { TransactionQuery } from '@/lib/transactionQuery';
import { buildStoredTransactionsQuery, formatRangeLabel } from '@/lib/transactionsContext';

const MAX_TRANSACTIONS_FOR_DIGEST = 500;

export type DigestResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export type DigestTrigger = 'cron' | 'onboarding';

export type RunWeeklyDigestOptions = {
  trigger?: DigestTrigger;
  rangeOverride?: { from: string; to: string };
  weekStartOverride?: Date;
};

export function getWeekStart(date = new Date()): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  const day = copy.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // convert to Monday start
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

export function getPreviousWeekRange(weekStart: Date): { from: string; to: string } {
  const start = new Date(weekStart);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: toIsoDay(start), to: toIsoDay(end) };
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

function splitDigestIntoMessages(message: string): string[] {
  return message
    .split(/\n\s*\n+/) // break on blank lines between sections
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function runWeeklyDigestForUser(
  userId: string,
  options: RunWeeklyDigestOptions = {}
): Promise<DigestResult> {
  const trigger = options.trigger ?? 'cron';
  const weekStart = getWeekStart(options.weekStartOverride ?? new Date());

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      timezone: true,
      lastWeeklyDigestAt: true,
      lastTransactionsQuery: true,
      isActive: true,
      messagingStatus: true,
    },
  });
  if (!user) {
    return { status: 'skipped', reason: 'user_not_found' };
  }
  if (!user.isActive || user.messagingStatus !== 'active') {
    return { status: 'skipped', reason: 'inactive' };
  }

  const hasActiveAccount = await prisma.plaidAccount.count({
    where: { isActive: true, item: { userId: user.id } },
  });
  if (hasActiveAccount === 0) {
    return { status: 'skipped', reason: 'no_active_account' };
  }

  if (!user.phone) {
    return { status: 'skipped', reason: 'missing_phone' };
  }
  if (user.lastWeeklyDigestAt && user.lastWeeklyDigestAt >= weekStart) {
    return { status: 'skipped', reason: 'already_sent_this_week' };
  }

  const digestRange = options.rangeOverride ?? getPreviousWeekRange(weekStart);

  let transactionsResult;
  try {
    transactionsResult = await getTransactions({
      userId: user.id,
      from: digestRange.from,
      to: digestRange.to,
      limit: MAX_TRANSACTIONS_FOR_DIGEST,
      maxRows: MAX_TRANSACTIONS_FOR_DIGEST,
    });
  } catch (error) {
    const message = (error instanceof Error && error.message) || 'unknown_error';
    if (message.includes('paid users')) {
      console.info(`weekly-digest.${trigger}.skip`, { userId: user.id, reason: 'paid_only' });
      return { status: 'skipped', reason: 'paid_only' };
    }
    logError('weekly-digest.transactions', error, {
      userId: user.id,
      range: digestRange,
      trigger,
    });
    return { status: 'failed', reason: 'transactions_error' };
  }

  let balances;
  try {
    balances = await getBalancesBreakdown({ userId: user.id });
  } catch (error) {
    logError('weekly-digest.balances', error, {
      userId: user.id,
      range: digestRange,
      trigger,
    });
    return { status: 'failed', reason: 'balances_error' };
  }

  const filteredTransactions = transactionsResult.transactions.filter(
    (txn) => !isExcludedFromSummary(txn) || isIncome(txn)
  );
  const digestSummary = buildTransactionsSummary(filteredTransactions, digestRange);
  const highlights = extractHighlights(digestSummary);
  const digestContext = buildWeeklyDigestContext({
    summary: digestSummary,
    transactions: filteredTransactions,
    balances,
    timezone: user.timezone,
    range: digestRange,
    highlights,
  });
  const digestCategoryLabels = digestContext.spendSummary.topCategories
    .map((cat: { label: string | null | undefined }) => normalizeCategoryLabel(cat.label))
    .filter((label: string | null): label is string => Boolean(label));

  const message = await generateWeeklyDigestMessage(digestContext);
  if (!message) {
    logError('weekly-digest.llm', undefined, {
      userId: user.id,
      range: digestRange,
      trigger,
    });
    return { status: 'failed', reason: 'llm_error' };
  }

  const messageParts = splitDigestIntoMessages(message);
  if (messageParts.length === 0) {
    logError('weekly-digest.llm', undefined, {
      userId: user.id,
      range: digestRange,
      trigger,
      reason: 'empty_parts',
    });
    return { status: 'failed', reason: 'llm_error' };
  }

  if (process.env.WEEKLY_DIGEST_DRY_RUN === '1') {
    console.info(`weekly-digest.${trigger}.dry_run`, {
      userId: user.id,
      range: digestRange,
      messageParts,
      highlights,
    });
    return { status: 'skipped', reason: 'dry_run' };
  }

  const now = new Date();
  const digestQuery: TransactionQuery = {
    kind: 'recent',
    from: digestRange.from,
    to: digestRange.to,
    limit: MAX_TRANSACTIONS_FOR_DIGEST,
  };

  const previousState = {
    lastWeeklyDigestAt: user.lastWeeklyDigestAt ?? null,
    lastTransactionsQuery: user.lastTransactionsQuery ?? null,
  };

  try {
    const snapshotTransactions = filteredTransactions.slice(0, MAX_TRANSACTIONS_FOR_DIGEST);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastWeeklyDigestAt: now,
        lastTransactionsQuery: buildStoredTransactionsQuery(digestQuery, now, {
          source: 'weekly_digest',
          label: formatRangeLabel(digestRange, { prefix: 'weekly digest' }),
          tags: digestCategoryLabels,
          storedTransactions: snapshotTransactions,
        }),
      },
    });
  } catch (error) {
    logError('weekly-digest.persist', error, {
      userId: user.id,
      range: digestRange,
      trigger,
    });
    return { status: 'failed', reason: 'persist_error' };
  }

  try {
    for (let i = 0; i < messageParts.length; i++) {
      await sendMessage({
        to: user.phone,
        body: messageParts[i],
        userId: user.id,
        shouldPersist: true,
      });
      if (i < messageParts.length - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  } catch (error) {
    logError('weekly-digest.send', error, {
      userId: user.id,
      range: digestRange,
      trigger,
    });

    try {
      const restoredLastTransactionsQuery =
        previousState.lastTransactionsQuery === null
          ? Prisma.JsonNull
          : (previousState.lastTransactionsQuery as Prisma.InputJsonValue);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastWeeklyDigestAt: previousState.lastWeeklyDigestAt,
          lastTransactionsQuery: restoredLastTransactionsQuery,
        },
      });
    } catch (restoreError) {
      logError('weekly-digest.restore', restoreError, {
        userId: user.id,
        range: digestRange,
        trigger,
      });
    }

    return { status: 'failed', reason: 'send_error' };
  }

  console.info(`weekly-digest.${trigger}.sent`, {
    userId: user.id,
    range: digestRange,
    highlights,
    totals: {
      totalSpend: digestSummary.totalSpend,
      totalRefund: digestSummary.totalRefund,
      pendingSpend: digestSummary.pendingSpend,
    },
  });

  return { status: 'sent' };
}
