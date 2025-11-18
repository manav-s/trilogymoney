import { prisma } from '@/lib/db';
import { chooseIntentFromText, generateReply } from '@/lib/llm';
import { getBalancesBreakdown } from '@/lib/balances';
import { getTransactions } from '@/lib/transactions';
import {
  parseTransactionsQueryWithOverrides,
  TransactionQuery,
  type ParsedTransactionsQueryResult,
} from '@/lib/transactionQuery';
import {
  buildStoredTransactionsQuery,
  shouldReuseStoredQuery,
  storedQueryToTransactionQuery,
  formatRangeLabel,
  type StoredTransactionsQuery,
} from '@/lib/transactionsContext';
import { splitIntoSmsSegments } from '@/lib/sms';
import { sendMessage } from '@/lib/blooio';
import { decryptMessage, encryptMessage } from '@/lib/encryption';

const WEEKLY_DIGEST_STICKY_MS = 1000 * 60 * 60 * 72;
const WEEKLY_DIGEST_DEFAULT_LIMIT = 500;
const DIGEST_FOLLOWUP_BASE_REGEX =
  /\b(?:category|categories|break ?down|food|drink|pending|balance|balances|weekly\s+summary|weekly\s+digest|top\s+merchant|merchant)\b/i;

export async function handleLLMConversation(phone: string, userText: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return;
  const isPaid = user.billingStatus === 'active' || user.billingStatus === 'trialing';
  const isActive = user.messagingStatus === 'active' && user.isActive !== false;
  if (!(isPaid && isActive)) return;

  const history = await getRecentHistorySnippet(user.id, 30, 30);
  let body = '';
  try {
    const profile = { name: user.name, timezone: user.timezone, preferredTime: user.preferredTime } as const;
    const intent = await chooseIntentFromText(userText);
    const parsedResult = parseTransactionsQueryWithOverrides(userText);
    const storedQueryRaw = (user.lastTransactionsQuery as StoredTransactionsQuery | null) ?? null;
    const storedQueryFresh = storedQueryRaw
      ? shouldReuseStoredQuery(parsedResult, storedQueryRaw)
      : false;
    const digestRangeOverride = getWeeklyDigestRangeOverride({
      lastWeeklyDigestAt: user.lastWeeklyDigestAt ?? null,
      history,
      userText,
      parsedResult,
      storedQuery: storedQueryRaw,
    });

    let effectiveQuery: TransactionQuery = parsedResult.query;
    let rangeLabel = formatRangeLabel({ from: effectiveQuery.from, to: effectiveQuery.to });
    let shouldPersistContext = parsedResult.overrideRange;

    if (storedQueryFresh && storedQueryRaw) {
      const baseRange = storedQueryToTransactionQuery(storedQueryRaw);
      if (parsedResult.query.kind === 'merchantSpend' && parsedResult.query.merchant) {
        effectiveQuery = {
          kind: 'merchantSpend',
          limit: parsedResult.query.limit,
          merchant: parsedResult.query.merchant,
          from: baseRange.from,
          to: baseRange.to,
        };
      } else {
        effectiveQuery = baseRange;
      }
      rangeLabel = storedQueryRaw.label;
      shouldPersistContext = false;
    } else if (digestRangeOverride) {
      if (parsedResult.query.kind === 'merchantSpend' && parsedResult.query.merchant) {
        effectiveQuery = {
          kind: 'merchantSpend',
          limit: parsedResult.query.limit,
          merchant: parsedResult.query.merchant,
          from: digestRangeOverride.range.from,
          to: digestRangeOverride.range.to,
        };
      } else {
        effectiveQuery = {
          kind: 'recent',
          limit: digestRangeOverride.limit,
          from: digestRangeOverride.range.from,
          to: digestRangeOverride.range.to,
        };
      }
      rangeLabel = digestRangeOverride.label;
      shouldPersistContext = false;
    }

    const shouldUseTransactions =
      effectiveQuery.kind === 'merchantSpend' || intent === 'transactions';
    if (intent === 'balances') {
      const breakdown = await getBalancesBreakdown({ userId: user.id });
      const cashInstitutions = [...new Set(breakdown.cash.accounts.map(a => a.institution).filter(Boolean))] as string[];
      const cardInstitutions = [...new Set(breakdown.credit.accounts.map(a => a.institution).filter(Boolean))] as string[];
      const cashAccountsJson = JSON.stringify(
        breakdown.cash.accounts.slice(0, 5).map(a => ({
          name: a.name,
          institution: a.institution ?? 'unknown',
          mask: a.mask ?? undefined,
        })),
      );
      const cardAccountsJson = JSON.stringify(
        breakdown.credit.accounts.slice(0, 5).map(a => ({
          name: a.name,
          institution: a.institution ?? 'unknown',
          mask: a.mask ?? undefined,
        })),
      );
      body = await generateReply('balances', {
        cashTotal: breakdown.cash.total,
        cashCount: breakdown.cash.count,
        cashInstitutions: cashInstitutions.length > 0 ? cashInstitutions : null,
        cashAccountsJson,
        cardOwedTotal: breakdown.credit.owedTotal,
        cardCount: breakdown.credit.count,
        cardInstitutions: cardInstitutions.length > 0 ? cardInstitutions : null,
        cardAccountsJson,
        history,
        userText,
        profile,
        quizAnswers: (user as unknown as { quizAnswers?: unknown }).quizAnswers ?? null,
        analysisSummary: (user as unknown as { analysisSummary?: unknown }).analysisSummary ?? null,
      });
    } else if (shouldUseTransactions) {
      const limit = effectiveQuery.limit;
      const txns = await getTransactions({
        userId: user.id,
        from: effectiveQuery.from,
        to: effectiveQuery.to,
        limit,
        maxRows: effectiveQuery.limit,
        ...(effectiveQuery.kind === 'merchantSpend' && effectiveQuery.merchant
          ? { merchant: effectiveQuery.merchant }
          : {}),
      });
      const transactionsJson = JSON.stringify(txns.transactions);
      const summaryJson = JSON.stringify(txns.summary);
      const queryForPrompt: TransactionQuery = effectiveQuery;
      const categorySummaryLines = txns.summary.perCategory.map((bucket) => {
        const spend = Math.round(bucket.spendAmount);
        const refunds = Math.round(bucket.refundAmount);
        if (refunds > 0) {
          return `${bucket.label}: $${spend} spend, $${refunds} refunds`;
        }
        return `${bucket.label}: $${spend} spend`;
      });

      body = await generateReply('transactions', {
        transactions: txns.transactions,
        moreAvailable: txns.moreAvailable,
        transactionsJson,
        summaryJson,
        categorySummaryLines,
        history,
        userText,
        profile,
        query: queryForPrompt,
        rangeLabel,
      });

      if (shouldPersistContext) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastTransactionsQuery: buildStoredTransactionsQuery(queryForPrompt, new Date(), {
              source: 'adhoc',
              label: rangeLabel,
            }),
          },
        });
      }
    } else {
      body = await generateReply('chat', {
        history,
        userText,
        quizAnswers: (user as unknown as { quizAnswers?: unknown }).quizAnswers ?? null,
        analysisSummary: (user as unknown as { analysisSummary?: unknown }).analysisSummary ?? null,
        profile,
      });
    }
  } catch {
    body = /^(hi|hey|hello|yo|sup|howdy)\b/i.test(userText)
      ? 'hey—what money thing can I help with today? balance or a recent charge?'
      : 'how can I help with money today? balance or a recent charge?';
  }
  const parts = splitIntoSmsSegments(body);

  if (parts.length === 0) {
    await sendMessage({ to: phone, body, userId: user.id, shouldPersist: true });
    return;
  }

  for (const segment of parts) {
    await sendMessage({ to: phone, body: segment, userId: user.id, shouldPersist: true });
  }
}

type WeeklyDigestRangeOverride = {
  range: { from: string; to: string };
  label: string;
  limit: number;
};

function getWeeklyDigestRangeOverride(args: {
  lastWeeklyDigestAt: Date | null;
  history: string;
  userText: string;
  parsedResult: ParsedTransactionsQueryResult;
  storedQuery: StoredTransactionsQuery | null;
}): WeeklyDigestRangeOverride | null {
  const { lastWeeklyDigestAt, history, userText, parsedResult, storedQuery } = args;
  if (parsedResult.overrideRange) return null;
  if (!lastWeeklyDigestAt) return null;

  const digestAge = Date.now() - lastWeeklyDigestAt.getTime();
  if (digestAge > WEEKLY_DIGEST_STICKY_MS) return null;

  const normalizedHistory = history?.toLowerCase?.() ?? '';
  if (!normalizedHistory.includes('weekly summary:')) return null;

  const normalizedText = (userText ?? '').toLowerCase();
  if (!normalizedText) return null;
  const digestLabels = collectDigestCategoryLabels(history, storedQuery);
  if (!matchesDigestFollowup(normalizedText, digestLabels)) return null;

  if (storedQuery?.source === 'weekly_digest') {
    return {
      range: { from: storedQuery.from, to: storedQuery.to },
      label: storedQuery.label,
      limit: storedQuery.limit,
    };
  }

  const derivedRange = deriveWeeklyDigestRangeFromTimestamp(lastWeeklyDigestAt);
  if (!derivedRange) return null;
  return {
    range: derivedRange,
    label: formatRangeLabel(derivedRange, { prefix: 'weekly digest' }),
    limit: WEEKLY_DIGEST_DEFAULT_LIMIT,
  };
}

function deriveWeeklyDigestRangeFromTimestamp(timestamp: Date | null): { from: string; to: string } | null {
  if (!timestamp) return null;
  const millis = timestamp.getTime();
  if (!Number.isFinite(millis)) return null;

  const weekStart = getUtcWeekStart(timestamp);
  const start = new Date(weekStart);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: toIsoDay(start), to: toIsoDay(end) };
}

function getUtcWeekStart(base: Date): Date {
  const copy = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function collectDigestCategoryLabels(history: string, storedQuery: StoredTransactionsQuery | null): string[] {
  const labels = new Set<string>();
  if (Array.isArray(storedQuery?.tags)) {
    for (const tag of storedQuery.tags) {
      const normalized = normalizeLabel(tag);
      if (normalized) labels.add(normalized);
    }
  }
  for (const label of extractCategoryLabelsFromHistory(history)) {
    if (label) labels.add(label);
  }
  return Array.from(labels);
}

function extractCategoryLabelsFromHistory(history: string): string[] {
  if (!history) return [];
  const labels = new Set<string>();
  const lines = history.split('\n');
  let capture = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      capture = false;
      continue;
    }
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('category breakdown')) {
      capture = true;
      continue;
    }
    if (!capture) continue;
    if (lowerLine.startsWith('pending to watch') || lowerLine.startsWith('balances:')) {
      capture = false;
      continue;
    }
    const isTrilogy = lowerLine.startsWith('trilogy:');
    if (!isTrilogy) {
      capture = false;
      continue;
    }
    const colonIndex = line.indexOf(':');
    const content = colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : line;
    if (!content) continue;
    const sanitized = content.replace(/^[^A-Za-z0-9]+/, '');
    const amountIndex = sanitized.lastIndexOf('$');
    if (amountIndex === -1) continue;
    const labelRaw = sanitized.slice(0, amountIndex).trim();
    const normalized = normalizeLabel(labelRaw);
    if (normalized) {
      labels.add(normalized);
    }
  }
  return Array.from(labels);
}

function matchesDigestFollowup(normalizedText: string, labels: string[]): boolean {
  if (DIGEST_FOLLOWUP_BASE_REGEX.test(normalizedText)) return true;
  for (const label of labels) {
    if (!label) continue;
    const escaped = escapeRegex(label);
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(normalizedText)) return true;
  }
  return false;
}

function normalizeLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const normalized = label
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getRecentHistorySnippet(userId: string, days = 30, limit = 30): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const msgs = await prisma.message.findMany({
    where: { userId, sentAt: { gte: since } },
    orderBy: { sentAt: 'desc' },
    take: limit,
  });
  const lines: string[] = [];
  for (const m of msgs.reverse()) {
    try {
      const role = m.direction === 'inbound' ? 'you' : 'trilogy';
      const text = decryptMessage(m.content).replace(/\s+/g, ' ').slice(0, 140);
      lines.push(`${role}: ${text}`);
    } catch {}
  }
  return lines.join('\n');
}

