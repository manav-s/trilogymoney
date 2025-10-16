import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

export const config = { api: { bodyParser: false } } as const;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig || "", secret);
    } catch (_e) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email || session.customer_email || undefined;
        if (email) {
          const user = await prisma.user.findUnique({ where: { email } });
          if (user) {
            let customerId: string | undefined;
            if (typeof session.customer === "string") {
              customerId = session.customer;
            } else if (session.customer && typeof session.customer === "object") {
              customerId = (session.customer as Stripe.Customer).id;
            }

            let subscriptionId: string | undefined;
            if (typeof session.subscription === "string") {
              subscriptionId = session.subscription;
            } else if (session.subscription && typeof session.subscription === "object") {
              subscriptionId = (session.subscription as Stripe.Subscription).id;
            }

            await prisma.user.update({
              where: { id: user.id },
              data: {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: "trialing",
                onboardingStatus: "trial_started",
              },
            });
          }
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { subscriptionStatus: sub.status },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { subscriptionStatus: "canceled" },
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}


