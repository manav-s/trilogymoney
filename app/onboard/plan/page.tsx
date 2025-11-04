"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function PlanPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken || "",
    onSuccess: async (public_token: string) => {
      const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
      if (!phone) return;
      await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, public_token }),
      }).catch(() => {});
      router.replace('/onboard/connect');
    },
  });

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
            onClick={async () => {
              const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
              if (!phone || opening) return;
              setOpening(true);
              try {
                const res = await fetch('/api/accounts/add-link-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone }),
                });
                const data = await res.json();
                if (data?.link_token) setLinkToken(data.link_token);
              } finally {
                // allow subsequent taps if something fails; Plaid open will run via effect when ready
                setOpening(false);
              }
            }}
            className="px-6 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700 disabled:opacity-50"
            disabled={opening}
          >
            {opening ? 'preparing…' : 'connect your accounts'}
          </button>
        </div>
      </div>
    </div>
  );
}
