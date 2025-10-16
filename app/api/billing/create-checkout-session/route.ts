import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

const bodySchema = z.object({
  phone: z.string().min(10),
  priceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { phone, priceId } = bodySchema.parse(json);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const session = await createCheckoutSession({
      priceId,
      customerEmail: user.email || undefined,
      successUrl: `${baseUrl}/onboard/success`,
      cancelUrl: `${baseUrl}/onboard/subscribe`,
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}


