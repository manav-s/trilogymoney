import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postOnboardingWelcome } from "@/lib/onboarding-welcome";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone: string | undefined = body?.phone;
    if (!phone) {
      return NextResponse.json({ error: "phone required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, billingStatus: true, messagingStatus: true, isActive: true },
    });
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { phone },
      data: {
        onboardingStatus: "complete",
        messagingStatus: "active",
        isActive: true,
        billingStatus: user.billingStatus && user.billingStatus !== "canceled" ? user.billingStatus : "trialing",
      },
    });

    void postOnboardingWelcome(user.id).catch((error) => {
      console.error("onboard.complete.welcome_failed", { userId: user.id, error });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

