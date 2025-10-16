"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OnboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "valid" | "invalid" | "expired">("verifying");
  const [, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (!token) {
      setStatus("invalid");
      return;
    }

    // Verify the magic link token
    fetch(`/api/onboard/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setStatus("valid");
          setPhone(data.phone);
          // Store phone in sessionStorage for the onboarding flow
          sessionStorage.setItem("onboarding_phone", data.phone);
          // Redirect to Clerk sign in/up first
          setTimeout(() => {
            router.push("/onboard/clerk-signin");
          }, 1500);
        } else if (data.expired) {
          setStatus("expired");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => {
        setStatus("invalid");
      });
  }, [searchParams, router]);

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
            <div className="text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-gray-900 lowercase">
              link verified!
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
              magic links expire after 10 minutes. text us again and we&apos;ll send you a fresh one!
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

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="text-6xl">🔐</div>
          <h1 className="text-3xl font-bold text-gray-900 lowercase">
            loading...
          </h1>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}

