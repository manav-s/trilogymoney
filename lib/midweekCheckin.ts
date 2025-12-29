import type { TransactionSummary, TransactionsSummary } from './services/transactions';

export type MidweekVariant = 'pace' | 'spike' | 'quiet' | 'big_txn' | 'pending';

export type MidweekContext = {
  // Current week (Mon-Wed)
  currentWeekSpend: number;
  currentWeekCount: number;
  topCategory: { label: string; amount: number } | null;
  biggestTransaction: { merchant: string; amount: number; category: string | null } | null;
  pendingTotal: number;

  // Comparison data
  lastWeekByWednesday: number;
  categoryAvgMonthly: Record<string, number>;

  // Selected variant
  variant: MidweekVariant;

  // User context
  timezone: string;
};

export function selectVariant(ctx: {
  currentWeekSpend: number;
  pendingTotal: number;
  topCategory: { label: string; amount: number } | null;
  biggestTransaction: { merchant: string; amount: number } | null;
  categoryAvgMonthly: Record<string, number>;
}): MidweekVariant {
  // Priority 1: Large pending amount (> $50)
  if (ctx.pendingTotal > 50) return 'pending';

  // Priority 2: Category spike (> 2x monthly average and > $30)
  if (ctx.topCategory) {
    const avg = ctx.categoryAvgMonthly[ctx.topCategory.label] ?? 0;
    if (avg > 0 && ctx.topCategory.amount > avg * 2 && ctx.topCategory.amount > 30) {
      return 'spike';
    }
  }

  // Priority 3: Big single transaction (> $100)
  if (ctx.biggestTransaction && ctx.biggestTransaction.amount > 100) {
    return 'big_txn';
  }

  // Priority 4: Quiet week (< $50 total)
  if (ctx.currentWeekSpend < 50) return 'quiet';

  // Default: Pace check
  return 'pace';
}

export function buildMidweekContext(input: {
  currentWeekSummary: TransactionsSummary;
  currentWeekTransactions: TransactionSummary[];
  lastWeekByWednesdaySummary: TransactionsSummary | null;
  last4WeeksSummary: TransactionsSummary | null;
  timezone: string;
}): MidweekContext {
  const { currentWeekSummary, currentWeekTransactions, lastWeekByWednesdaySummary, last4WeeksSummary, timezone } = input;

  const currentWeekSpend = currentWeekSummary.totalSpend;
  const currentWeekCount = currentWeekSummary.count;
  const pendingTotal = currentWeekSummary.pendingSpend;

  // Find top category by spend
  const topCategoryBucket = currentWeekSummary.perCategory
    .filter((c) => !isExcludedCategory(c.label))
    .sort((a, b) => b.spendAmount - a.spendAmount)[0] ?? null;
  const topCategory = topCategoryBucket
    ? { label: topCategoryBucket.label, amount: topCategoryBucket.spendAmount }
    : null;

  // Find biggest single transaction
  const spendTransactions = currentWeekTransactions.filter((t) => t.amount > 0 && !t.pending);
  const biggestTxn = spendTransactions.sort((a, b) => b.amount - a.amount)[0] ?? null;
  const biggestTransaction = biggestTxn
    ? { merchant: biggestTxn.merchant ?? biggestTxn.description ?? 'unknown', amount: biggestTxn.amount, category: biggestTxn.category }
    : null;

  // Last week's Mon-Wed spend for comparison
  const lastWeekByWednesday = lastWeekByWednesdaySummary?.totalSpend ?? 0;

  // Calculate monthly category averages from last 4 weeks
  const categoryAvgMonthly: Record<string, number> = {};
  if (last4WeeksSummary) {
    for (const cat of last4WeeksSummary.perCategory) {
      // Divide by 4 to get weekly average
      categoryAvgMonthly[cat.label] = cat.spendAmount / 4;
    }
  }

  const variant = selectVariant({
    currentWeekSpend,
    pendingTotal,
    topCategory,
    biggestTransaction,
    categoryAvgMonthly,
  });

  return {
    currentWeekSpend: roundCurrency(currentWeekSpend),
    currentWeekCount,
    topCategory: topCategory ? { label: topCategory.label, amount: roundCurrency(topCategory.amount) } : null,
    biggestTransaction: biggestTransaction
      ? { merchant: biggestTransaction.merchant, amount: roundCurrency(biggestTransaction.amount), category: biggestTransaction.category }
      : null,
    pendingTotal: roundCurrency(pendingTotal),
    lastWeekByWednesday: roundCurrency(lastWeekByWednesday),
    categoryAvgMonthly: Object.fromEntries(
      Object.entries(categoryAvgMonthly).map(([k, v]) => [k, roundCurrency(v)])
    ),
    variant,
    timezone,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const EXCLUDED_CATEGORIES = new Set([
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_PAYMENTS',
  'CREDIT_CARD',
  'INCOME',
]);

function isExcludedCategory(label: string | null | undefined): boolean {
  if (!label) return true;
  return EXCLUDED_CATEGORIES.has(label.toUpperCase());
}

export function formatCategoryLabel(label: string): string {
  return label.toLowerCase().replace(/_/g, ' ');
}
