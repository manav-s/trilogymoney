import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/db';
import { askBalanceQuestion } from '@/lib/jobs/balanceJob';

const DEFAULT_BATCH_SIZE = 500;

function getBatchSize(): number {
  const raw = process.env.BALANCE_CRON_BATCH_SIZE;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

function shouldRunToday(date = new Date()): boolean {
  const day = date.getUTCDay(); // 0=Sun ... 3=Wed
  if (day !== 3) return false;
  const dom = date.getUTCDate();
  const isFirstWeek = dom >= 1 && dom <= 7;
  const isThirdWeek = dom >= 15 && dom <= 21;
  return isFirstWeek || isThirdWeek;
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1';
  // Cron still triggers daily, but only run balances on 1st/3rd Wednesdays unless forced.
  if (!force && !shouldRunToday()) {
    return NextResponse.json({ success: false, skipped: true, reason: 'outside_window' });
  }

  const batchSize = getBatchSize();

  const usersToUpdate = await prisma.user.findMany({
    where: {
      isActive: true,
      messagingStatus: 'active',
      billingStatus: { in: ['active', 'trialing'] },
      pendingJobType: null, // Don't ask if already pending
    },
    select: { id: true },
    orderBy: { lastBalanceUpdateAt: 'asc' },
    take: batchSize,
  });

  const results = { asked: 0, skipped: 0 };

  for (const user of usersToUpdate) {
    const result = await askBalanceQuestion(user.id);
    if (result.status === 'asked') results.asked += 1;
    else results.skipped += 1;
  }

  return NextResponse.json({
    success: true,
    batchSize,
    processed: usersToUpdate.length,
    results,
  });
}
