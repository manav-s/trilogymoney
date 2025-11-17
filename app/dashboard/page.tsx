"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

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

export default function DashboardPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const signOut = () => {
    try { sessionStorage.removeItem(ONBOARDING_PHONE_KEY); } catch {}
    router.replace('/');
  };

  useEffect(() => {
    const p = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!p) {
      router.replace("/signin");
      return;
    }
    setPhone(p);
    (async () => {
      const res = await fetch(`/api/accounts/list?phone=${encodeURIComponent(p)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setCustomerId(data.user?.stripeCustomerId || null);
      }
    })();
  }, [router]);

  const createLinkToken = async () => {
    if (!phone || linking) return;
    setLinking(true);
    const res = await fetch("/api/accounts/add-link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (data.link_token) {
      setLinkToken(data.link_token);
    } else {
      setLinking(false);
      alert(data.error || "failed to create link token");
    }
  };

  const onLinkSuccess = async (public_token: string) => {
    if (!phone) return;
    await fetch("/api/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, public_token }),
    });
    setLinkToken(null);
    setLinking(false);
    location.reload();
  };

  const onLinkExit = () => {
    setLinkToken(null);
    setLinking(false);
  };

  const deleteAccount = async (accountId: string) => {
    await fetch("/api/accounts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    location.reload();
  };

  const openPortal = async () => {
    if (!customerId) return;
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url as string;
  };

  const softDelete = async () => {
    if (!phone) return;
    setDeleting(true);
    try {
      await fetch("/api/user/soft-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      alert("Your data has been marked for deletion and messaging paused.");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">dashboard</h1>

        <div className="mb-8 flex flex-wrap gap-3">
          <button
            onClick={createLinkToken}
            disabled={linking}
            className="px-5 py-3 rounded-full bg-indigo-600 text-white lowercase disabled:opacity-50"
          >
            {linking ? 'opening link…' : 'add account'}
          </button>
          {linkToken ? (
            <PlaidLinkLauncher token={linkToken} onSuccess={onLinkSuccess} onExit={onLinkExit} />
          ) : null}

          <button onClick={openPortal} disabled={!customerId} className="px-5 py-3 rounded-full bg-gray-900 text-white lowercase disabled:opacity-50">manage subscription</button>
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)} className="px-5 py-3 rounded-full bg-red-600 text-white lowercase">delete all data</button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={softDelete} disabled={deleting} className="px-5 py-3 rounded-full bg-red-700 text-white lowercase disabled:opacity-50">{deleting ? 'deleting…' : 'confirm delete'}</button>
              <button onClick={() => setConfirmingDelete(false)} className="px-5 py-3 rounded-full bg-gray-200 text-gray-800 lowercase">cancel</button>
            </div>
          )}

          <button
            onClick={signOut}
            className="px-5 py-3 rounded-full border border-gray-300 bg-white text-gray-800 lowercase hover:bg-gray-100"
          >
            sign out
          </button>
        </div>

        {(() => {
          const visibleItems = items.map((it) => ({
            ...it,
            accounts: it.accounts.filter(Boolean),
          })).filter((it) => it.accounts.length > 0);
          return (
        <div className="space-y-4">
          {visibleItems.flatMap((it) => it.accounts).length === 0 ? (
            <p className="text-gray-600 lowercase">no accounts linked yet</p>
          ) : (
            visibleItems.map((it) => (
              <div key={it.id} className="border rounded-2xl p-4">
                {it.institutionName ? (
                  <div className="font-semibold mb-2 lowercase">{it.institutionName}</div>
                ) : null}
                <div className="space-y-2">
                  {it.accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div className="text-sm lowercase">
                        <div className="font-medium">{a.name} {a.mask ? `•••${a.mask}` : ""}</div>
                        <div className="text-gray-600">{a.type}{a.subtype ? ` / ${a.subtype}` : ""} {a.currency ? ` • ${a.currency}` : ""}</div>
                      </div>
                      <button onClick={() => deleteAccount(a.id)} className="px-3 py-2 rounded-full bg-gray-200 text-gray-800 lowercase">remove</button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
          );
        })()}
      </div>
      </main>

      {/* Footer (same as homepage) */}
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
              <button onClick={signOut} className="hover:text-indigo-600 transition-colors">
                sign out
              </button>
            </div>
            <p className="text-sm text-gray-500 lowercase">© 2025 trilogy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (public_token: string) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}


