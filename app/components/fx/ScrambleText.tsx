'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from '../motion/hooks';

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz$#%&*@!?0123456789';

/** Text that "decodes" from random glyphs into the real words, left to right, when it scrolls into view. */
export default function ScrambleText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { threshold: 0.6, rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [state, setState] = useState<{ chars: string[]; revealed: number }>({ chars: text.split(''), revealed: text.length });

  useEffect(() => {
    if (!inView || reduced) return;
    const total = text.length;
    const frames = Math.max(28, total * 2.4);
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      const revealed = Math.min(total, Math.floor((frame / frames) * total));
      const chars = text
        .split('')
        .map((ch, i) => (i < revealed || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]));
      setState({ chars, revealed });
      if (revealed < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, text]);

  return (
    <span ref={ref} aria-label={text} className={className}>
      {state.chars.map((ch, i) => (
        <span key={i} aria-hidden className={i >= state.revealed && ch !== ' ' ? 'text-[#007AFF]/70' : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}
