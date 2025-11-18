export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { getBalancesBreakdown } from '@/lib/balances';
import { sendMessage } from '@/lib/blooio';
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { generateWeeklyDigestMessage } from '@/lib/llm';
import { getTransactions } from '@/lib/transactions';
import { buildWeeklyDigestContext, extractHighlights } from '@/lib/weeklyDigest';
import { TransactionQuery } from '@/lib/transactionQuery';
import { buildStoredTransactionsQuery, formatRangeLabel } from '@/lib/transactionsContext';

const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 50;
const MAX_TRANSACTIONS_FOR_DIGEST = 500;

function getWeekStart(date = new Date()): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  const day = copy.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // convert to Monday start
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

function getPreviousWeekRange(weekStart: Date): { from: string; to: string } {
  const start = new Date(weekStart);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: toIsoDay(start), to: toIsoDay(end) };
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseLimit(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get('limit');
  if (!raw) return DEFAULT_BATCH_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_BATCH_LIMIT;
  return Math.min(parsed, MAX_BATCH_LIMIT);
}

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('weekly-digest.cron_missing_secret');
    return false;
  }
  const providedHeader = req.headers.get('x-cron-secret');
  if (providedHeader && providedHeader === secret) {
    return true;
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token === secret;
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = parseLimit(req);
  const weekStart = getWeekStart();

  const candidates = await prisma.$queryRaw<DigestCandidate[]>`
    SELECT
      u."id",
      u."phone",
      u."timezone",
      u."lastWeeklyDigestAt",
      u."lastTransactionsQuery"
    FROM "User" u
    WHERE u."isActive" = true
      AND u."messagingStatus" = 'active'
      AND (
        u."lastWeeklyDigestAt" IS NULL
        OR u."lastWeeklyDigestAt" < ${weekStart}
      )
      AND EXISTS (
        SELECT 1
        FROM "PlaidItem" i
        JOIN "PlaidAccount" a ON a."itemId" = i."id"
        WHERE i."userId" = u."id"
          AND a."isActive" = true
      )
    ORDER BY u."lastWeeklyDigestAt" NULLS FIRST, u."createdAt" ASC
    LIMIT ${limit};
  `;

  const summary: {
    scheduled: number;
    sent: number;
    skipped: number;
    failed: number;
    errors: Array<{ userId: string; message: string }>;
  } = {
    scheduled: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const user of candidates) {
    try {
      const result = await sendWeeklyDigestCandidate(user, weekStart);
      switch (result.status) {
        case 'sent':
          summary.sent += 1;
          break;
        case 'skipped':
          summary.skipped += 1;
          break;
        case 'failed':
          summary.failed += 1;
          summary.errors.push({ userId: user.id, message: result.reason });
          break;
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        userId: user.id,
        message: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  return NextResponse.json({
    ...summary,
    limit,
    weekStart: weekStart.toISOString(),
    userIds: candidates.map((user) => user.id),
  });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}

type DigestCandidate = {
  id: string;
  phone: string | null;
  timezone: string;
  lastWeeklyDigestAt: Date | null;
  lastTransactionsQuery: unknown | null;
};

type DigestResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

async function sendWeeklyDigestCandidate(
  user: DigestCandidate,
  weekStart: Date
): Promise<DigestResult> {
  if (!user.phone) {
    return { status: 'skipped', reason: 'missing_phone' };
  }

  const digestRange = getPreviousWeekRange(weekStart);

  let transactionsResult;
  try {
    transactionsResult = await getTransactions({
      userId: user.id,
      from: digestRange.from,
      to: digestRange.to,
      limit: MAX_TRANSACTIONS_FOR_DIGEST,
      maxRows: MAX_TRANSACTIONS_FOR_DIGEST,
    });
  } catch (error) {
    const message = (error instanceof Error && error.message) || 'unknown_error';
    if (message.includes('paid users')) {
      console.info('weekly-digest.skip', { userId: user.id, reason: 'paid_only' });
      return { status: 'skipped', reason: 'paid_only' };
    }
    logError('weekly-digest.transactions', error, {
      userId: user.id,
      range: digestRange,
    });
    return { status: 'failed', reason: 'transactions_error' };
  }

  let balances;
  try {
    balances = await getBalancesBreakdown({ userId: user.id });
  } catch (error) {
    logError('weekly-digest.balances', error, {
      userId: user.id,
      range: digestRange,
    });
    return { status: 'failed', reason: 'balances_error' };
  }

  const summary = transactionsResult.summary;
  const highlights = extractHighlights(summary);
  const digestContext = buildWeeklyDigestContext({
    summary,
    transactions: transactionsResult.transactions,
    balances,
    timezone: user.timezone,
    range: digestRange,
    highlights,
  });

  const message = await generateWeeklyDigestMessage(digestContext);
  if (!message) {
    logError('weekly-digest.llm', undefined, {
      userId: user.id,
      range: digestRange,
    });
    return { status: 'failed', reason: 'llm_error' };
  }

  if (process.env.WEEKLY_DIGEST_DRY_RUN === '1') {
    console.info('weekly-digest.dry_run', {
      userId: user.id,
      range: digestRange,
      message,
      highlights,
    });
    return { status: 'skipped', reason: 'dry_run' };
  }

  const now = new Date();
  const digestQuery: TransactionQuery = {
    kind: 'recent',
    from: digestRange.from,
    to: digestRange.to,
    limit: MAX_TRANSACTIONS_FOR_DIGEST,
  };

  const previousState = {
    lastWeeklyDigestAt: user.lastWeeklyDigestAt ?? null,
    lastTransactionsQuery: user.lastTransactionsQuery ?? null,
  };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastWeeklyDigestAt: now,
        lastTransactionsQuery: buildStoredTransactionsQuery(digestQuery, now, {
          source: 'weekly_digest',
          label: formatRangeLabel(digestRange, { prefix: 'weekly digest' }),
        }),
      },
    });
  } catch (error) {
    logError('weekly-digest.persist', error, {
      userId: user.id,
      range: digestRange,
    });
    return { status: 'failed', reason: 'persist_error' };
  }

  try {
    await sendMessage({
      to: user.phone,
      body: message,
      userId: user.id,
      shouldPersist: true,
    });
  } catch (error) {
    logError('weekly-digest.send', error, {
      userId: user.id,
      range: digestRange,
    });

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastWeeklyDigestAt: previousState.lastWeeklyDigestAt,
          lastTransactionsQuery: previousState.lastTransactionsQuery as unknown as Prisma.JsonValue | null,
        },
      });
    } catch (restoreError) {
      logError('weekly-digest.restore', restoreError, {
        userId: user.id,
        range: digestRange,
      });
    }

    return { status: 'failed', reason: 'send_error' };
  }

  console.info('weekly-digest.sent', {
    userId: user.id,
    range: digestRange,
    highlights,
    totals: {
      totalSpend: summary.totalSpend,
      totalRefund: summary.totalRefund,
      pendingSpend: summary.pendingSpend,
    },
  });

  return { status: 'sent' };
}

