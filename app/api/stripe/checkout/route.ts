import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID; // recurring price id

export async function POST(req: NextRequest) {
  if (!stripeSecretKey || !stripePriceId) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  let body: { success_url?: string; cancel_url?: string; customer_email?: string } = {};
  try {
    body = await req.json();
  } catch {}

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: (body.success_url || `${req.nextUrl.origin}/dashboard`) + "?checkout=success",
      cancel_url: body.cancel_url || `${req.nextUrl.origin}/onboard/checkout`,
      customer_email: body.customer_email,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });
    return NextResponse.json({ id: session.id, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}


