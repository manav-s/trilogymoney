'use client';

import { useRef, type ReactNode } from 'react';
import { useInView } from './hooks';

type Props = {
  children: ReactNode;
  /** ms before this element animates in once visible */
  delay?: number;
  from?: 'up' | 'down' | 'left' | 'right' | 'scale';
  className?: string;
};

/** Fades + slides its children in when scrolled into view. Styles live in globals.css ([data-reveal]). */
export default function Reveal({ children, delay = 0, from = 'up', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);

  return (
    <div
      ref={ref}
      data-reveal={from}
      data-shown={inView ? 'true' : 'false'}
      style={{ transitionDelay: `${delay}ms` }}
      className={className}
    >
      {children}
    </div>
  );
}
