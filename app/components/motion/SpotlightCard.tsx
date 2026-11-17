'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
import { useReducedMotion } from './hooks';

type Props = {
  children: ReactNode;
  className?: string;
  /** tilt the card toward the cursor */
  tilt?: boolean;
  /** color of the glow that follows the cursor */
  color?: string;
  /** radius of the glow in px */
  size?: number;
};

/** A container with a cursor-following glow and an optional subtle 3D tilt. */
export default function SpotlightCard({
  children,
  className = '',
  tilt = true,
  color = 'rgba(59,130,246,0.15)',
  size = 400,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty('--sx', `${x}px`);
    el.style.setProperty('--sy', `${y}px`);
    if (tilt && !reduced && e.pointerType === 'mouse') {
      const rx = (y / r.height - 0.5) * -8;
      const ry = (x / r.width - 0.5) * 8;
      el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    }
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`group relative overflow-hidden transition-[transform,box-shadow] duration-300 ease-out ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${size}px circle at var(--sx, 50%) var(--sy, 50%), ${color}, transparent 45%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
