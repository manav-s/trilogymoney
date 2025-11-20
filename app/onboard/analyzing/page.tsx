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
    <div className="min-h-screen bg-black flex items-center justify-center font-mono p-4">
      <div className="max-w-md w-full space-y-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        
        <div className="space-y-2 text-sm sm:text-base">
          {STEPS.map((step, i) => (
            <div key={step} className={`flex items-center gap-3 transition-opacity duration-300 ${i > idx ? 'opacity-0' : i === idx ? 'opacity-100' : 'opacity-50'}`}>
              <span className={i <= idx ? "text-green-500" : "text-gray-600"}>
                {i < idx ? "✓" : i === idx ? ">" : " "}
              </span>
              <span className={i === idx ? "text-white animate-pulse" : "text-gray-400"}>
                {step}...
              </span>
            </div>
          ))}
        </div>

        <div className="h-1 w-full bg-gray-800 rounded-full mt-8 overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-300 ease-out"
            style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
