"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function PlanPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openRequested, setOpenRequested] = useState(false);

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

  // Open Plaid as soon as the link is ready and the user requested it
  useEffect(() => {
    if (openRequested && ready) {
      try { open(); } finally { setOpenRequested(false); }
    }
  }, [openRequested, ready, open]);

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
        <div className="space-y-4">
          {[
            { icon: "⚡️", text: "automate minimum payments this week" },
            { icon: "🛡️", text: "build a 1‑month cushion with a monthly transfer" },
            { icon: "📊", text: "weekly check‑in keeps you consistent" }
          ].map((item, i) => (
            <div 
              key={i}
              className="flex items-center p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-indigo-100"
              style={{ 
                animation: `fadeInUp 0.6s ease-out forwards`,
                animationDelay: `${i * 150}ms`,
                opacity: 0,
                transform: 'translateY(10px)'
              }}
            >
              <span className="text-2xl mr-4 bg-indigo-50 w-12 h-12 flex items-center justify-center rounded-full">{item.icon}</span>
              <span className="text-lg text-gray-700 lowercase font-medium">{item.text}</span>
            </div>
          ))}
        </div>
        <style jsx global>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div className="mt-10 flex">
          <button
            onClick={async () => {
              const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
              if (!phone || opening) return;
              setOpening(true);
              setOpenRequested(true);
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
            className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white lowercase hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            disabled={opening}
          >
            {opening ? 'preparing…' : 'connect your accounts'}
          </button>
        </div>
      </div>
    </div>
  );
}
