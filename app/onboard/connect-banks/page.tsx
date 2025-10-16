"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_PHONE_KEY } from "@/lib/constants";

export default function ConnectBanksPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const p = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!p) {
      router.push("/");
      return;
    }
    setPhone(p);
  }, [router]);

  if (!phone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 lowercase">loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-12">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>step 3 of 4</span>
            <span>connect your accounts</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "75%" }}></div>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 lowercase">connect your bank accounts</h1>
          <p className="text-gray-600 lowercase">securely link your accounts to personalize your weekly money pulse</p>
        </div>

        {/* Placeholder CTA; replace with Plaid Link once available */}
        <button
          onClick={() => router.push("/onboard/subscribe")}
          className="w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase"
        >
          i’ll connect accounts later →
        </button>
      </div>
    </div>
  );
}


