export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/db';
import { runMidweekCheckinForUser, getCurrentWeekMonday } from '@/lib/jobs/midweekCheckinJob';

const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 50;

type MidweekCandidate = {
  id: string;
};

function parseLimit(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get('limit');
  if (!raw) return DEFAULT_BATCH_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_BATCH_LIMIT;
  return Math.min(parsed, MAX_BATCH_LIMIT);
}

async function handleRequest(req: NextRequest) {
  const limit = parseLimit(req);
  const weekMonday = getCurrentWeekMonday();

  // Find active users who haven't received midweek checkin this week
  // We reuse lastMidweekCheckinAt if it exists, otherwise send to everyone
  const candidates = await prisma.$queryRaw<MidweekCandidate[]>`
    SELECT
      u."id",
      u."phone",
      u."timezone"
    FROM "User" u
    WHERE u."isActive" = true
      AND u."messagingStatus" = 'active'
      AND u."phone" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "PlaidItem" i
        JOIN "PlaidAccount" a ON a."itemId" = i."id"
        WHERE i."userId" = u."id"
          AND a."isActive" = true
      )
    ORDER BY u."createdAt" ASC
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
      const result = await runMidweekCheckinForUser(user.id);
      switch (result.status) {
        case 'sent':
          summary.sent += 1;
          break;
        case 'skipped':
          summary.skipped += 1;
          break;
        case 'failed':
          summary.failed += 1;
          summary.errors.push({ userId: user.id, message: result.reason ?? 'unknown' });
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
    weekMonday: weekMonday.toISOString(),
    userIds: candidates.map((user) => user.id),
  });
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}
