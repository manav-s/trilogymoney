'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from './hooks';

type Props = {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
};

/** Counts from 0 to `to` with an ease-out curve the first time it becomes visible. */
export default function CountUp({ to, prefix = '', suffix = '', duration = 1400, delay = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { threshold: 0.5, rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [inView, reduced, to, duration, delay]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}
