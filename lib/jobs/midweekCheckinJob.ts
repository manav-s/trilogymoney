import { prisma } from '@/lib/db/db';
import { logError } from '@/lib/utils/logger';
import { generateMidweekMessage } from '@/lib/ai/llm';
import { getTransactions, buildTransactionsSummary, isExcludedFromSummary } from '@/lib/services/transactions';
import { buildMidweekContext } from '@/lib/midweekCheckin';
import { sendMessage } from '@/lib/integrations/blooio';

const MAX_TRANSACTIONS = 500;

export type MidweekResult =
  | { status: 'sent'; message: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export type RunMidweekOptions = {
  dryRun?: boolean;
  dateOverride?: Date;
};

/**
 * Get the Monday of the current week
 */
export function getCurrentWeekMonday(date = new Date()): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  const day = copy.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // Days since Monday
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

/**
 * Get range from Monday to today (inclusive)
 */
export function getCurrentWeekRange(date = new Date()): { from: string; to: string } {
  const monday = getCurrentWeekMonday(date);
  const today = new Date(date);
  today.setUTCHours(0, 0, 0, 0);
  return { from: toIsoDay(monday), to: toIsoDay(today) };
}

/**
 * Get last week's Mon-Wed range for comparison
 */
export function getLastWeekByWednesdayRange(date = new Date()): { from: string; to: string } {
  const monday = getCurrentWeekMonday(date);
  const lastMonday = new Date(monday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastWednesday = new Date(lastMonday);
  lastWednesday.setUTCDate(lastWednesday.getUTCDate() + 2);
  return { from: toIsoDay(lastMonday), to: toIsoDay(lastWednesday) };
}

/**
 * Get last 4 weeks range for category averages
 */
export function getLast4WeeksRange(date = new Date()): { from: string; to: string } {
  const monday = getCurrentWeekMonday(date);
  const start = new Date(monday);
  start.setUTCDate(start.getUTCDate() - 28);
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: toIsoDay(start), to: toIsoDay(end) };
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runMidweekCheckinForUser(
  userId: string,
  options: RunMidweekOptions = {}
): Promise<MidweekResult> {
  const now = options.dateOverride ?? new Date();
  const dryRun = options.dryRun ?? false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      timezone: true,
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
  if (!user.phone) {
    return { status: 'skipped', reason: 'missing_phone' };
  }

  const hasActiveAccount = await prisma.plaidAccount.count({
    where: { isActive: true, item: { userId: user.id } },
  });
  if (hasActiveAccount === 0) {
    return { status: 'skipped', reason: 'no_active_account' };
  }

  // Get current week transactions (Mon - today)
  const currentWeekRange = getCurrentWeekRange(now);
  let currentWeekResult;
  try {
    currentWeekResult = await getTransactions({
      userId: user.id,
      from: currentWeekRange.from,
      to: currentWeekRange.to,
      limit: MAX_TRANSACTIONS,
      maxRows: MAX_TRANSACTIONS,
    });
  } catch (error) {
    logError('midweek.transactions.current', error, { userId: user.id, range: currentWeekRange });
    return { status: 'failed', reason: 'transactions_error' };
  }

  const currentWeekTransactions = currentWeekResult.transactions.filter((t) => !isExcludedFromSummary(t));
  const currentWeekSummary = buildTransactionsSummary(currentWeekTransactions, currentWeekRange);

  // Get last week's Mon-Wed for pace comparison
  const lastWeekWedRange = getLastWeekByWednesdayRange(now);
  let lastWeekByWednesdaySummary = null;
  try {
    const lastWeekResult = await getTransactions({
      userId: user.id,
      from: lastWeekWedRange.from,
      to: lastWeekWedRange.to,
      limit: MAX_TRANSACTIONS,
      maxRows: MAX_TRANSACTIONS,
    });
    const lastWeekTransactions = lastWeekResult.transactions.filter((t) => !isExcludedFromSummary(t));
    lastWeekByWednesdaySummary = buildTransactionsSummary(lastWeekTransactions, lastWeekWedRange);
  } catch (error) {
    // Non-fatal, just won't have comparison data
    console.warn('midweek.transactions.lastweek', { userId: user.id, error });
  }

  // Get last 4 weeks for category averages
  const last4WeeksRange = getLast4WeeksRange(now);
  let last4WeeksSummary = null;
  try {
    const last4WeeksResult = await getTransactions({
      userId: user.id,
      from: last4WeeksRange.from,
      to: last4WeeksRange.to,
      limit: MAX_TRANSACTIONS,
      maxRows: MAX_TRANSACTIONS,
    });
    const last4WeeksTransactions = last4WeeksResult.transactions.filter((t) => !isExcludedFromSummary(t));
    last4WeeksSummary = buildTransactionsSummary(last4WeeksTransactions, last4WeeksRange);
  } catch (error) {
    // Non-fatal
    console.warn('midweek.transactions.4weeks', { userId: user.id, error });
  }

  const context = buildMidweekContext({
    currentWeekSummary,
    currentWeekTransactions,
    lastWeekByWednesdaySummary,
    last4WeeksSummary,
    timezone: user.timezone,
  });

  console.info('midweek.context', {
    userId: user.id,
    variant: context.variant,
    currentWeekSpend: context.currentWeekSpend,
    lastWeekByWednesday: context.lastWeekByWednesday,
    pendingTotal: context.pendingTotal,
    topCategory: context.topCategory,
    biggestTransaction: context.biggestTransaction,
  });

  const message = await generateMidweekMessage(context);
  if (!message) {
    logError('midweek.llm', undefined, { userId: user.id, variant: context.variant });
    return { status: 'failed', reason: 'llm_error' };
  }

  console.info('midweek.message', {
    userId: user.id,
    variant: context.variant,
    message,
    length: message.length,
  });

  if (dryRun) {
    console.info('midweek.dry_run', { userId: user.id, message });
    return { status: 'sent', message };
  }

  // Send the message
  try {
    await sendMessage({
      to: user.phone,
      body: message,
      shouldPersist: true,
      userId: user.id,
    });
    console.info('midweek.sent', { userId: user.id, variant: context.variant });
    return { status: 'sent', message };
  } catch (error) {
    logError('midweek.send', error, { userId: user.id });
    return { status: 'failed', reason: 'send_error' };
  }
}
