"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_PHONE_KEY } from "@/lib/constants";

export default function SubscribePage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!p) {
      router.push("/");
      return;
    }
    setPhone(p);
  }, [router]);

  async function startTrial() {
    if (!phone) return;
    setLoading(true);
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID as string | undefined;
    const res = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, priceId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url as string;
    } else {
      setLoading(false);
    }
  }

  if (!phone) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-12">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>step 4 of 4</span>
            <span>start your free trial</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "100%" }}></div>
          </div>
        </div>
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 lowercase">start your free trial</h1>
          <p className="text-gray-600 lowercase">weekly iMessage with what matters most</p>
        </div>
        <button onClick={startTrial} disabled={loading} className="w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white disabled:opacity-50">
          {loading ? "redirecting…" : "start free trial →"}
        </button>
      </div>
    </div>
  );
}


