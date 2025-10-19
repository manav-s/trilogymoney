"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function ConnectPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);

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
      // request link token
      try {
        const lt = await fetch('/api/plaid/link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientUserId: phone, clientName: 'Trilogy' }),
        }).then((r) => r.json());
        if (lt?.link_token) setLinkToken(lt.link_token);
      } catch {}
    })();
  }, [router]);

  const onSuccess = async (public_token: string) => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) return;
    const res = await fetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, public_token }),
    });
    if (res.ok) router.push('/onboard/checkout');
  };

  const plaid = usePlaidLink({ token: linkToken || '', onSuccess });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">connect your accounts</h1>
        <div className="bg-gray-100 rounded-2xl p-6 text-gray-700 lowercase flex items-center justify-between">
          <span>link your bank accounts securely</span>
          <button disabled={!plaid.open || !linkToken} onClick={() => plaid.open?.()} className="px-6 py-3 rounded-full bg-indigo-600 text-white disabled:opacity-50">open plaid link</button>
        </div>
      </div>
    </div>
  );
}
