"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function MembershipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) {
      router.replace("/");
      return;
    }
    // Optional: Check status if needed, but for now just ensure phone exists
  }, [router]);

  const handleContinue = () => {
    setLoading(true);
    router.push("/onboard/contact");
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
      
      <div className="max-w-2xl mx-auto px-4 py-16 relative z-10">
        {/* Hero Stat Card */}
        <div className="mb-12 transform hover:scale-[1.02] transition-transform duration-500">
          <div className="bg-white/60 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-xl text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-4">average savings</p>
              <h2 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
                $137<span className="text-2xl text-gray-400 font-normal ml-1">/mo</span>
              </h2>
              <p className="text-gray-600 text-lg lowercase">
                the average trilogy user spends $137 less every month
              </p>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 lowercase">
            membership pays for itself
          </h1>
          <p className="text-xl text-gray-600 lowercase">
            financial clarity for less than a coffee a week
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-4 mb-12">
          {[
            { icon: "📱", title: "daily texts", desc: "keep you on track without opening an app" },
            { icon: "📊", title: "weekly reports", desc: "see exactly where your money went" },
            { icon: "🔒", title: "bank-level security", desc: "your data is encrypted and never sold" },
            { icon: "🧠", title: "smart insights", desc: "catch subscriptions and hidden fees" }
          ].map((feature, i) => (
            <div 
              key={i}
              className="flex items-center p-4 bg-white/40 border border-white/40 rounded-2xl backdrop-blur-sm hover:bg-white/60 transition-colors duration-300"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-white rounded-full shadow-sm text-2xl mr-4">
                {feature.icon}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 lowercase">{feature.title}</h3>
                <p className="text-gray-500 text-sm lowercase">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full px-10 py-5 text-xl font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/20 transition-all duration-300 lowercase shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "loading..." : "continue →"}
          </button>
          <p className="text-center text-gray-400 text-sm mt-4 lowercase">
            try risk-free • cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
