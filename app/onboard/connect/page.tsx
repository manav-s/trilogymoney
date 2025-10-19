"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlaidLink } from "react-plaid-link";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function ConnectPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

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
          // Allow access if user just finished analysis and is moving forward from plan
          if (data.status !== 'analysis_complete' && data.next && data.next !== "/onboard/connect") {
            router.replace(data.next);
          }
        }
      } catch {}
      // request link token
      try {
        setIsFetchingToken(true);
        setTokenError(null);
        const lt = await fetch('/api/plaid/link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientUserId: phone, clientName: 'Trilogy' }),
        });
        if (!lt.ok) {
          const data = await lt.json().catch(() => ({}));
          setTokenError(data?.error || 'failed to create link token');
        } else {
          const data = await lt.json();
          if (data?.link_token) setLinkToken(data.link_token);
          else setTokenError('failed to create link token');
        }
      } catch {
        setTokenError('network error while creating link token');
      } finally {
        setIsFetchingToken(false);
      }
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

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">connect your accounts</h1>
        <div className="bg-gray-100 rounded-2xl p-6 text-gray-700 lowercase flex items-center justify-between">
          <span>link your bank accounts securely</span>
          {linkToken ? (
            <PlaidLink token={linkToken} onSuccess={onSuccess}>
              <button className="px-6 py-3 rounded-full bg-indigo-600 text-white">connect your accounts</button>
            </PlaidLink>
          ) : (
            <div className="flex items-center gap-3">
              <button disabled className="px-6 py-3 rounded-full bg-indigo-600 text-white opacity-50">{isFetchingToken ? 'loading…' : 'unavailable'}</button>
              {tokenError && (
                <button
                  onClick={() => {
                    // trigger a refetch by resetting state (effect runs only once; so call inline fetch)
                    (async () => {
                      const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
                      if (!phone) return;
                      try {
                        setIsFetchingToken(true);
                        setTokenError(null);
                        const lt = await fetch('/api/plaid/link-token', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ clientUserId: phone, clientName: 'Trilogy' }),
                        });
                        if (!lt.ok) {
                          const data = await lt.json().catch(() => ({}));
                          setTokenError(data?.error || 'failed to create link token');
                        } else {
                          const data = await lt.json();
                          if (data?.link_token) setLinkToken(data.link_token);
                          else setTokenError('failed to create link token');
                        }
                      } catch {
                        setTokenError('network error while creating link token');
                      } finally {
                        setIsFetchingToken(false);
                      }
                    })();
                  }}
                  className="px-4 py-2 rounded-full bg-gray-200 text-gray-800"
                >
                  try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
