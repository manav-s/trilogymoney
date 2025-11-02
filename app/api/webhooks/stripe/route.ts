import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig || "", webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const phone = session.metadata?.phone || null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription as Stripe.Subscription | null)?.id;

        const dataToSet: Record<string, string | null | undefined> = {
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: subscriptionId || null,
          billingStatus: "active",
          // Advance onboarding
          onboardingStatus: "subscribed",
        };

        if (phone) {
          await prisma.user.updateMany({ where: { phone }, data: dataToSet });
        } else if (session.customer_email) {
          await prisma.user.updateMany({ where: { email: session.customer_email }, data: dataToSet });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const status = sub.status; // active | trialing | canceled | incomplete | past_due | unpaid | incomplete_expired

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            billingStatus: status,
          },
        });
        break;
      }

      // invoice events can be used to harden state if needed
      case "invoice.paid":
      case "invoice.payment_failed":
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: "webhook handler error" }, { status: 500 });
  }
}


