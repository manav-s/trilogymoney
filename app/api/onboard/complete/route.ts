import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone: string | undefined = body?.phone;
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
    await prisma.user.updateMany({ where: { phone }, data: { onboardingStatus: 'complete' } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}


