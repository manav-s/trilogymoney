'use client';

import { useEffect, useRef } from 'react';
import { emojiRain } from './confetti';

const MONEY = ['💸', '💵', '💰', '🪙', '💳'];

/** Type "money" anywhere for a cash storm; "129" rains hearts. */
export default function EasterEgg() {
  useEffect(() => {
    let buffer = '';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-8);
      if (buffer.endsWith('money')) {
        emojiRain(MONEY);
        buffer = '';
      } else if (buffer.endsWith('129')) {
        emojiRain(['💙', '💜', '🩵', '🫶']);
        buffer = '';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}

/** Footer wordmark: tap it 5 times quickly (the phone-friendly way in to the easter egg). */
export function SecretLogo() {
  const taps = useRef<number[]>([]);
  const onClick = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 1500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      emojiRain(MONEY);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="trilogy"
      className="text-xl font-bold text-gray-900 lowercase tracking-tight select-none active:scale-90 transition-transform"
    >
      trilogy
    </button>
  );
}
