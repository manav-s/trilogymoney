'use client';

import { useEffect, useState } from 'react';

const WORD = 'trilogy'.split('');

/**
 * Full-screen intro: letters slam up into place, a progress line draws, then the curtain
 * swoops away. Plays once per browser session. A tiny inline script in layout.tsx adds
 * `intro-seen` to <html> before paint on repeat visits / reduced motion, which hides it via CSS.
 */
export default function IntroCurtain() {
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');

  useEffect(() => {
    if (document.documentElement.classList.contains('intro-seen')) {
      setPhase('gone');
      return;
    }
    document.body.style.overflow = 'hidden';
    const leave = window.setTimeout(() => setPhase('leave'), 1400);
    const gone = window.setTimeout(() => {
      setPhase('gone');
      document.body.style.overflow = '';
      try {
        sessionStorage.setItem('trilogy-intro', '1');
      } catch {
        /* storage blocked: the intro just plays again next time */
      }
    }, 2300);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
      document.body.style.overflow = '';
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden
      className={`intro-curtain fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-950 transition-[translate,border-radius] duration-[900ms] ease-[cubic-bezier(.76,0,.24,1)] ${
        phase === 'leave' ? '-translate-y-full rounded-b-[50%]' : ''
      }`}
    >
      <div className="flex text-7xl sm:text-9xl font-bold tracking-tight text-white lowercase">
        {WORD.map((ch, i) => (
          <span key={i} className="inline-block overflow-hidden pb-2">
            <span className="inline-block animate-intro-letter" style={{ animationDelay: `${i * 70}ms` }}>
              {ch}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-6 h-[3px] w-48 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full origin-left bg-gradient-to-r from-[#5AC8FA] via-[#007AFF] to-[#AF52DE] animate-grow-x"
          style={{ animationDuration: '1.1s', animationDelay: '200ms' }}
        />
      </div>
      <p className="mt-5 text-sm text-white/50 lowercase animate-word-in" style={{ animationDelay: '600ms' }}>
        a thank-you to 129 people
      </p>
    </div>
  );
}
