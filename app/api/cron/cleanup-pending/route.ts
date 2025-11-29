import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/db';

const PENDING_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function GET() {
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MS);

  const result = await prisma.user.updateMany({
    where: {
      pendingJobType: { not: null },
      pendingJobAskedAt: { lt: cutoff },
    },
    data: {
      pendingJobType: null,
      pendingJobAskedAt: null,
    },
  });

  console.info('cleanup-pending.run', {
    cleared: result.count,
    cutoff,
  });

  return NextResponse.json({
    success: true,
    cleared: result.count,
    cutoff,
  });
}
