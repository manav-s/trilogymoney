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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <main className="flex-1">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Main container card */}
        <div className="border border-white/10 bg-white/[0.02] rounded-2xl p-8 backdrop-blur-sm">
          {/* Header with title and action buttons */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-10 gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 lowercase tracking-tight">trilogy dashboard</h1>
              <p className="text-gray-400 text-sm lowercase">one place for your money pulse, updated automatically every week.</p>
            </div>
            
            <div className="flex flex-wrap gap-3 md:flex-shrink-0">
              <button
                onClick={createLinkToken}
                disabled={linking}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white lowercase font-medium disabled:opacity-50 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/30"
              >
                {linking ? 'opening link…' : 'add account'}
              </button>
              {linkToken ? (
                <PlaidLinkLauncher token={linkToken} onSuccess={onLinkSuccess} onExit={onLinkExit} />
              ) : null}

              <button onClick={openPortal} disabled={!customerId} className="px-6 py-3 rounded-lg bg-white/5 text-white lowercase font-medium disabled:opacity-50 hover:bg-white/10 transition-colors border border-white/10">manage subscription</button>
            </div>
          </div>

          {/* Connected accounts section */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-6 lowercase">connected accounts</h2>
            {(() => {
              const visibleItems = items.map((it) => ({
                ...it,
                accounts: it.accounts.filter(Boolean),
              })).filter((it) => it.accounts.length > 0);
              return (
            <div className="space-y-4">
              {visibleItems.flatMap((it) => it.accounts).length === 0 ? (
                <p className="text-gray-500 lowercase text-center py-12">no accounts linked yet</p>
              ) : (
                visibleItems.map((it) => (
                  <div key={it.id} className="border border-white/5 bg-white/[0.02] rounded-xl p-6 hover:bg-white/[0.03] transition-colors">
                    {it.institutionName ? (
                      <div className="font-semibold mb-4 lowercase text-white text-base">{it.institutionName}</div>
                    ) : null}
                    <div className="space-y-3">
                      {it.accounts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                          <div className="text-sm lowercase flex-1">
                            <div className="font-medium text-white mb-1">{a.name} {a.mask ? `•••${a.mask}` : ""}</div>
                            <div className="text-gray-500">{a.type}{a.subtype ? ` / ${a.subtype}` : ""} {a.currency ? ` • ${a.currency}` : ""}</div>
                          </div>
                          <button onClick={() => deleteAccount(a.id)} className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 lowercase font-medium hover:bg-white/10 hover:text-white transition-all border border-white/5 ml-4">remove</button>
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
        </div>
      </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <span className="text-xl font-bold text-white lowercase tracking-tight">
              trilogy
            </span>
            <div className="flex items-center space-x-8 text-sm text-gray-400 lowercase">
              <a href="/privacy" className="hover:text-white transition-colors">
                privacy
              </a>
              <button onClick={signOut} className="hover:text-white transition-colors">
                sign out
              </button>
              {!confirmingDelete ? (
                <button onClick={() => setConfirmingDelete(true)} className="hover:text-red-500 transition-colors">
                  delete all data
                </button>
              ) : (
                <div className="flex items-center space-x-3">
                  <button onClick={softDelete} disabled={deleting} className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50">
                    {deleting ? 'deleting…' : 'confirm delete'}
                  </button>
                  <button onClick={() => setConfirmingDelete(false)} className="hover:text-white transition-colors">
                    cancel
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 lowercase">© 2025 trilogy</p>
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


