import type { TransactionQuery } from './transactionQuery';
import { RECENT_FALLBACK_LIMIT } from './transactionQuery';

export type StoredTransactionsQuery = {
  kind: 'merchantSpend' | 'recent';
  from: string;
  to: string;
  limit: number;
  merchant: string | null;
  storedAt: string;
};

export const STORED_QUERY_TTL_MS = 1000 * 60 * 60 * 48; // 48 hours

export function buildStoredTransactionsQuery(
  query: TransactionQuery,
  now = new Date()
): StoredTransactionsQuery {
  return {
    kind: query.kind,
    from: query.from,
    to: query.to,
    limit: query.limit,
    merchant: query.kind === 'merchantSpend' ? query.merchant ?? null : null,
    storedAt: now.toISOString(),
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
  parsed: TransactionQuery,
  stored: StoredTransactionsQuery | null | undefined,
  now = new Date()
): stored is StoredTransactionsQuery {
  if (!stored) return false;

  const storedTime = Date.parse(stored.storedAt);
  if (!Number.isFinite(storedTime)) return false;
  if (now.getTime() - storedTime > STORED_QUERY_TTL_MS) return false;

  const parserIsFallback =
    parsed.kind === 'recent' && parsed.limit === RECENT_FALLBACK_LIMIT;
  return parserIsFallback;
}

