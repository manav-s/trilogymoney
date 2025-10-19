"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function PlanPage() {
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
          if (data.next && data.next !== "/onboard/plan") {
            router.replace(data.next);
          }
        }
      } catch {}
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">your weekly money plan</h1>
        <ul className="list-disc pl-5 space-y-2 text-gray-700 lowercase">
          <li>automate minimum payments this week</li>
          <li>build a 1‑month cushion with a monthly transfer</li>
          <li>weekly check‑in keeps you consistent</li>
        </ul>
        <div className="mt-10 flex">
          <button
            onClick={() => router.push("/onboard/connect")}
            className="px-6 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700"
          >
            connect your accounts
          </button>
        </div>
      </div>
    </div>
  );
}
