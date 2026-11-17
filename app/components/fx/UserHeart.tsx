'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useInView } from '../motion/hooks';
import { confettiBurst } from './confetti';

/** Deterministic pseudo-random in [0,1) so server and client render the same scatter. */
const rand = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** n points evenly filling the classic heart curve (x²+y²−1)³ − x²y³ ≤ 0. */
function heartPoints(n: number) {
  let pts: [number, number][] = [];
  for (let step = 0.14; step > 0.01; step *= 0.95) {
    pts = [];
    for (let y = 1.3; y >= -1.2; y -= step) {
      for (let x = -1.3; x <= 1.3; x += step) {
        const a = x * x + y * y - 1;
        if (a * a * a - x * x * y * y * y <= 0) pts.push([x, y]);
      }
    }
    if (pts.length >= n) break;
  }
  return Array.from({ length: n }, (_, i) => pts[Math.floor((i * pts.length) / n)]);
}

type Dot = { left: number; top: number; hue: number; sx: number; sy: number };

function buildDots(count: number): Dot[] {
  return heartPoints(count).map(([x, y], i) => ({
    left: ((x + 1.3) / 2.6) * 100,
    top: ((1.3 - y) / 2.5) * 100,
    hue: 210 + ((x + 1.3) / 2.6) * 85,
    sx: rand(i, 1) * 160 - 30,
    sy: rand(i, 2) * 160 - 30,
  }));
}

/** One dot per user. They fly in to form a beating heart; clicking blows it apart with confetti. */
export default function UserHeart({ count }: { count: number }) {
  const [dots] = useState(() => buildDots(count));
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref, { threshold: 0.35 });
  const [blast, setBlast] = useState<{ x: number; y: number }[] | null>(null);
  const [beating, setBeating] = useState(false);

  // start the heartbeat once the dots have landed
  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => setBeating(true), 2200);
    return () => clearTimeout(t);
  }, [inView]);

  const explode = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    confettiBurst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2, {
      count: 120,
      emojis: ['💙', '💜', '🫶', '✨'],
    });
    setBlast(dots.map(() => ({ x: Math.random() * 260 - 80, y: Math.random() * 260 - 80 })));
    window.setTimeout(() => setBlast(null), 700);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={explode}
      data-cursor
      aria-label={`a heart made of ${count} dots, one for each trilogy user. click to make it burst`}
      className={`relative mx-auto block h-[230px] w-[250px] sm:h-[290px] sm:w-[320px] outline-none ${
        beating && !blast ? 'animate-heartbeat' : ''
      }`}
    >
      {dots.map((d, i) => {
        const pos = blast ? blast[i] : inView ? { x: d.left, y: d.top } : { x: d.sx, y: d.sy };
        return (
          <span
            key={i}
            title={`user #${i + 1}`}
            className="absolute h-2 w-2 sm:h-2.5 sm:w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top,opacity,scale] hover:scale-[2.5]"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              opacity: inView ? 1 : 0,
              background: `hsl(${d.hue} 90% 58%)`,
              boxShadow: `0 0 10px hsl(${d.hue} 90% 60% / 0.6)`,
              transitionDuration: blast ? '500ms' : '1300ms',
              transitionTimingFunction: blast ? 'cubic-bezier(.2,.8,.3,1)' : 'cubic-bezier(.2,1.25,.35,1)',
              transitionDelay: blast ? '0ms' : `${(i % 43) * 14 + Math.floor(i / 43) * 60}ms`,
            }}
          />
        );
      })}
    </button>
  );
}
