import { prisma } from '@/lib/db/db';
import { sendMessage } from '@/lib/integrations/blooio';
import { getBalancesBreakdown } from '@/lib/services/balances';
import { logError, logger } from '@/lib/utils/logger';

const ALERT_COOLDOWN_HOURS = 24;

type LowBalanceResult =
  | { alerted: true; accountName: string; balance: number }
  | { alerted: false; reason: string };

export async function checkAndAlertLowBalance(userId: string): Promise<LowBalanceResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      lowBalanceThreshold: true,
      lastLowBalanceAlertAt: true,
    },
  });

  if (!user || !user.phone) {
    return { alerted: false, reason: 'no_user_or_phone' };
  }

  // Alerts disabled if threshold is null
  if (user.lowBalanceThreshold === null) {
    return { alerted: false, reason: 'alerts_disabled' };
  }

  // Check cooldown
  if (user.lastLowBalanceAlertAt) {
    const hoursSinceLastAlert =
      (Date.now() - user.lastLowBalanceAlertAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastAlert < ALERT_COOLDOWN_HOURS) {
      return { alerted: false, reason: 'cooldown_active' };
    }
  }

  let breakdown;
  try {
    breakdown = await getBalancesBreakdown({ userId });
  } catch (err) {
    logError('low-balance.balances', err, { userId });
    return { alerted: false, reason: 'balance_fetch_error' };
  }

  // Find lowest cash account below threshold
  const lowAccounts = breakdown.cash.accounts
    .filter((a) => a.available !== null && a.available < user.lowBalanceThreshold!)
    .sort((a, b) => (a.available ?? 0) - (b.available ?? 0));

  if (lowAccounts.length === 0) {
    return { alerted: false, reason: 'no_low_accounts' };
  }

  const lowestAccount = lowAccounts[0];
  const accountLabel = lowestAccount.institution
    ? `${lowestAccount.institution} ${lowestAccount.name}`
    : lowestAccount.name;
  const balance = Math.round(lowestAccount.available ?? 0);

  try {
    await sendLowBalanceAlert(user.phone, userId, accountLabel, balance);
  } catch (err) {
    logError('low-balance.send', err, { userId });
    return { alerted: false, reason: 'send_error' };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLowBalanceAlertAt: new Date() },
    });
  } catch (err) {
    logError('low-balance.update', err, { userId });
  }

  logger.info('low-balance.alerted', {
    userId,
    account: accountLabel,
    balance,
    threshold: user.lowBalanceThreshold,
  });

  return { alerted: true, accountName: accountLabel, balance };
}

async function sendLowBalanceAlert(
  phone: string,
  userId: string,
  accountName: string,
  balance: number
) {
  const msg = `heads up — your ${accountName} is at $${balance}. want me to show recent transactions?`;

  await sendMessage({
    to: phone,
    body: msg,
    userId,
    shouldPersist: true,
  });
}

export async function setLowBalanceThreshold(
  userId: string,
  threshold: number | null
): Promise<{ success: true; threshold: number | null } | { success: false; error: string }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lowBalanceThreshold: threshold },
    });

    logger.info('low-balance.threshold-updated', { userId, threshold });
    return { success: true, threshold };
  } catch (err) {
    logError('low-balance.set-threshold', err, { userId });
    return { success: false, error: 'update_failed' };
  }
}
