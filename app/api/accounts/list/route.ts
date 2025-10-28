import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      items: {
        select: {
          id: true,
          institutionName: true,
          accounts: {
            where: { isActive: true },
            select: {
              id: true,
              accountId: true,
              name: true,
              officialName: true,
              mask: true,
              type: true,
              subtype: true,
              currency: true,
              currentBalance: true,
              availableBalance: true,
            },
          },
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  return NextResponse.json({
    user: { email: user.email, stripeCustomerId: user.stripeCustomerId },
    items: user.items,
  });
}


