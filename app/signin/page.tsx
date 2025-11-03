"use client";

import { useState } from "react";

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
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">sign in</h1>
        <p className="text-gray-600 lowercase mb-8">we’ll text you a magic link to sign in</p>
        <div className="flex items-center gap-4">
          <button onClick={openSms} className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700">
            send me a link
          </button>
          {openedOnce ? (
            <button onClick={openSms} className="px-8 py-4 rounded-full bg-gray-200 text-gray-800 lowercase hover:bg-gray-300">
              open messages again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


