import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  cachedStripe = new Stripe(key);
  return cachedStripe;
}

export async function createCheckoutSession(params: {
  customerEmail?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "hosted",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    allow_promotion_codes: true,
  });
  return session;
}


