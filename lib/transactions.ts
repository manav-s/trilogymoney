import { getPlaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/db';
import { decryptMessage } from '@/lib/encryption';
import { logError } from '@/lib/logger';

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LIMIT = 20;
const PLAID_MAX_COUNT = 100;

export type TransactionAccountSummary = {
  id: string;
  name: string;
  institution: string | null;
  mask: string | null;
};

export type TransactionSummary = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  merchant: string | null;
  description: string | null;
  category: string | null;
  pending: boolean;
  account: TransactionAccountSummary;
};

export type GetTransactionsArgs = {
  userId: string;
  from?: string;
  to?: string;
  limit?: number;
  merchant?: string;
  category?: string;
};

export type GetTransactionsResult = {
  transactions: TransactionSummary[];
  moreAvailable: boolean;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function shouldRetryPlaidError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && (status === 429 || status >= 500)) return true;
  return false;
}

function normalizeCurrency(input?: string | null): string {
  return input ?? 'USD';
}

function matchesMerchant(summary: TransactionSummary, needle?: string): boolean {
  if (!needle) return true;
  const lower = needle.trim().toLowerCase();
  if (!lower) return true;
  return (
    summary.merchant?.toLowerCase().includes(lower) ||
    summary.description?.toLowerCase().includes(lower) ||
    false
  );
}

function matchesCategory(summary: TransactionSummary, needle?: string): boolean {
  if (!needle) return true;
  const lower = needle.trim().toLowerCase();
  if (!lower) return true;
  return summary.category?.toLowerCase().includes(lower) ?? false;
}

export async function getTransactions(args: GetTransactionsArgs): Promise<GetTransactionsResult> {
  const {
    userId,
    from,
    to,
    limit: rawLimit,
    merchant,
    category,
  } = args;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, billingStatus: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!(user.billingStatus === 'active' || user.billingStatus === 'trialing')) {
    throw new Error('Transactions are only available for paid users');
  }

  const startDate = from ?? isoDate(daysAgo(DEFAULT_LOOKBACK_DAYS));
  const endDate = to ?? isoDate(new Date());

  if (new Date(startDate) > new Date(endDate)) {
    return { transactions: [], moreAvailable: false };
  }

  const limit = Math.max(1, Math.min(rawLimit ?? 3, MAX_LIMIT));
  const fetchCount = Math.min(limit * 5, PLAID_MAX_COUNT);

  const items = await prisma.plaidItem.findMany({
    where: { userId },
    select: { id: true, accessToken: true, institutionName: true },
  });

  if (!items.length) {
    return { transactions: [], moreAvailable: false };
  }

  const activeAccountsRows = await prisma.plaidAccount.findMany({
    where: { itemId: { in: items.map((i) => i.id) }, isActive: true },
    select: { accountId: true },
  });
  const activeAccountIds = new Set(activeAccountsRows.map((row) => row.accountId));
  const filterInactive = activeAccountIds.size > 0;

  const client = getPlaidClient();

  const allSummaries: TransactionSummary[] = [];
  let moreAvailable = false;

  for (const item of items) {
    let accessToken: string;
    try {
      accessToken = decryptMessage(item.accessToken);
    } catch (error) {
      logError('transactions.decrypt_token', error, { itemId: item.id, userId });
      continue;
    }

    const options: Record<string, unknown> = {
      count: fetchCount,
      offset: 0,
      include_personal_finance_category: true,
    };

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const resp = await client.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options,
        });

        const accounts = resp.data.accounts ?? [];
        const accountMap = new Map(
          accounts.map((account) => [
            account.account_id,
            {
              id: account.account_id,
              name: account.name || account.official_name || 'Account',
              mask: account.mask || null,
            },
          ])
        );

        const transactions = resp.data.transactions ?? [];
        const totalTransactions = resp.data.total_transactions ?? transactions.length;
        if (totalTransactions > transactions.length) {
          moreAvailable = true;
        }

        for (const txn of transactions) {
          if (filterInactive && !activeAccountIds.has(txn.account_id)) continue;

          const account = accountMap.get(txn.account_id) ?? {
            id: txn.account_id,
            name: 'Account',
            mask: null,
          };

          const summary: TransactionSummary = {
            id: txn.transaction_id,
            date: txn.date,
            amount: txn.amount,
            currency: normalizeCurrency(txn.iso_currency_code ?? txn.unofficial_currency_code),
            merchant: txn.merchant_name ?? null,
            description: txn.name ?? null,
            category:
              txn.personal_finance_category?.primary ??
              txn.personal_finance_category?.detailed ??
              txn.category?.[0] ??
              null,
            pending: Boolean(txn.pending),
            account: {
              id: account.id,
              name: account.name,
              institution: item.institutionName ?? null,
              mask: account.mask,
            },
          };

          allSummaries.push(summary);
        }

        break;
      } catch (error) {
        attempt += 1;
        logError('transactions.plaid_error', error, { attempt, itemId: item.id, userId });
        if (attempt >= 3 || !shouldRetryPlaidError(error)) {
          break;
        }
        const backoffMs = 200 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  let filtered = allSummaries;

  if (merchant) {
    filtered = filtered.filter((summary) => matchesMerchant(summary, merchant));
  }

  if (category) {
    filtered = filtered.filter((summary) => matchesCategory(summary, category));
  }

  filtered.sort((a, b) => {
    if (a.date === b.date) return b.id.localeCompare(a.id);
    return b.date.localeCompare(a.date);
  });

  if (filtered.length > limit) {
    moreAvailable = true;
  }

  const transactions = filtered.slice(0, limit);

  return { transactions, moreAvailable };
}


