"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

type AnalysisSummary = {
  score: number;
  riskBand: 'low' | 'medium' | 'high';
  headline: string;
  bullets: string[];
  primaryGoal: string | null;
  flags: string[];
};

const GOAL_LABELS: Record<string, string> = {
  pay_down_card: 'paying down debt',
  build_1mo_cushion: 'building an emergency fund',
  stop_leak_spend: 'cutting overspending',
  automate_bills: 'automating your bills',
  start_investing: 'starting to invest',
};

const BULLET_ICONS: Record<string, string> = {
  'trim food delivery': '🍕',
  'automate minimum debt': '💳',
  'building a 1-month cushion': '🛡️',
  'start building': '🛡️',
  'weekly check-in': '📊',
  default: '✨',
};

function getIconForBullet(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, icon] of Object.entries(BULLET_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return BULLET_ICONS.default;
}

export default function PlanPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openRequested, setOpenRequested] = useState(false);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

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
            return;
          }
          if (data.analysisSummary) {
            setSummary(data.analysisSummary);
          }
          if (data.name) {
            setUserName(data.name.split(' ')[0]); // first name only
          }
        }
      } catch {}
    })();
  }, [router]);

  // Fallback bullets if no summary
  const bullets = summary?.bullets?.length
    ? summary.bullets.map((text) => ({ icon: getIconForBullet(text), text }))
    : [
        { icon: "⚡️", text: "automate minimum payments this week" },
        { icon: "🛡️", text: "build a 1‑month cushion with a monthly transfer" },
        { icon: "📊", text: "weekly check‑in keeps you consistent" },
      ];

  const headline = summary?.headline || "your weekly money plan";
  const goalLabel = summary?.primaryGoal ? GOAL_LABELS[summary.primaryGoal] : null;
  const scoreColor = summary?.riskBand === 'low' ? 'text-green-600' : summary?.riskBand === 'medium' ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Personalized greeting */}
        {userName && (
          <p className="text-lg text-gray-500 mb-2 lowercase">hey {userName} 👋</p>
        )}
        
        <h1 className="text-4xl font-bold text-gray-900 mb-3 lowercase">{headline}</h1>
        
        {/* Score badge */}
        {summary?.score !== undefined && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full mb-6">
            <span className="text-sm text-gray-500 lowercase">financial health score:</span>
            <span className={`text-lg font-bold ${scoreColor}`}>{summary.score}</span>
          </div>
        )}

        {/* Primary goal callout */}
        {goalLabel && (
          <p className="text-gray-600 mb-8 lowercase">
            based on your answers, we&apos;ll focus on <span className="font-semibold text-gray-900">{goalLabel}</span>
          </p>
        )}

        <div className="space-y-4">
          {bullets.map((item, i) => (
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
            className="px-8 py-4 rounded-full bg-blue-600 text-white lowercase hover:bg-blue-700 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            disabled={opening}
          >
            {opening ? 'preparing…' : 'connect your accounts'}
          </button>
        </div>
      </div>
    </div>
  );
}
