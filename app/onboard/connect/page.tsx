"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function ConnectPage() {
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
          if (data.next && data.next !== "/onboard/connect") {
            router.replace(data.next);
          }
        }
      } catch {}
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">connect your accounts</h1>
        <div className="bg-gray-100 rounded-2xl p-6 text-gray-700 lowercase">
          plaid link goes here
        </div>
        <div className="mt-10 flex justify-end">
          <button
            onClick={() => router.push("/onboard/checkout")}
            className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700"
          >
            continue →
          </button>
        </div>
      </div>
    </div>
  );
}
