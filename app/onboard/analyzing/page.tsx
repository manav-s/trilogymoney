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
    <div className="min-h-screen bg-gray-50 relative overflow-hidden flex items-center justify-center">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
      
      <div className="max-w-md mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 lowercase">analyzing your answers</h1>
          <p className="text-gray-600 lowercase">crafting your personalized plan...</p>
        </div>

        {/* Progress Cards */}
        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const isActive = idx === i;
            const isComplete = idx > i;
            const delay = i * 200; // stagger animation

            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6 transition-all duration-500"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${delay}ms both`,
                }}
              >
                {/* Progress Fill */}
                <div
                  className={`absolute inset-0 bg-blue-500/10 transition-all duration-1000 ${
                    isActive || isComplete ? 'translate-x-0' : '-translate-x-full'
                  }`}
                  style={{
                    transitionDelay: `${delay}ms`,
                  }}
                ></div>

                {/* Content */}
                <div className="relative flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isComplete
                        ? 'bg-blue-600 scale-100'
                        : isActive
                        ? 'bg-blue-100 scale-110 animate-pulse'
                        : 'bg-gray-100 scale-100'
                    }`}
                  >
                    {isComplete ? (
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <p
                      className={`text-lg font-medium lowercase transition-colors duration-500 ${
                        isComplete ? 'text-blue-700' : isActive ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
