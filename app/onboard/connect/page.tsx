"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlaidLink } from "react-plaid-link";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

type Account = {
  id: string;
  accountId: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  currency?: string | null;
  currentBalance?: number | null;
  availableBalance?: number | null;
};

type Item = {
  id: string;
  institutionName?: string | null;
  accounts: Account[];
};

export default function ConnectPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingExchange, setLoadingExchange] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  const fetchAccounts = async (phone: string) => {
    const res = await fetch(`/api/accounts/list?phone=${encodeURIComponent(phone)}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
  };

  const createLinkToken = async (phone: string) => {
    try {
      setIsFetchingToken(true);
      setTokenError(null);
      const lt = await fetch('/api/accounts/add-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
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
  };

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
          // Stay on connect for 'analysis_complete' (coming from plan) and 'plaid_connected' (after first link)
          const canStay = data.status === 'analysis_complete' || data.status === 'plaid_connected';
          if (data.next && data.next !== "/onboard/connect" && !canStay) {
            router.replace(data.next);
            return;
          }
        }
      } catch {}
      await fetchAccounts(phone);
      await createLinkToken(phone);
    })();
  }, [router]);

  const onSuccess = async (public_token: string) => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) return;
    setLoadingExchange(true);
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, public_token }),
      });
      if (res.ok) {
        await fetchAccounts(phone);
        // immediately prepare a fresh link token so the user can add another account
        await createLinkToken(phone);
      }
    } finally {
      setLoadingExchange(false);
    }
  };

  const totalAccounts = items.flatMap((it) => it.accounts).length;

  const goToCheckout = async () => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) return;
    setCreatingCheckout(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url as string;
    } finally {
      setCreatingCheckout(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation (copied from homepage) */}
      <nav className="flex items-center justify-between p-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center">
          <span className="text-xl font-bold text-gray-900 lowercase">
            trilogy
          </span>
        </div>
        <div className="flex items-center">
          <a href="/signin" className="text-sm font-semibold leading-6 text-gray-900 lowercase hover:text-indigo-600">
            sign in
          </a>
        </div>
      </nav>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 lowercase">connect your accounts</h1>
        <p className="text-gray-600 lowercase mb-6">add your bank accounts and credit cards</p>

        {/* add account CTA moved below list; header container removed intentionally */}

        {/* Linked accounts list */}
        <div className="mt-8 space-y-4">
          {totalAccounts === 0 ? (
            <p className="text-gray-600 lowercase">no accounts linked yet</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-all duration-200">
                {it.institutionName ? (
                  <div className="font-semibold mb-2 lowercase text-gray-900">{it.institutionName}</div>
                ) : null}
                <div className="space-y-2">
                  {it.accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-gradient-to-br from-gray-50 to-indigo-50/30 rounded-xl p-3">
                      <div className="text-sm lowercase">
                        <div className="font-medium">{a.name} {a.mask ? `•••${a.mask}` : ''}</div>
                        <div className="text-gray-600">{a.type}{a.subtype ? ` / ${a.subtype}` : ''} {a.currency ? ` • ${a.currency}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-center">
          {linkToken ? (
            <PlaidLink
              token={linkToken}
              onSuccess={onSuccess}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white focus:outline-none focus:ring-0 outline-none ring-0 border-0 shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 hover:-translate-y-0.5 inline-block cursor-pointer"
            >
              add account
            </PlaidLink>
          ) : (
            <button disabled className="px-6 py-3 rounded-full bg-indigo-600 text-white opacity-50 focus:outline-none focus:ring-0 outline-none ring-0 border-none shadow-none">{isFetchingToken ? 'loading…' : 'add account'}</button>
          )}
          {tokenError && (
            <button
              onClick={() => {
                const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
                if (phone) createLinkToken(phone);
              }}
              className="ml-3 px-4 py-2 rounded-full bg-gray-200 text-gray-800"
            >
              try again
            </button>
          )}
        </div>

        <div className="mt-10">
          <button
            onClick={goToCheckout}
            disabled={totalAccounts === 0 || creatingCheckout || loadingExchange}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-gray-900 to-gray-800 text-white lowercase disabled:opacity-50 hover:from-gray-800 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            {creatingCheckout ? 'redirecting…' : 'next'}
          </button>
        </div>
      </div>

      {/* Footer (copied from homepage) */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <span className="text-xl font-bold text-gray-900 lowercase">
              trilogy
            </span>
            <div className="flex items-center space-x-6 text-sm text-gray-600 lowercase">
              <a href="/privacy" className="hover:text-indigo-600 transition-colors">
                privacy
              </a>
              <a href="/signin" className="hover:text-indigo-600 transition-colors">
                sign in
              </a>
            </div>
            <p className="text-sm text-gray-500 lowercase">© 2025 trilogy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
