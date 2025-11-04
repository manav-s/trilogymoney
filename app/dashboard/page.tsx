"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function DashboardPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

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
    if (!phone) return;
    const res = await fetch("/api/accounts/add-link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (data.link_token) setLinkToken(data.link_token);
  };

  const onLinkSuccess = async (public_token: string) => {
    if (!phone) return;
    await fetch("/api/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, public_token }),
    });
    location.reload();
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
    await fetch("/api/user/soft-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    alert("Your data has been marked for deletion and messaging paused.");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">dashboard</h1>

        <div className="mb-8 flex gap-3">
          {linkToken ? (
            <PlaidLink token={linkToken} onSuccess={onLinkSuccess}>
              <button className="px-5 py-3 rounded-full bg-indigo-600 text-white lowercase">add another account</button>
            </PlaidLink>
          ) : (
            <button onClick={createLinkToken} className="px-5 py-3 rounded-full bg-indigo-600 text-white lowercase">add account</button>
          )}

          <button onClick={openPortal} disabled={!customerId} className="px-5 py-3 rounded-full bg-gray-900 text-white lowercase disabled:opacity-50">manage subscription</button>
          <button onClick={softDelete} className="px-5 py-3 rounded-full bg-red-600 text-white lowercase">delete all data</button>
        </div>

        <div className="space-y-4">
          {items.flatMap((it) => it.accounts).length === 0 ? (
            <p className="text-gray-600 lowercase">no accounts linked yet</p>
          ) : (
            items.map((it) => (
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
      </div>
    </div>
  );
}


