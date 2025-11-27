import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db/db";
import { handlePostCheckoutActivation } from "@/lib/postCheckout";

// Stripe webhook handler

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

        const dataToSet: Record<string, string | boolean | null | undefined> = {
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: subscriptionId || null,
          billingStatus: "active",
          // Advance onboarding
          onboardingStatus: "subscribed",
          // Ensure messaging is active upon successful checkout
          messagingStatus: "active",
          isActive: true,
        };

        let userId: string | null = null;

        if (phone) {
          try {
            const user = await prisma.user.update({
              where: { phone },
              data: dataToSet,
              select: { id: true },
            });
            userId = user.id;
          } catch (error) {
            // User not found - this is okay, they might not exist yet
            console.info('stripe.checkout.user_not_found_by_phone', { phone });
          }
        } else if (session.customer_email) {
          try {
            const user = await prisma.user.update({
              where: { email: session.customer_email },
              data: dataToSet,
              select: { id: true },
            });
            userId = user.id;
          } catch (error) {
            console.info('stripe.checkout.user_not_found_by_email', { email: session.customer_email });
          }
        }

        // Trigger post-checkout activation flow
        if (userId) {
          await handlePostCheckoutActivation(userId);
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

        const dataUpdate: Record<string, string | boolean | null | undefined> = {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          billingStatus: status,
        };

        if (status === "active" || status === "trialing") {
          dataUpdate.messagingStatus = "active";
          dataUpdate.isActive = true;
        } else {
          dataUpdate.messagingStatus = "stopped";
          dataUpdate.isActive = false;
        }

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: dataUpdate,
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


