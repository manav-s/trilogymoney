import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/db";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
    await prisma.user.update({
      where: { phone },
      data: {
        isActive: false,
        messagingStatus: "stopped",
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}


