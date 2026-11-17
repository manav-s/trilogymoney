'use client';

import { useEffect, useState } from 'react';
import SocialProofBadge from './SocialProofBadge';

const LOGO = 'trilogy'.split('');

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div
        className={`flex items-center justify-between px-6 lg:px-8 max-w-7xl mx-auto transition-all duration-500 ${
          scrolled ? 'py-3' : 'py-6'
        }`}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="trilogy, back to top"
          className="group text-xl font-bold text-gray-900 lowercase tracking-tight"
        >
          {LOGO.map((ch, i) => (
            <span
              key={i}
              aria-hidden
              className="inline-block group-hover:animate-letter-hop group-hover:text-[#007AFF] transition-colors"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {ch}
            </span>
          ))}
        </button>

        <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
          <SocialProofBadge />
        </div>

        <a
          href="/pricing"
          className="relative text-sm font-medium text-gray-600 lowercase hover:text-blue-600 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-blue-600 after:transition-transform after:duration-300 hover:after:scale-x-100"
        >
          pricing
        </a>
      </div>
    </nav>
  );
}
