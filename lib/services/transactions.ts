import { getPlaidClient } from '@/lib/integrations/plaid';
import { prisma } from '@/lib/db/db';
import { decryptMessage } from '@/lib/db/encryption';
import { logError } from '@/lib/utils/logger';

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LIMIT = 20;
const PLAID_MAX_COUNT = 100;
const DEFAULT_MAX_ROWS = 120;

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
  maxRows?: number;
};

export type TransactionsSummaryBucket = {
  label: string;
  amount: number;
  spendAmount: number;
  refundAmount: number;
  pendingAmount: number;
  pendingSpendAmount: number;
  pendingRefundAmount: number;
  count: number;
  pendingCount: number;
};

export type TransactionsSummary = {
  from: string;
  to: string;
  totalAmount: number;
  totalSpend: number;
  totalRefund: number;
  pendingAmount: number;
  pendingSpend: number;
  pendingRefund: number;
  totalIncome: number;
  pendingIncome: number;
  incomeCount: number;
  count: number;
  pendingCount: number;
  perMerchant: TransactionsSummaryBucket[];
  perCategory: TransactionsSummaryBucket[];
  incomeBuckets: TransactionsSummaryBucket[];
};

export type GetTransactionsResult = {
  transactions: TransactionSummary[];
  moreAvailable: boolean;
  summary: TransactionsSummary;
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

function maskString(value: string, maxLength = 200): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

function matchesMerchant(summary: TransactionSummary, needle?: string | null): boolean {
  if (!needle) return true;
  const lower = needle.trim().toLowerCase();
  if (!lower) return true;
  return Boolean(
    summary.merchant?.toLowerCase().includes(lower) ||
      summary.description?.toLowerCase().includes(lower)
  );
}

function matchesCategory(summary: TransactionSummary, needle?: string | null): boolean {
  if (!needle) return true;
  const normalizedNeedle = normalizeCategoryKey(needle);
  if (!normalizedNeedle) return true;
  const summaryKey = normalizeCategoryKey(summary.category);
  if (!summaryKey) return false;
  return summaryKey.includes(normalizedNeedle);
}

function normalizeCategoryKey(category?: string | null): string | null {
  if (!category) return null;
  const normalized = category
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized || null;
}

const EXCLUDED_SUMMARY_CATEGORY_VALUES = new Set([
  'transfer in',
  'transfer out',
  'loan payments',
  'bank fees',
  'service charges',
  'interest',
  'cash advance',
  'cash withdrawal',
  'credit card payment',
  'credit card bill payment',
  'payment',
  'mortgage',
  'deposit',
]);

const EXCLUDED_SUMMARY_CATEGORY_PREFIXES = [
  'transfer',
  'loan payments',
  'cash advance',
  'cash withdrawal',
  'credit card payment',
  'credit card bill payment',
];

const INCOME_CATEGORIES = new Set([
  'income',
  'payroll',
  'deposit',
  'investment and retirement income',
]);

export function isExcludedFromSummary(txn: TransactionSummary): boolean {
  const categoryKey = normalizeCategoryKey(txn.category);
  if (!categoryKey) return false;
  if (EXCLUDED_SUMMARY_CATEGORY_VALUES.has(categoryKey)) return true;
  return EXCLUDED_SUMMARY_CATEGORY_PREFIXES.some((prefix) =>
    categoryKey.startsWith(prefix)
  );
}

export function isIncome(txn: TransactionSummary): boolean {
  const categoryKey = normalizeCategoryKey(txn.category);
  if (!categoryKey) return false;
  return INCOME_CATEGORIES.has(categoryKey);
}

function accumulateBucket(
  map: Map<string, TransactionsSummaryBucket>,
  key: string,
  label: string,
  txn: TransactionSummary
) {
  if (!map.has(key)) {
    map.set(key, {
      label,
      amount: 0,
      spendAmount: 0,
      refundAmount: 0,
      pendingAmount: 0,
      pendingSpendAmount: 0,
      pendingRefundAmount: 0,
      count: 0,
      pendingCount: 0,
    });
  }
  const bucket = map.get(key)!;
  const amt = txn.amount;
  bucket.amount += amt;
  if (amt >= 0) {
    bucket.spendAmount += amt;
  } else {
    bucket.refundAmount += Math.abs(amt);
  }
  if (txn.pending) {
    bucket.pendingAmount += amt;
    if (amt >= 0) {
      bucket.pendingSpendAmount += amt;
    } else {
      bucket.pendingRefundAmount += Math.abs(amt);
    }
    bucket.pendingCount += 1;
  }
  bucket.count += 1;
}

function finalizeBuckets(map: Map<string, TransactionsSummaryBucket>): TransactionsSummaryBucket[] {
  const buckets = Array.from(map.values());
  buckets.sort((a, b) => {
    const spendDelta = b.spendAmount - a.spendAmount;
    if (spendDelta !== 0) return spendDelta;
    const refundDelta = b.refundAmount - a.refundAmount;
    if (refundDelta !== 0) return refundDelta;
    const countDelta = b.count - a.count;
    if (countDelta !== 0) return countDelta;
    return a.label.localeCompare(b.label);
  });
  const MAX_BUCKETS = 10;
  if (buckets.length <= MAX_BUCKETS) {
    return buckets;
  }
  const top = buckets.slice(0, MAX_BUCKETS);
  const rest = buckets.slice(MAX_BUCKETS);
  const other = rest.reduce<TransactionsSummaryBucket>(
    (acc, bucket) => {
      acc.amount += bucket.amount;
      acc.spendAmount += bucket.spendAmount;
      acc.refundAmount += bucket.refundAmount;
      acc.pendingAmount += bucket.pendingAmount;
      acc.pendingSpendAmount += bucket.pendingSpendAmount;
      acc.pendingRefundAmount += bucket.pendingRefundAmount;
      acc.count += bucket.count;
      acc.pendingCount += bucket.pendingCount;
      return acc;
    },
    {
      label: 'other',
      amount: 0,
      spendAmount: 0,
      refundAmount: 0,
      pendingAmount: 0,
      pendingSpendAmount: 0,
      pendingRefundAmount: 0,
      count: 0,
      pendingCount: 0,
    }
  );
  if (other.count > 0) {
    top.push(other);
  }
  return top;
}

export function buildTransactionsSummary(
  transactions: TransactionSummary[],
  params: { from: string; to: string }
): TransactionsSummary {
  let totalAmount = 0;
  let totalSpend = 0;
  let totalRefund = 0;
  let pendingAmount = 0;
  let pendingSpend = 0;
  let pendingRefund = 0;
  let totalIncome = 0;
  let pendingIncome = 0;
  let incomeCount = 0;
  let count = 0;
  let pendingCount = 0;
  const merchantMap = new Map<string, TransactionsSummaryBucket>();
  const categoryMap = new Map<string, TransactionsSummaryBucket>();
  const incomeMap = new Map<string, TransactionsSummaryBucket>();

  for (const txn of transactions) {
    if (isIncome(txn)) {
      const incomeAmount = Math.abs(txn.amount);
      totalIncome += incomeAmount;
      incomeCount += 1;
      if (txn.pending) {
        pendingIncome += incomeAmount;
      }

      const merchantKey =
        txn.merchant?.trim().toLowerCase() ||
        txn.description?.trim().toLowerCase() ||
        'unknown';
      const merchantLabel = txn.merchant?.trim() || txn.description?.trim() || 'unknown merchant';
      const normalizedTxn: TransactionSummary = { ...txn, amount: incomeAmount };
      accumulateBucket(incomeMap, merchantKey, merchantLabel, normalizedTxn);
      continue;
    }

    if (isExcludedFromSummary(txn)) {
      continue;
    }

    totalAmount += txn.amount;
    if (txn.amount >= 0) {
      totalSpend += txn.amount;
      if (txn.pending) pendingSpend += txn.amount;
    } else {
      const abs = Math.abs(txn.amount);
      totalRefund += abs;
      if (txn.pending) pendingRefund += abs;
    }
    if (txn.pending) {
      pendingAmount += txn.amount;
      pendingCount += 1;
    }
    count += 1;

    const merchantKey =
      txn.merchant?.trim().toLowerCase() ||
      txn.description?.trim().toLowerCase() ||
      'unknown';
    const merchantLabel = txn.merchant?.trim() || txn.description?.trim() || 'unknown merchant';
    accumulateBucket(merchantMap, merchantKey, merchantLabel, txn);

    const categoryKey = txn.category?.trim().toLowerCase() || 'uncategorized';
    const categoryLabel = txn.category?.trim() || 'uncategorized';
    accumulateBucket(categoryMap, categoryKey, categoryLabel, txn);
  }

  return {
    from: params.from,
    to: params.to,
    totalAmount,
    totalSpend,
    totalRefund,
    pendingAmount,
    pendingSpend,
    pendingRefund,
    totalIncome,
    pendingIncome,
    incomeCount,
    count,
    pendingCount,
    perMerchant: finalizeBuckets(merchantMap),
    perCategory: finalizeBuckets(categoryMap),
    incomeBuckets: finalizeBuckets(incomeMap),
  };
}

export async function getTransactions(args: GetTransactionsArgs): Promise<GetTransactionsResult> {
  const {
    userId,
    from,
    to,
    limit: rawLimit,
    merchant,
    category,
    maxRows: rawMaxRows,
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
    const summary = buildTransactionsSummary([], { from: startDate, to: endDate });
    return { transactions: [], moreAvailable: false, summary };
  }

  const limit = rawLimit ? Math.max(1, Math.min(rawLimit, 500)) : undefined;
  const maxRows = Math.max(1, Math.min(rawMaxRows ?? DEFAULT_MAX_ROWS, 500));
  const targetRows = limit ?? maxRows;
  const fetchCount = Math.min(Math.max(targetRows, MAX_LIMIT), PLAID_MAX_COUNT);

  const items = await prisma.plaidItem.findMany({
    where: {
      userId,
      accounts: {
        some: { isActive: true },
      },
    },
    select: { id: true, accessToken: true, institutionName: true },
  });

  if (!items.length) {
    const summary = buildTransactionsSummary([], { from: startDate, to: endDate });
    return { transactions: [], moreAvailable: false, summary };
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

    let offset = 0;
    let attempt = 0;

    while (true) {
      try {
        const options: Record<string, unknown> = {
          count: fetchCount,
          offset,
          include_personal_finance_category: true,
        };

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
          if (allSummaries.length >= targetRows) break;
        }

        if (allSummaries.length >= targetRows) {
          moreAvailable = allSummaries.length < totalTransactions;
          break;
        }

        if (transactions.length === 0) break;

        offset += transactions.length;
        if (offset >= totalTransactions) break;
        continue;
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

  const transactions = filtered.slice(0, targetRows);
  const summary = buildTransactionsSummary(transactions, { from: startDate, to: endDate });
  const result: GetTransactionsResult = {
    transactions,
    moreAvailable: moreAvailable || filtered.length > transactions.length,
    summary,
  };

  if (process.env.PLAID_LOG_TRANSACTIONS === '1') {
    const snapshot = {
      userId,
      range: { from: startDate, to: endDate },
      filters: {
        merchant: merchant ?? null,
        category: category ?? null,
        limit: limit ?? null,
        maxRows,
      },
      moreAvailable,
      summary,
      transactions: transactions.slice(0, 50).map((txn) => ({
        id: txn.id,
        date: txn.date,
        amount: txn.amount,
        currency: txn.currency,
        merchant: txn.merchant ? maskString(txn.merchant) : null,
        description: txn.description ? maskString(txn.description) : null,
        category: txn.category,
        pending: txn.pending,
        account: {
          id: txn.account.id,
          name: maskString(txn.account.name),
          institution: txn.account.institution ? maskString(txn.account.institution) : null,
          mask: txn.account.mask,
        },
      })),
    };
    try {
      console.info('transactions.debug_result', JSON.stringify(snapshot));
    } catch {
      // ignore logging errors
    }
  }

  return result;
}
