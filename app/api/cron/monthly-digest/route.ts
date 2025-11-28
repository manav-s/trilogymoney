import { NextRequest, NextResponse } from 'next/server';
import { runMonthlyDigestJob } from '@/lib/jobs/monthlyDigestJob';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await runMonthlyDigestJob();
  return NextResponse.json({ success: true });
}
