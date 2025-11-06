import { getPlaidClient } from './plaid';
import { prisma } from './db';
import { decryptMessage } from './encryption';
import { logError } from './logger';

export type BalanceAccount = {
  id: string; // internal PlaidAccount.id
  accountId: string; // Plaid account_id
  name: string;
  mask?: string | null;
  subtype?: string | null;
  institution?: string | null;
  currency?: string | null;
  current?: number | null;
  available?: number | null;
  updatedAt?: string | null;
};

export type GetBalancesResult = {
  accounts: BalanceAccount[];
  total: number; // sum of available if present else current
  count: number; // number of accounts included
};

/**
 * Fetch fresh balances from Plaid for all of a user's items, update cache, and return normalized balances.
 * Notes:
 * - Uses Plaid accountsBalanceGet for freshness
 * - Continues on partial errors (per-item), logging with redaction
 * - Sums available if present else current for the total
 */
export async function getBalances(params: { userId: string }): Promise<GetBalancesResult> {
  const { userId } = params;
  const items = await prisma.plaidItem.findMany({
    where: { userId },
    select: { id: true, accessToken: true, institutionName: true },
  });

  if (!items.length) return { accounts: [], total: 0, count: 0 };

  const client = getPlaidClient();

  const allAccounts: BalanceAccount[] = [];

  await Promise.all(
    items.map(async (item) => {
      let accessToken: string | null = null;
      try {
        accessToken = decryptMessage(item.accessToken);
      } catch (e) {
        logError('balances.decrypt_token', e, { itemId: item.id });
        return;
      }
      try {
        const resp = await client.accountsBalanceGet({ access_token: accessToken! });
        const accounts = resp.data.accounts || [];

        for (const a of accounts) {
          try {
            const updated = await prisma.plaidAccount.upsert({
              where: { accountId: a.account_id },
              update: {
                name: a.name || a.official_name || 'Account',
                officialName: a.official_name || null,
                mask: a.mask || null,
                type: a.type || 'unknown',
                subtype: a.subtype || null,
                currency: a.balances?.iso_currency_code || null,
                currentBalance: a.balances?.current ?? null,
                availableBalance: a.balances?.available ?? null,
                lastSync: new Date(),
              },
              create: {
                accountId: a.account_id,
                itemId: item.id,
                name: a.name || a.official_name || 'Account',
                officialName: a.official_name || null,
                mask: a.mask || null,
                type: a.type || 'unknown',
                subtype: a.subtype || null,
                currency: a.balances?.iso_currency_code || null,
                currentBalance: a.balances?.current ?? null,
                availableBalance: a.balances?.available ?? null,
              },
              select: { id: true, accountId: true, name: true, mask: true, subtype: true, currency: true, currentBalance: true, availableBalance: true, lastSync: true },
            });

            allAccounts.push({
              id: updated.id,
              accountId: updated.accountId,
              name: updated.name,
              mask: updated.mask,
              subtype: updated.subtype,
              institution: item.institutionName || null,
              currency: updated.currency,
              current: updated.currentBalance,
              available: updated.availableBalance,
              updatedAt: (updated as { lastSync?: Date | null })?.lastSync ? (updated as { lastSync?: Date | null }).lastSync!.toISOString() : null,
            });
          } catch (e) {
            logError('balances.update_account', e, { accountId: a.account_id, itemId: item.id });
          }
        }

        // Update item lastSync
        try {
          await prisma.plaidItem.update({ where: { id: item.id }, data: { lastSync: new Date() } });
        } catch (e) {
          logError('balances.update_item_sync', e, { itemId: item.id });
        }
      } catch (e) {
        logError('balances.plaid_error', e, { itemId: item.id });
      }
    })
  );

  // Only include active accounts
  let activeIds: Set<string> = new Set();
  try {
    const actives = await prisma.plaidAccount.findMany({ where: { itemId: { in: items.map(i => i.id) }, isActive: true }, select: { accountId: true } });
    activeIds = new Set(actives.map(a => a.accountId));
  } catch (e) {
    logError('balances.fetch_active_ids', e, { userId });
  }

  const filtered = allAccounts.filter(a => activeIds.size === 0 || activeIds.has(a.accountId));
  const total = filtered.reduce((sum, a) => {
    const val = typeof a.available === 'number' ? a.available : (typeof a.current === 'number' ? a.current : 0);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);

  return { accounts: filtered, total, count: filtered.length };
}


