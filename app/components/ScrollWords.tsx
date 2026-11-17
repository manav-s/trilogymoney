'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './motion/hooks';

/** Paragraph whose words brighten one by one as it scrolls up through the viewport. */
export default function ScrollWords({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const start = vh * 0.9;
      const end = vh * 0.45;
      setProgress(Math.max(0, Math.min(1, (start - top) / (start - end))));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const words = text.split(' ');

  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => {
        const t = Math.max(0, Math.min(1, progress * words.length - i));
        return (
          <span key={i} aria-hidden className="transition-opacity duration-200" style={{ opacity: 0.15 + 0.85 * t }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}
