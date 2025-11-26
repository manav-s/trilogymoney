import { prisma } from '@/lib/db';
import { getBalancesBreakdown } from '@/lib/balances';
import { getTransactions, isIncome, buildTransactionsSummary } from '@/lib/transactions';
import { logError, logger } from '@/lib/logger';
import type { StoredTransactionsQuery } from '@/lib/transactionsContext';
import { captureFeedback, type FeedbackSentiment } from '@/lib/feedback';
import { getRecurringStreams } from '@/lib/recurring';

export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type ToolResult = unknown;

export function getBalancesToolSchema(): ToolSchema {
  return {
    name: 'get_balances',
    description: 'Get current cash and credit card balances for the user',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };
}

export function getTransactionsToolSchema(): ToolSchema {
  return {
    name: 'get_transactions',
    description:
      'Get recent transactions with optional filters. Use this for spending queries, merchant lookups, or category breakdowns.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format. Defaults to 7 days ago.',
        },
        to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format. Defaults to today.',
        },
        merchant: {
          type: 'string',
          description: 'Filter by merchant name (case-insensitive, fuzzy match)',
        },
        category: {
          type: 'string',
          description:
            'Filter by Plaid category. Valid values: Food and Drink, Transportation, Shopping, General Merchandise, General Services, Entertainment, Bills and Utilities, Health and Wellness, Travel, Personal Care, Home Improvement',
        },
        limit: {
          type: 'number',
          description: 'Max transactions to return. Default 50, max 500.',
        },
        includeIncome: {
          type: 'boolean',
          description: 'Set to true to include income/deposit transactions. Default false (spend only).',
        },
      },
      required: [],
    },
  };
}

export function getWeeklyDigestSnapshotToolSchema(): ToolSchema {
  return {
    name: 'get_weekly_digest_snapshot',
    description:
      "Retrieve the cached weekly digest data from the last weekly summary sent to the user. Use this when the user asks about 'last week', 'my digest', or references categories from the weekly summary. Only available if sent within the last 72 hours.",
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional: filter the cached digest by category',
        },
      },
      required: [],
    },
  };
}

export function logFeedbackToolSchema(): ToolSchema {
  return {
    name: 'log_feedback',
    description: 'Log when the user seems frustrated/angry or is reporting a bug. Use when user is upset or giving feedback.',
    parameters: {
      type: 'object',
      properties: {
        sentiment: {
          type: 'string',
          description: 'One of frustrated, bug_report, or feedback. Default frustrated.',
          enum: ['frustrated', 'bug_report', 'feedback'],
        },
        message: {
          type: 'string',
          description: 'Optional short summary of what the user said.',
        },
      },
      required: [],
    },
  };
}

export function getRecurringChargesToolSchema(): ToolSchema {
  return {
    name: 'get_recurring_charges',
    description:
      'Fetch active recurring subscriptions and bills (e.g. netflix, rent, gym). Use this for questions about subscriptions, monthly charges, or bills.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };
}

export async function executeToolCall(userId: string, toolCall: ToolCall): Promise<ToolResult> {
  try {
    const parsedArgs = safeParseArgs(toolCall.function.arguments);
    switch (toolCall.function.name) {
      case 'get_balances':
        return await executeGetBalances(userId);
      case 'get_transactions':
        return await executeGetTransactions(userId, parsedArgs ?? {});
      case 'get_weekly_digest_snapshot':
        return await executeGetWeeklyDigestSnapshot(userId, parsedArgs ?? {});
      case 'log_feedback':
        return await executeLogFeedback(userId, parsedArgs ?? {});
      case 'get_recurring_charges':
        return await executeGetRecurringCharges(userId);
      default:
        return { error: 'unknown_tool' };
    }
  } catch (err) {
    logError('tools.execute', err, { name: toolCall.function.name });
    return { error: 'tool_execution_failed' };
  }
}

function safeParseArgs(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

async function executeGetBalances(userId: string) {
  const breakdown = await getBalancesBreakdown({ userId });
  logger.info('tools.get_balances.snapshot', {
    userId,
    ts: new Date().toISOString(),
    cashTotal: breakdown.cash.total,
    cashCount: breakdown.cash.count,
    cashInstitutions: breakdown.cash.accounts.map((a) => a.institution).filter(Boolean),
    creditOwedTotal: breakdown.credit.owedTotal,
    creditCount: breakdown.credit.count,
    creditInstitutions: breakdown.credit.accounts.map((a) => a.institution).filter(Boolean),
  });
  return {
    cash: {
      total: breakdown.cash.total,
      accounts: breakdown.cash.accounts.map((a) => ({
        name: a.name,
        institution: a.institution,
        available: a.available,
        mask: a.mask,
      })),
    },
    credit: {
      owedTotal: breakdown.credit.owedTotal,
      accounts: breakdown.credit.accounts.map((a) => ({
        name: a.name,
        institution: a.institution,
        balance: a.current ?? null,
        mask: a.mask,
      })),
    },
  };
}

async function executeGetTransactions(
  userId: string,
  params: {
    from?: string;
    to?: string;
    merchant?: string;
    category?: string;
    limit?: number;
    includeIncome?: boolean;
  }
) {
  const limit = Math.min(params.limit ?? 50, 500);
  const from = isValidIsoDate(params.from) ? params.from! : getDateDaysAgo(7);
  const to = isValidIsoDate(params.to) ? params.to! : getTodayIso();

  const txns = await getTransactions({
    userId,
    from,
    to,
    limit,
    maxRows: limit,
    ...(params.merchant ? { merchant: params.merchant } : {}),
    ...(params.category ? { category: params.category } : {}),
  });

  let filtered = txns.transactions;

  if (!params.includeIncome) {
    filtered = filtered.filter((t) => !isIncome(t));
  }

  return {
    transactions: filtered,
    summary: buildTransactionsSummary(filtered, { from, to }),
    count: filtered.length,
    from,
    to,
  };
}

async function executeGetWeeklyDigestSnapshot(userId: string, params: { category?: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastWeeklyDigestAt: true, lastTransactionsQuery: true },
  });

  if (!user?.lastWeeklyDigestAt) {
    return { error: 'No digest found' };
  }

  const digestAge = Date.now() - user.lastWeeklyDigestAt.getTime();
  if (digestAge > 72 * 60 * 60 * 1000) {
    return { error: 'Digest too old (>72h)' };
  }

  const storedQuery = user.lastTransactionsQuery as StoredTransactionsQuery | null;
  if (storedQuery?.source !== 'weekly_digest' || !storedQuery.storedTransactions) {
    return { error: 'No cached transactions' };
  }

  let transactions = storedQuery.storedTransactions;
  if (params.category) {
    const normalized = normalizeCategoryName(params.category);
    if (normalized) {
      transactions = transactions.filter((t) => matchesCategoryLabel(t.category, normalized.normalized));
    }
  }

  return {
    transactions,
    from: storedQuery.from,
    to: storedQuery.to,
    label: storedQuery.label,
    cached: true,
  };
}

function getDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidIsoDate(input?: string): boolean {
  return typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim());
}

async function executeLogFeedback(
  userId: string,
  params: { sentiment?: string; message?: string }
) {
  const sentiment = sanitizeSentiment(params.sentiment);
  await captureFeedback({
    userId,
    userMessage: params.message ?? '[captured via tool]',
    sentiment,
    context: { source: 'tool_call' },
  });
  return { status: 'logged', sentiment };
}

function sanitizeSentiment(raw: unknown): FeedbackSentiment {
  const value = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (value === 'bug_report' || value === 'feedback' || value === 'frustrated') return value;
  return 'frustrated';
}

async function executeGetRecurringCharges(userId: string) {
  const streams = await getRecurringStreams(userId);

  const active = streams
    .filter((s) => s.isActive)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  if (active.length === 0) return { message: 'No active recurring charges found.' };

  return active.map((s) => ({
    merchant: s.merchant,
    amount: s.amount,
    freq: s.frequency,
    next: s.nextDate,
    cat: s.category,
    acct: `${s.institutionName} - ${s.accountName}`,
    status: s.status,
  }));
}

const CATEGORY_WHITELIST = [
  'Food and Drink',
  'Transportation',
  'Shopping',
  'General Merchandise',
  'General Services',
  'Entertainment',
  'Bills and Utilities',
  'Health and Wellness',
  'Travel',
  'Personal Care',
  'Home Improvement',
];

const CATEGORY_NORMALIZED_MAP = new Map(
  CATEGORY_WHITELIST.map((label) => [normalizeLabel(label) ?? label.toLowerCase(), label])
);

function normalizeCategoryName(
  raw: string | null | undefined
): { normalized: string; display: string } | null {
  if (!raw) return null;
  const normalized = normalizeLabel(raw);
  if (!normalized) return null;
  if (CATEGORY_NORMALIZED_MAP.has(normalized)) {
    return { normalized, display: CATEGORY_NORMALIZED_MAP.get(normalized)! };
  }
  for (const [key, display] of CATEGORY_NORMALIZED_MAP.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return { normalized: key, display };
    }
  }
  return null;
}

function matchesCategoryLabel(category: string | null | undefined, normalizedLabel: string): boolean {
  const txnCategory = normalizeLabel(category);
  if (!txnCategory) return false;
  return (
    txnCategory === normalizedLabel ||
    txnCategory.includes(normalizedLabel) ||
    normalizedLabel.includes(txnCategory)
  );
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
