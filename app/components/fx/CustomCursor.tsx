'use client';

import { useEffect, useRef } from 'react';

/**
 * Dot + trailing ring cursor for mouse users. The ring swells over anything clickable,
 * and elements marked `data-magnetic` get pulled toward the pointer.
 * Touch devices and reduced-motion users keep their normal cursor.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const root = document.documentElement;
    root.classList.add('custom-cursor');

    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    let hover = false;
    let down = false;
    let seen = false;
    let magnet: HTMLElement | null = null;
    let raf = 0;

    const releaseMagnet = () => {
      if (magnet) magnet.style.translate = '';
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!seen) {
        seen = true;
        rx = x;
        ry = y;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }
      const target = e.target instanceof Element ? e.target : null;
      hover = !!target?.closest('a,button,[role="tab"],[data-cursor]');

      const m = (target?.closest('[data-magnetic]') as HTMLElement | null) ?? null;
      if (m !== magnet) releaseMagnet();
      magnet = m;
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        magnet.style.translate = `${(x - (r.left + r.width / 2)) * 0.3}px ${(y - (r.top + r.height / 2)) * 0.4}px`;
      }
    };
    const onLeave = () => {
      seen = false;
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      releaseMagnet();
    };
    const onDown = () => (down = true);
    const onUp = () => (down = false);

    const tick = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${down ? 0.5 : 1})`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${(hover ? 1.9 : 1) * (down ? 0.8 : 1)})`;
      ring.dataset.hover = hover ? '1' : '0';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('mouseleave', onLeave);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      releaseMagnet();
      root.classList.remove('custom-cursor');
      window.removeEventListener('pointermove', onMove);
      root.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[95] h-9 w-9 rounded-full border-2 border-[#007AFF]/60 opacity-0 transition-[opacity,background-color,border-color] duration-200 data-[hover=1]:border-[#007AFF] data-[hover=1]:bg-[#007AFF]/10"
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[96] h-2 w-2 rounded-full bg-[#007AFF] opacity-0 transition-opacity duration-200"
      />
    </>
  );
}
