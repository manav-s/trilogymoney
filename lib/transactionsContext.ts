import type { TransactionQuery } from './transactionQuery';
import { RECENT_FALLBACK_LIMIT } from './transactionQuery';

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
};

const SOURCE_TTL_MS: Record<StoredQuerySource, number> = {
  weekly_digest: 1000 * 60 * 60 * 72, // 72h
  monthly_digest: 1000 * 60 * 60 * 24 * 10, // ~10 days
  adhoc: 1000 * 60 * 60 * 48, // 48h
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
  };
}

export function storedQueryToTransactionQuery(
  stored: StoredTransactionsQuery
): TransactionQuery {
  if (stored.kind === 'merchantSpend') {
    return {
      kind: 'merchantSpend',
      from: stored.from,
      to: stored.to,
      limit: stored.limit,
      merchant: stored.merchant,
    };
  }

  return {
    kind: 'recent',
    from: stored.from,
    to: stored.to,
    limit: stored.limit,
  };
}

export function shouldReuseStoredQuery(
  parsedMeta: { query: TransactionQuery; overrideRange: boolean },
  stored: StoredTransactionsQuery | null | undefined,
  now = new Date()
): stored is StoredTransactionsQuery {
  if (!stored) return false;
  if (parsedMeta.overrideRange) return false;

  const storedTime = Date.parse(stored.storedAt);
  if (!Number.isFinite(storedTime)) return false;
  const ttl = SOURCE_TTL_MS[stored.source] ?? SOURCE_TTL_MS.adhoc;
  if (now.getTime() - storedTime > ttl) return false;

  // Allow reuse when parser fell back to generic windows (recent/merchant hints without explicit dates).
  const parsed = parsedMeta.query;
  const parserIsFallbackRecent =
    parsed.kind === 'recent' && parsed.limit === RECENT_FALLBACK_LIMIT;
  const parserIsGenericMerchant =
    parsed.kind === 'merchantSpend' && parsed.limit === 100 && parsed.merchant != null;

  return parserIsFallbackRecent || parserIsGenericMerchant;
}

