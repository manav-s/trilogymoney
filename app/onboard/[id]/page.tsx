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
          <div className="space-y-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-gray-900 lowercase">
                link expired
              </h1>
              <p className="text-lg text-gray-600 lowercase">
                for security, links expire after 10 minutes.
              </p>
            </div>
            <div className="space-y-4 pt-4">
              <a
                href="/signin"
                className="block w-full px-8 py-4 text-lg font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/20 transition-all lowercase shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5"
              >
                sign in for a new link
              </a>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-sm text-gray-400 lowercase">or</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
              <a
                href="https://shorturl.at/KGbiL"
                className="block w-full px-8 py-4 text-lg font-semibold rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all lowercase border border-gray-200"
              >
                continue onboarding
              </a>
              <p className="text-sm text-gray-500 lowercase">
                opens imessage to restart setup
              </p>
            </div>
          </div>
        )}

        {status === "invalid" && (
          <div className="space-y-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-gray-900 lowercase">
                invalid link
              </h1>
              <p className="text-lg text-gray-600 lowercase">
                this link isn&apos;t valid. it may have already been used or was corrupted.
              </p>
            </div>
            <div className="space-y-4 pt-4">
              <a
                href="/signin"
                className="block w-full px-8 py-4 text-lg font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/20 transition-all lowercase shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5"
              >
                sign in for a new link
              </a>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-sm text-gray-400 lowercase">or</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
              <a
                href="https://shorturl.at/KGbiL"
                className="block w-full px-8 py-4 text-lg font-semibold rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all lowercase border border-gray-200"
              >
                continue onboarding
              </a>
              <p className="text-sm text-gray-500 lowercase">
                opens imessage to restart setup
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


