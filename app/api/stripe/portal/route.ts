import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function POST(req: NextRequest) {
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
  let body: { customer_id?: string } = {};
  try { body = await req.json(); } catch {}
  const { customer_id } = body;
  if (!customer_id) {
    return NextResponse.json({ error: "customer_id required" }, { status: 400 });
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: `${req.nextUrl.origin}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}


