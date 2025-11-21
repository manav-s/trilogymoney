import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { runBalanceUpdateForUser } from '@/lib/balanceJob';

const DEFAULT_BATCH_SIZE = 50;

function getBatchSize(): number {
  const raw = process.env.BALANCE_CRON_BATCH_SIZE;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

export async function GET(req: Request) {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const batchSize = getBatchSize();

  const usersToUpdate = await prisma.user.findMany({
    where: {
      isActive: true,
      messagingStatus: 'active',
      billingStatus: { in: ['active', 'trialing'] },
      OR: [
        { lastBalanceUpdateAt: null },
        { lastBalanceUpdateAt: { lt: threeDaysAgo } },
      ],
    },
    select: { id: true },
    take: batchSize,
  });

  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const user of usersToUpdate) {
    const result = await runBalanceUpdateForUser(user.id);
    if (result.status === 'sent') results.sent += 1;
    else if (result.status === 'skipped') results.skipped += 1;
    else results.failed += 1;
  }

  return NextResponse.json({
    success: true,
    batchSize,
    processed: usersToUpdate.length,
    results,
  });
}
