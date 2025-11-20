"use client";

import Image from "next/image";

const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-10 px-6 pb-10">
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
        <div className="w-20 h-20 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 mb-4 flex items-center justify-center shadow-inner overflow-hidden">
           <Image 
             src="/favicon.ico" 
             alt="Trilogy" 
             width={48} 
             height={48} 
             className="w-12 h-12 object-contain opacity-80"
           />
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          Trilogy ✨
        </h2>
        
        <p className="text-blue-500 font-medium mb-1 text-base">+1 (646) 894-1360</p>
        <p className="text-gray-400 text-xs">New York, NY</p>
      </a>

      <div className="fixed bottom-8 left-0 right-0 px-6">
        <button
          onClick={async () => {
            const phone = typeof window !== 'undefined' ? sessionStorage.getItem(ONBOARDING_PHONE_KEY) : null;
            if (phone) {
              await fetch('/api/onboard/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
              }).catch(() => {});
            }
            window.location.href = '/dashboard';
          }}
          className="w-full max-w-md mx-auto block bg-gray-900 text-white py-4 rounded-full font-medium text-lg shadow-lg active:scale-[0.98] transition-transform"
        >
          Continue
        </button>
      </div>
    </div>
  );
}


