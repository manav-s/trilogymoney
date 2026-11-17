'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../motion/hooks';
import SpotlightCard from '../motion/SpotlightCard';
import CompareToggle from '../CompareToggle';

type Tone = 'red' | 'amber' | 'blue' | 'gray';

/** x/y are % of the stage's half-width/half-height from its center; r is resting rotation. */
const NOISE: { text: string; x: number; y: number; r: number; tone: Tone }[] = [
  { text: '⚠️ budget exceeded: dining', x: -36, y: -30, r: -8, tone: 'red' },
  { text: '23 transactions need a category', x: 30, y: -34, r: 6, tone: 'gray' },
  { text: '📊 your monthly report is ready', x: -42, y: 22, r: 4, tone: 'gray' },
  { text: '🔔 daily spending alert', x: 40, y: -10, r: -5, tone: 'amber' },
  { text: 'set up your 2027 budget!', x: -26, y: 40, r: 7, tone: 'blue' },
  { text: '4 unread insights', x: 30, y: 34, r: -9, tone: 'red' },
  { text: 'net worth ↓ 0.3% today', x: 2, y: -46, r: 3, tone: 'red' },
  { text: '🏷️ tag this: AMZN MKTP US*2K4', x: 6, y: 48, r: -4, tone: 'gray' },
  { text: 'rate us ⭐⭐⭐⭐⭐', x: 44, y: 14, r: 10, tone: 'amber' },
  { text: 'upgrade to premium?', x: -44, y: -6, r: -11, tone: 'blue' },
  { text: '📈 new chart unlocked', x: 40, y: 46, r: 5, tone: 'gray' },
  { text: 'connect another account', x: -30, y: -46, r: -6, tone: 'gray' },
];

const TONES: Record<Tone, string> = {
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  gray: 'bg-white text-gray-700 ring-gray-200',
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function DifferentCard() {
  return (
    <SpotlightCard tilt={false} className="glass-panel w-full max-w-3xl rounded-3xl p-6 sm:p-12 text-center">
      <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
        trilogy is <span className="text-blue-600">different.</span>
      </h2>
      <p className="text-lg sm:text-2xl text-gray-700 leading-relaxed">
        once a week, you get an imessage with what actually matters.
      </p>
      <CompareToggle />
    </SpotlightCard>
  );
}

function Headline() {
  return (
    <>
      <p className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight">
        most finance apps are <span className="text-red-500">exhausting.</span>
      </p>
      <p className="mt-4 text-base sm:text-lg text-gray-500 max-w-xl mx-auto">
        they want you to build budgets, track every category, and stare at charts until your eyes glaze over.
      </p>
    </>
  );
}

/**
 * Pinned scroll scene: finance-app notifications pile in and shake harder the further you scroll,
 * then get blown off screen and the "trilogy is different" card zooms in.
 */
export default function ChaosScene() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const panicRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = clamp(-rect.top / (travel || 1));
      const W = stage.clientWidth / 2;
      const H = stage.clientHeight / 2;

      const out = easeIn(clamp((p - 0.5) / 0.14));
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const n = NOISE[i];
        const tin = easeOut(clamp((p - 0.03 - i * 0.024) / 0.18));
        const tx = (n.x / 100) * W;
        const ty = (n.y / 100) * H;
        const x = lerp(tx * 3, tx, tin) * (1 + out * 2.2);
        const y = lerp(ty * 3 + 240, ty, tin) * (1 + out * 2.2);
        const rot = n.r * (1 + (1 - tin) * 5) + out * n.r * 4;
        const scale = (0.4 + 0.6 * tin) * (1 - out * 0.4);
        el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
        el.style.opacity = String(tin * (1 - out));
      });

      // shake builds as the pile grows
      const panic = clamp((p - 0.15) / 0.33) * (1 - out);
      stage.style.setProperty('--jit', `${(panic * 3.5).toFixed(2)}px`);
      if (panicRef.current) panicRef.current.style.opacity = String(panic * 0.5);

      const headOut = clamp((p - 0.46) / 0.12);
      if (headRef.current) {
        headRef.current.style.opacity = String(1 - headOut);
        headRef.current.style.transform = `scale(${1 - headOut * 0.2})`;
        headRef.current.style.filter = `blur(${headOut * 12}px)`;
      }
      if (badgeRef.current && countRef.current) {
        countRef.current.textContent = String(Math.round(clamp(p / 0.48) * 99)) + (p > 0.47 ? '+' : '');
        badgeRef.current.style.opacity = String(clamp(p / 0.08) * (1 - headOut));
        badgeRef.current.style.transform = `scale(${1 + panic * 0.25})`;
      }

      const cardIn = easeOut(clamp((p - 0.58) / 0.18));
      if (finalRef.current) {
        finalRef.current.style.opacity = String(cardIn);
        finalRef.current.style.transform = `translateY(${(1 - cardIn) * 80}px) scale(${0.75 + 0.25 * cardIn})`;
        finalRef.current.style.pointerEvents = cardIn > 0.6 ? 'auto' : 'none';
      }
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

  if (reduced) {
    return (
      <section className="py-24 sm:py-32 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-12">
          <Headline />
          <div className="flex justify-center">
            <DifferentCard />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative bg-gray-50" style={{ height: '280vh' }}>
      <div ref={stageRef} className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
        <div
          ref={panicRef}
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.25),transparent_70%)] opacity-0"
        />

        {/* the pile of notifications */}
        <div aria-hidden className="absolute inset-0">
          {NOISE.map((n, i) => (
            <div
              key={n.text}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="chaos-card absolute left-1/2 top-1/2 will-change-transform"
              style={{ opacity: 0 }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                <div
                  className={`animate-jitter whitespace-nowrap rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 text-[11px] sm:text-sm font-medium shadow-lg ring-1 ${TONES[n.tone]}`}
                  style={{ animationDelay: `${-i * 37}ms` }}
                >
                  {n.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* headline + notification counter */}
        <div ref={headRef} className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center will-change-transform">
          <div className="relative">
            <Headline />
            <div
              ref={badgeRef}
              aria-hidden
              className="absolute -top-8 right-0 sm:-right-10 flex h-11 min-w-11 items-center justify-center rounded-full bg-red-500 px-2 text-base font-bold text-white shadow-lg shadow-red-200 opacity-0"
            >
              <span ref={countRef} className="tabular-nums">
                0
              </span>
            </div>
          </div>
        </div>

        {/* the calm after */}
        <div
          ref={finalRef}
          className="chaos-final absolute inset-0 flex items-center justify-center px-4 will-change-transform"
          style={{ opacity: 0, pointerEvents: 'none' }}
        >
          <DifferentCard />
        </div>
      </div>
    </section>
  );
}
