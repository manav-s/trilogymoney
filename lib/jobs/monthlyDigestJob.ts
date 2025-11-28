import { prisma } from '@/lib/db/db';
import { sendMonthlyDigest } from '@/lib/monthlyDigest';
import { logError } from '@/lib/utils/logger';

export async function runMonthlyDigestJob() {
  // Get all active paid users - no weekly digest check, both can send same day
  const users = await prisma.user.findMany({
    where: {
      billingStatus: { in: ['active', 'trialing'] },
      messagingStatus: 'active',
      isActive: true,
    },
    select: { id: true, phone: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.phone) {
      skipped++;
      continue;
    }

    try {
      const result = await sendMonthlyDigest(user.id, user.phone);
      if (result.status === 'sent') sent++;
      else if (result.status === 'skipped') skipped++;
      else failed++;
    } catch (e) {
      logError('monthly_digest.user', e, { userId: user.id });
      failed++;
    }
  }

  console.info('monthly_digest.complete', { sent, skipped, failed, total: users.length });
}
