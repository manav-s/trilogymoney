"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function QuizPage() {
  const router = useRouter();

  useEffect(() => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) {
      router.replace("/");
      return;
    }
    // Check status and redirect if needed
    (async () => {
      try {
        const res = await fetch(`/api/onboard/status?phone=${encodeURIComponent(phone)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.next && data.next !== "/onboard/quiz") {
            router.replace(data.next);
          }
        }
      } catch {
        // ignore and let user proceed
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">a few quick questions</h1>
        <p className="text-gray-600 mb-8 lowercase">this will take about 90 seconds</p>
        <div className="bg-gray-100 rounded-2xl p-6 text-gray-700 lowercase">
          quiz skeleton goes here. 11 micro-questions, one per screen.
        </div>
        <div className="mt-10 flex justify-end">
          <button
            onClick={() => router.push("/onboard/analyzing")}
            className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700"
          >
            continue →
          </button>
        </div>
      </div>
    </div>
  );
}
