"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "scoring spending habits",
  "mapping goals to milestones",
  "estimating consistency score",
  "tuning your weekly cadence",
];

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function AnalyzingPage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);

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
          if (data.next && data.next !== "/onboard/analyzing") {
            router.replace(data.next);
            return;
          }
        }
      } catch {}
      const timer = setInterval(() => setIdx((i) => (i + 1) % STEPS.length), 1200);
      // call analyze in the background while animating
      try {
        await fetch('/api/onboard/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
      } catch {}
      const done = setTimeout(() => router.push("/onboard/plan"), 5200);
      return () => {
        clearInterval(timer);
        clearTimeout(done);
      };
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-xl font-semibold text-gray-900 lowercase mb-2">building your plan…</p>
        <p className="text-gray-600 lowercase transition-all duration-300">{STEPS[idx]}</p>
      </div>
    </div>
  );
}
