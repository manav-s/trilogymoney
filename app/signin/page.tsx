"use client";

import { useState } from "react";
import Link from "next/link";

const SMS_LINK = "https://shorturl.at/wqcwo"; // opens Messages to +16468941360 with body "pass the sign in link"

export default function SignInPage() {
  const [openedOnce, setOpenedOnce] = useState(false);
  const openSms = () => {
    setOpenedOnce(true);
    try {
      window.location.href = SMS_LINK;
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white lowercase tracking-tight mb-2">trilogy</h1>
        </div>

        {/* Main card */}
        <div className="border border-white/10 bg-white/[0.02] rounded-2xl p-8 backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-white mb-3 lowercase">sign in</h2>
          <p className="text-gray-400 mb-8 lowercase">we&apos;ll text you a magic link to sign in</p>

          {/* Reassurance bullets */}
          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-400 lowercase">no passwords</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-400 lowercase">read-only bank access</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-400 lowercase">cancel anytime · blue bubbles</p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button 
              onClick={openSms} 
              className="w-full px-8 py-4 rounded-lg bg-indigo-600 text-white lowercase font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/30"
            >
              open imessage to get your link
            </button>
            {openedOnce ? (
              <button 
                onClick={openSms} 
                className="w-full px-8 py-4 rounded-lg bg-white/5 text-gray-400 lowercase font-medium hover:bg-white/10 hover:text-white transition-all border border-white/10"
              >
                open messages again
              </button>
            ) : null}
          </div>
        </div>

        {/* Footer link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-400 transition-colors lowercase">
            ← back to home
          </Link>
        </div>
      </div>
    </div>
  );
}


