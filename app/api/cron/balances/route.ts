import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/db';
import { askBalanceQuestion } from '@/lib/jobs/balanceJob';

const DEFAULT_BATCH_SIZE = 500;

function getBatchSize(): number {
  const raw = process.env.BALANCE_CRON_BATCH_SIZE;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

export async function GET(req: Request) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const batchSize = getBatchSize();

  const usersToUpdate = await prisma.user.findMany({
    where: {
      isActive: true,
      messagingStatus: 'active',
      billingStatus: { in: ['active', 'trialing'] },
      pendingJobType: null, // Don't ask if already pending
      OR: [
        { lastBalanceUpdateAt: null },
        { lastBalanceUpdateAt: { lt: oneDayAgo } },
      ],
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
