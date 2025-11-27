import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/db";
import { logError } from "@/lib/utils/logger";
import { runWeeklyDigestForUser } from "@/lib/jobs/weeklyDigestJob";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone: string | undefined = body?.phone;
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
    await prisma.user.updateMany({ where: { phone }, data: { onboardingStatus: 'complete' } });

    const user = await prisma.user.findFirst({
      where: { phone },
      select: { id: true },
    });
    if (user) {
      const result = await runWeeklyDigestForUser(user.id, { trigger: 'onboarding' });
      if (result.status === 'failed') {
        logError('weekly-digest.onboarding_failed', undefined, {
          userId: user.id,
          reason: result.reason,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

