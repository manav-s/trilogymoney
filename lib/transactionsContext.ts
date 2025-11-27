import type { TransactionQuery } from './transactionQuery';
import type { TransactionSummary } from './services/transactions';

export type StoredQuerySource = 'weekly_digest' | 'monthly_digest' | 'adhoc';

export type StoredTransactionsQuery = {
  kind: TransactionQuery['kind'];
  from: string;
  to: string;
  limit: number;
  merchant: string | null;
  storedAt: string;
  source: StoredQuerySource;
  label: string;
  tags?: string[];
  categoryFocusNormalized?: string | null;
  categoryFocusDisplay?: string | null;
  storedTransactions?: TransactionSummary[];
};

type RangeLike = { from: string; to: string };

export function formatRangeLabel(range: RangeLike, options?: { prefix?: string }): string {
  const fromDate = new Date(range.from);
  const toDate = new Date(range.to);
  const sameDay = range.from === range.to;
  const fmt = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const label = sameDay ? fmt(fromDate) : `${fmt(fromDate)} → ${fmt(toDate)}`;
  return options?.prefix ? `${options.prefix} ${label}` : label;
}

export function buildStoredTransactionsQuery(
  query: TransactionQuery,
  now = new Date(),
  meta?: {
    source?: StoredQuerySource;
    label?: string;
    tags?: string[];
    categoryFocus?: { normalized: string; display?: string | null };
    storedTransactions?: TransactionSummary[];
  }
): StoredTransactionsQuery {
  const baseRange = { from: query.from, to: query.to };
  const label = meta?.label ?? formatRangeLabel(baseRange);
  return {
    kind: query.kind,
    from: query.from,
    to: query.to,
    limit: query.limit,
    merchant: query.kind === 'merchantSpend' ? query.merchant ?? null : null,
    storedAt: now.toISOString(),
    source: meta?.source ?? 'adhoc',
    label,
    tags: Array.isArray(meta?.tags) ? meta?.tags?.map(tag => tag ?? '').filter(Boolean) : undefined,
    categoryFocusNormalized: meta?.categoryFocus?.normalized ?? null,
    categoryFocusDisplay: meta?.categoryFocus?.display ?? null,
    storedTransactions: meta?.storedTransactions,
  };
}
