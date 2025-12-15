'use client';

import { useState, useEffect } from 'react';

const suffixes = [
  'tracking their spending',
  'saving more money',
  'cutting subscriptions',
  'budgeting smarter',
];

export default function SocialProofBadge() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % suffixes.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 border border-gray-200">
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
        <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
        <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
      </div>
      
      <span className="text-sm text-gray-700">
        <span className="font-semibold">10,000+</span> people{' '}
        <span
          className={`inline-block transition-all duration-300 ${
            isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
        >
          {suffixes[currentIndex]}
        </span>
      </span>
    </div>
  );
}
