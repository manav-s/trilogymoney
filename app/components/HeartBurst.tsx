'use client';

import { useRef, useState, type CSSProperties, type MouseEvent } from 'react';

type Heart = { id: number; x: number; y: number; emoji: string; drift: number };

const EMOJIS = ['💙', '💜', '🩵', '✨', '🫶'];

/** "send some love" button that throws floating hearts from wherever you click. */
export default function HeartBurst() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [count, setCount] = useState(0);
  const nextId = useRef(0);

  const burst = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Keyboard "clicks" report 0,0, so fall back to the button's center.
    const x = e.clientX ? e.clientX - r.left : r.width / 2;
    const y = e.clientY ? e.clientY - r.top : r.height / 2;
    const batch = Array.from({ length: 7 }, () => ({
      id: nextId.current++,
      x,
      y,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      drift: (Math.random() - 0.5) * 140,
    }));
    setHearts((h) => [...h, ...batch]);
    setCount((c) => c + 1);
    const ids = new Set(batch.map((b) => b.id));
    window.setTimeout(() => setHearts((h) => h.filter((heart) => !ids.has(heart.id))), 1500);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={burst}
        className="relative inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-medium lowercase text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#007AFF] hover:shadow-blue-200 active:scale-95"
      >
        send some love 💙
        {hearts.map((h) => (
          <span
            key={h.id}
            aria-hidden
            className="pointer-events-none absolute text-xl animate-float-up"
            style={{ left: h.x, top: h.y, '--drift': `${h.drift}px` } as CSSProperties}
          >
            {h.emoji}
          </span>
        ))}
      </button>
      <p aria-live="polite" className={`text-sm text-gray-500 transition-opacity duration-300 ${count ? 'opacity-100' : 'opacity-0'}`}>
        {count <= 1 ? 'thank you 🥹' : `${count} hearts sent. you’re too kind`}
      </p>
    </div>
  );
}
