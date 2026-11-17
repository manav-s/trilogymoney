'use client';

import { useEffect, useRef, useState } from 'react';
import { Landmark, MessageCircle, Sparkles } from 'lucide-react';
import { useInView } from './motion/hooks';

const STEPS = [
  {
    title: 'connect your bank',
    body: 'secure plaid integration. 60-second setup, one time.',
    detail: '🔒 we never see your bank login',
    Icon: Landmark,
  },
  {
    title: 'get weekly updates',
    body: 'every week, an imessage with your balance, spending, and insights.',
    detail: '📬 lands right in your imessage',
    Icon: MessageCircle,
  },
  {
    title: 'stay aware',
    body: 'a simple check-in that keeps you on top of your money, stress-free.',
    detail: '💬 reply anytime with a question',
    Icon: Sparkles,
  },
];

/** Steps light up one after another and the connecting line fills in; hovering a step takes over. */
export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { threshold: 0.4 });
  const [active, setActive] = useState(-1);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused) return;
    const advance = () => setActive((a) => (a + 1) % STEPS.length);
    // Light up step 1 right away the first time; after a hover, just resume the normal rhythm.
    const first = active === -1 ? window.setTimeout(advance, 200) : undefined;
    const id = window.setInterval(advance, 2600);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
    // `active` is read only to decide the first delay; re-running on every step would reset the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, paused]);

  const fill = active <= 0 ? 0 : (active / (STEPS.length - 1)) * 100;

  return (
    <div ref={ref} className="grid sm:grid-cols-3 gap-12 relative" onPointerLeave={() => setPaused(false)}>
      {/* Connecting line (desktop) */}
      <div className="hidden sm:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-blue-100 -z-10 overflow-hidden rounded-full">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-[width] duration-700 ease-out"
          style={{ width: `${fill}%` }}
        />
      </div>

      {STEPS.map(({ title, body, detail, Icon }, i) => {
        const isActive = i === active;
        const isDone = i <= active;
        return (
          <button
            key={title}
            type="button"
            onPointerEnter={() => {
              setPaused(true);
              setActive(i);
            }}
            onFocus={() => {
              setPaused(true);
              setActive(i);
            }}
            onClick={() => {
              setPaused(true);
              setActive(i);
            }}
            className="text-center space-y-6 rounded-3xl p-4 -m-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <div
              className={`relative w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl font-bold transition-all duration-500 ${
                isDone
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-4 ring-blue-50'
                  : 'bg-blue-50 border-2 border-blue-100 text-blue-600 shadow-lg'
              } ${isActive ? 'scale-110 -rotate-3' : 'scale-100'}`}
            >
              {isActive && <span className="absolute inset-0 rounded-2xl bg-blue-400/40 animate-ping" />}
              <span className="relative">{isActive ? <Icon className="w-7 h-7" /> : i + 1}</span>
            </div>
            <h3
              className={`text-2xl font-bold transition-colors duration-300 ${
                isActive ? 'text-blue-600' : 'text-gray-900'
              }`}
            >
              {title}
            </h3>
            <p className="text-lg text-gray-600 leading-relaxed">{body}</p>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <span className="inline-block rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm text-blue-700">
                  {detail}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
