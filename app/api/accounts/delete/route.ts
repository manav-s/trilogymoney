import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/db";

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json();
    if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
    await prisma.plaidAccount.update({ where: { id: accountId }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}


