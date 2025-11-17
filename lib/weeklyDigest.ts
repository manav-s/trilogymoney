import type { BalancesBreakdown } from './balances';
import type { WeeklyDigestContext } from './llm';
import type { TransactionSummary, TransactionsSummary } from './transactions';

export const WEEKLY_DIGEST_HIGHLIGHT_KEYWORDS: Array<{ key: string; label: string }> = [
  { key: 'amazon', label: 'amazon' },
  { key: 'starbucks', label: 'starbucks' },
  { key: 'doordash', label: 'doordash' },
  { key: 'door dash', label: 'doordash' },
  { key: 'uber eats', label: 'uber_eats' },
  { key: 'uber', label: 'uber' },
  { key: 'lyft', label: 'lyft' },
  { key: 'walmart', label: 'walmart' },
  { key: 'target', label: 'target' },
];

export function extractHighlights(summary: TransactionsSummary): string[] {
  const found = new Set<string>();
  for (const bucket of summary.perMerchant) {
    const label = bucket.label?.toLowerCase?.() ?? '';
    if (!label) continue;
    for (const candidate of WEEKLY_DIGEST_HIGHLIGHT_KEYWORDS) {
      if (label.includes(candidate.key)) {
        found.add(candidate.label);
      }
    }
  }
  if (summary.totalRefund > 0) {
    found.add('refunds');
  }
  if (summary.pendingSpend > 0) {
    found.add('pending_spend');
  }
  if (summary.totalSpend === 0 && summary.count === 0) {
    found.add('no_spend');
  }
  return Array.from(found);
}

export function buildWeeklyDigestContext(input: {
  summary: TransactionsSummary;
  transactions: TransactionSummary[];
  balances: BalancesBreakdown;
  timezone: string;
  range: { from: string; to: string };
  highlights: string[];
}): WeeklyDigestContext {
  const { summary, transactions, balances, timezone, range, highlights } = input;
  const topCategories = summary.perCategory.slice(0, 5).map((bucket) => ({
    label: bucket.label,
    spendAmount: roundCurrency(bucket.spendAmount),
    refundAmount: roundCurrency(bucket.refundAmount),
    count: bucket.count,
  }));
  const topMerchants = summary.perMerchant.slice(0, 5).map((bucket) => ({
    label: bucket.label,
    spendAmount: roundCurrency(bucket.spendAmount),
    refundAmount: roundCurrency(bucket.refundAmount),
    count: bucket.count,
  }));
  const topTransactions = pickTopTransactions(transactions, 5);
  const cashAccounts = balances.cash.accounts.map((account) => ({
    name: account.name,
    institution: account.institution ?? null,
    available: typeof account.available === 'number' ? roundCurrency(account.available) : null,
    current: typeof account.current === 'number' ? roundCurrency(account.current) : null,
    mask: account.mask ?? null,
  }));
  const creditAccounts = balances.credit.accounts.map((account) => ({
    name: account.name,
    institution: account.institution ?? null,
    balance: typeof account.current === 'number' ? roundCurrency(Math.abs(account.current)) : null,
    mask: account.mask ?? null,
  }));

  return {
    week: range,
    timezone,
    spendSummary: {
      totalSpend: roundCurrency(summary.totalSpend),
      pendingSpend: roundCurrency(summary.pendingSpend),
      count: summary.count,
      pendingCount: summary.pendingCount,
      topCategories,
      topMerchants,
      topTransactions,
    },
    balances: {
      cashTotal: roundCurrency(balances.cash.total),
      cashCount: balances.cash.count,
      cashAccounts,
      creditOwedTotal: roundCurrency(balances.credit.owedTotal),
      creditCount: balances.credit.count,
      creditAccounts,
    },
    highlights,
  };
}

export function pickTopTransactions(
  transactions: TransactionSummary[],
  limit: number
): Array<{ merchant: string; amount: number; date: string; category: string | null; pending: boolean }> {
  const spendTxns = transactions
    .filter((txn) => txn.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
  return spendTxns.map((txn) => ({
    merchant: txn.merchant || txn.description || 'unknown',
    amount: roundCurrency(txn.amount),
    date: txn.date,
    category: txn.category,
    pending: txn.pending,
  }));
}

export function roundCurrency(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
}

