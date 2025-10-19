"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) {
      router.replace("/");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/onboard/status?phone=${encodeURIComponent(phone)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.next && data.next !== "/onboard/checkout") {
            router.replace(data.next);
          }
        }
      } catch {}
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">checkout</h1>
        <p className="text-gray-600 lowercase mb-8">secure payment via stripe</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700"
        >
          simulate payment →
        </button>
      </div>
    </div>
  );
}
