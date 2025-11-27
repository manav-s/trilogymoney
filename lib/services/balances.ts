import { getPlaidClient } from '../integrations/plaid';
import { prisma } from '../db/db';
import { decryptMessage } from '../db/encryption';
import { logError } from '../utils/logger';

export type BalanceAccount = {
  id: string; // internal PlaidAccount.id
  accountId: string; // Plaid account_id
  name: string;
  type?: string | null;
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

export type BalancesBreakdown = {
  cash: { accounts: BalanceAccount[]; total: number; count: number };
  credit: { accounts: BalanceAccount[]; owedTotal: number; count: number };
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
              type: a.type || 'unknown',
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

  const active = allAccounts.filter(a => activeIds.size === 0 || activeIds.has(a.accountId));
  const eligible = active.filter(a => (a.type === 'depository') && (!a.currency || a.currency === 'USD'));
  const total = eligible.reduce((sum, a) => {
    const raw = typeof a.available === 'number' ? a.available : (typeof a.current === 'number' ? a.current : 0);
    const val = Number.isFinite(raw) ? raw : 0;
    // Treat negatives as zero for cash summaries
    return sum + (val > 0 ? val : 0);
  }, 0);

  return { accounts: eligible, total, count: eligible.length };
}

/**
 * Return cash (depository, USD, non-negative) and credit (owed amount) breakdowns.
 */
export async function getBalancesBreakdown(params: { userId: string }): Promise<BalancesBreakdown> {
  const base = await getBalances(params); // cash portion per our filtering

  const { userId } = params;
  // Build credit side by querying latest cached accounts for the user items
  const items = await prisma.plaidItem.findMany({ where: { userId }, select: { id: true, institutionName: true } });
  const creditAccountsRows = await prisma.plaidAccount.findMany({
    where: { itemId: { in: items.map(i => i.id) }, isActive: true, type: 'credit' },
    select: { id: true, itemId: true, accountId: true, name: true, mask: true, subtype: true, currency: true, currentBalance: true, availableBalance: true },
  });
  const itemIdToInst = new Map(items.map(i => [i.id, i.institutionName || null] as const));

  const creditAccounts: BalanceAccount[] = creditAccountsRows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    type: 'credit',
    mask: row.mask,
    subtype: row.subtype,
    institution: itemIdToInst.get((row as { itemId: string }).itemId) || null,
    currency: row.currency,
    current: row.currentBalance,
    available: row.availableBalance,
    updatedAt: null,
  }));

  const owedTotal = creditAccounts.reduce((sum, a) => {
    const raw = typeof a.current === 'number' ? a.current : 0;
    const amt = Math.abs(Number.isFinite(raw) ? raw : 0);
    return sum + amt;
  }, 0);

  return {
    cash: { accounts: base.accounts, total: base.total, count: base.count },
    credit: { accounts: creditAccounts, owedTotal, count: creditAccounts.length },
  };
}


