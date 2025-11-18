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
const DIGEST_FOLLOWUP_REGEX =
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
    const shouldForceWeeklyDigestRange = shouldApplyWeeklyDigestRange({
      lastWeeklyDigestAt: user.lastWeeklyDigestAt ?? null,
      history,
      userText,
      parsedResult,
      storedQuery: storedQueryRaw,
    });

    let effectiveQuery: TransactionQuery = parsedResult.query;
    let rangeLabel = formatRangeLabel({ from: effectiveQuery.from, to: effectiveQuery.to });
    let shouldPersistContext = parsedResult.overrideRange;

    if (storedQueryRaw && (storedQueryFresh || shouldForceWeeklyDigestRange)) {
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

function shouldApplyWeeklyDigestRange(args: {
  lastWeeklyDigestAt: Date | null;
  history: string;
  userText: string;
  parsedResult: ParsedTransactionsQueryResult;
  storedQuery: StoredTransactionsQuery | null;
}): boolean {
  const { lastWeeklyDigestAt, history, userText, parsedResult, storedQuery } = args;
  if (!storedQuery || storedQuery.source !== 'weekly_digest') return false;
  if (!lastWeeklyDigestAt) return false;
  if (parsedResult.overrideRange) return false;

  const digestAge = Date.now() - lastWeeklyDigestAt.getTime();
  if (digestAge > WEEKLY_DIGEST_STICKY_MS) return false;

  const normalizedHistory = history?.toLowerCase?.() ?? '';
  if (!normalizedHistory.includes('weekly summary:')) return false;

  const normalizedText = (userText ?? '').toLowerCase();
  if (!normalizedText) return false;
  if (!DIGEST_FOLLOWUP_REGEX.test(normalizedText)) return false;

  return true;
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

