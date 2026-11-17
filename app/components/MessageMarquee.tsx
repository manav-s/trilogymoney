'use client';

import { useEffect, useRef } from 'react';

const FROM_TRILOGY = [
  'you spent less on food this week 👀',
  'spotify, netflix, hulu… your subs add up 🎧',
  'payday hit 💸',
  'uber eats 3x this week. we see you 🍟',
  'quiet week. barely spent a thing 🧘',
  'target run got a little out of hand 🎯',
  'coffee is your #1 category again ☕',
];

const FROM_YOU = [
  'ok fine',
  'wait how much on uber??',
  'lol stop',
  'roast me',
  'ty 🙏',
  'how much did i spend on coffee',
  'be honest am i doing ok',
];

function Row({ items, mine, reverse }: { items: string[]; mine?: boolean; reverse?: boolean }) {
  const row = [...items, ...items];
  return (
    <div className="group [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]">
      <div
        className={`flex w-max animate-marquee group-hover:[animation-play-state:paused] ${
          reverse ? '[animation-direction:reverse] [animation-duration:55s]' : ''
        }`}
      >
        {row.map((t, i) => (
          <div
            key={i}
            aria-hidden={i >= items.length}
            className={`mr-3 shrink-0 rounded-3xl px-4 py-2.5 text-sm transition-all duration-300 hover:-translate-y-1 hover:scale-105 ${
              mine
                ? 'rounded-br-md bg-[#007AFF] text-white hover:shadow-lg hover:shadow-blue-300'
                : 'rounded-bl-md bg-gray-100 text-gray-800 hover:bg-[#007AFF] hover:text-white hover:shadow-lg hover:shadow-blue-200'
            }`}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two endless strips of texts (theirs and yours) running opposite ways; they skew with scroll speed. */
export default function MessageMarquee() {
  const skewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = skewRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = window.scrollY;
    let v = 0;
    let raf = 0;
    const loop = () => {
      const y = window.scrollY;
      const dv = y - last;
      last = y;
      v += (dv - v) * 0.12;
      const skew = Math.max(-14, Math.min(14, v * 0.4));
      el.style.transform = `skewX(${-skew}deg)`;
      if (Math.abs(v) > 0.05 || dv !== 0) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        el.style.transform = '';
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section aria-label="example texts" className="py-10 bg-white overflow-hidden border-b border-gray-100">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-400 mb-6">the kind of texts you&apos;d get</p>
      <div ref={skewRef} className="space-y-3 will-change-transform">
        <Row items={FROM_TRILOGY} />
        <Row items={FROM_YOU} mine reverse />
      </div>
    </section>
  );
}
