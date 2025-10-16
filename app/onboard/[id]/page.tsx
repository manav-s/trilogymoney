"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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
          sessionStorage.setItem("onboarding_phone", data.phone);
          // Redirect straight to Step A
          setTimeout(() => {
            router.push("/onboard/step-a");
          }, 1000);
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
              authentication links expire after 10 minutes. text us again and we&apos;ll send you a fresh one!
            </p>
            <a
              href="https://shorturl.at/KGbiL"
              className="inline-flex items-center px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg"
            >
              text for new link 💬
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
              href="https://shorturl.at/KGbiL"
              className="inline-flex items-center px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg"
            >
              start over 💬
            </a>
          </>
        )}
      </div>
    </div>
  );
}

