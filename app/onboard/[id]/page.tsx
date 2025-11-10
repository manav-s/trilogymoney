"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function OnboardWithIdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [status, setStatus] = useState<"verifying" | "valid" | "invalid" | "expired">("verifying");

  useEffect(() => {
    if (!id) {
      setStatus("invalid");
      return;
    }

    // Verify the magic link token
    fetch(`/api/onboard/verify/${id}`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setStatus("valid");
          // Store phone in sessionStorage for the onboarding flow
          sessionStorage.setItem(ONBOARDING_PHONE_KEY, data.phone);
          // Route to the appropriate next step based on current status
          fetch(`/api/onboard/status?phone=${encodeURIComponent(data.phone)}`)
            .then((r) => r.json())
            .then((s) => {
              const nextPath = s?.next || "/onboard/step-a";
              router.replace(nextPath);
            })
            .catch(() => {
              router.replace("/onboard/step-a");
            });
        } else if (data.expired) {
          setStatus("expired");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("invalid"));
  }, [id, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {status === "verifying" && (
          <>
            <div className="text-6xl">🔐</div>
            <h1 className="text-3xl font-bold text-gray-900 lowercase">
              verifying your link...
            </h1>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </>
        )}

        {status === "valid" && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 lowercase">
              link verified
            </h1>
            <p className="text-xl text-gray-600 lowercase">
              setting up your account...
            </p>
          </>
        )}

        {status === "expired" && (
          <>
            <div className="text-6xl">⏰</div>
            <h1 className="text-3xl font-bold text-gray-900 lowercase">
              link expired
            </h1>
            <p className="text-xl text-gray-600 lowercase">
              authentication links expire after 10 minutes. head to sign in to get a fresh link.
            </p>
            <a
              href="/signin"
              className="inline-flex items-center px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg"
            >
              go to sign in
            </a>
          </>
        )}

        {status === "invalid" && (
          <>
            <div className="text-6xl">❌</div>
            <h1 className="text-3xl font-bold text-gray-900 lowercase">
              invalid link
            </h1>
            <p className="text-xl text-gray-600 lowercase">
              this link isn&apos;t valid. maybe you already used it, or it got corrupted?
            </p>
            <a
              href="/signin"
              className="inline-flex items-center px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg"
            >
              go to sign in
            </a>
            <p className="text-sm text-gray-500 lowercase">
              starting fresh?{" "}
              <a
                href="https://shorturl.at/KGbiL"
                className="text-indigo-600 hover:text-indigo-700 underline"
              >
                text us for a new link
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}


