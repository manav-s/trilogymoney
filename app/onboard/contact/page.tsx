"use client";

import Image from "next/image";
import { useState } from "react";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="h-screen bg-gray-50 flex flex-col items-center justify-center px-6 pb-10 overflow-hidden">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add to Contacts</h1>
      
      <div className="flex gap-2 mb-8">
        <div className="w-12 h-1 bg-gray-900 rounded-full"></div>
        <div className="w-12 h-1 bg-gray-900 rounded-full"></div>
      </div>

      <div className="space-y-2 text-gray-500 text-base mb-8 w-full max-w-xs">
        <div className="flex gap-3">
          <span className="font-medium text-gray-400">1.</span>
          <p>Click the contact card below</p>
        </div>
        <div className="flex gap-3">
          <span className="font-medium text-gray-400">2.</span>
          <p>Scroll to the bottom</p>
        </div>
        <div className="flex gap-3">
          <span className="font-medium text-gray-400">3.</span>
          <p>Select <span className="text-blue-500 font-medium">Create New Contact</span></p>
        </div>
      </div>

      <a 
        href="/trilogy.vcf"
        className="bg-white rounded-[2rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] p-6 w-64 flex flex-col items-center transition-transform active:scale-95"
      >
        <div className="w-20 h-20 rounded-full mb-4 overflow-hidden shadow-lg">
           <Image 
             src="/trilogy-contact-icon.jpg" 
             alt="Trilogy" 
             width={80} 
             height={80} 
             className="w-full h-full object-cover"
           />
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          Trilogy 💸
        </h2>
        
        <p className="text-blue-500 font-medium mb-1 text-base">+1 (646) 894-1360</p>
        <p className="text-gray-400 text-xs">New York, NY</p>
      </a>

      <div className="fixed bottom-8 left-0 right-0 px-6">
        <button
          onClick={async () => {
            setLoading(true);
            try {
              const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
              const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
              });
              const data = await res.json();
              if (data.url) window.location.href = data.url as string;
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="w-full max-w-md mx-auto block bg-blue-600 text-white py-4 rounded-full font-medium text-lg shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60 hover:bg-blue-700"
        >
          {loading ? 'redirecting...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}


