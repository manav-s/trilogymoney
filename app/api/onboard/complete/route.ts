import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postOnboardingWelcome } from "@/lib/onboarding-welcome";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone: string | undefined = body?.phone;
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
    const result = await prisma.user.updateMany({ where: { phone }, data: { onboardingStatus: 'complete' } });

    if (result.count > 0) {
      const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (user?.id) {
        void postOnboardingWelcome(user.id).catch((error) => {
          console.error("onboard.complete.welcome_failed", { userId: user.id, error });
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}


