'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Battery, ChevronRight, RotateCcw, Signal, Wifi } from 'lucide-react';
import { useInView, useReducedMotion } from './motion/hooks';
import CountUp from './motion/CountUp';
import { confettiBurst } from './fx/confetti';

type Msg = {
  id: number;
  from: 'bot' | 'user';
  kind: 'summary' | 'text';
  text?: string;
  liked?: boolean;
};
type NewMsg = Omit<Msg, 'id'>;

const INTRO: NewMsg[] = [
  { from: 'bot', kind: 'summary' },
  { from: 'bot', kind: 'text', text: 'doordash is lowkey eating your wallet rn 😭' },
  { from: 'user', kind: 'text', text: 'ok fine' },
];

const REPLIES = [
  { label: 'how bad is doordash?', reply: '4 orders this week. that’s basically a whole grocery run 🛒' },
  { label: 'roast me', reply: 'you visited amazon more than the gym this week 💀' },
  { label: 'am i doing ok?', reply: 'honestly yeah. spending’s down from last week. proud of you fr 🫶' },
];

const ORBIT = [
  { text: '💸 payday hit', pos: '-left-28 top-20', z: 90, delay: 0 },
  { text: '📉 food spend down', pos: '-right-24 top-[38%]', z: 130, delay: 0.25 },
  { text: '🔔 netflix renewed', pos: '-left-20 bottom-32', z: 70, delay: 0.5 },
  { text: '🫶 proud of you', pos: '-right-14 bottom-14', z: 110, delay: 0.75 },
];

const CATEGORIES = [
  { emoji: '🛍️', label: 'general merchandise', amount: 315 },
  { emoji: '💅', label: 'personal care', amount: 94 },
  { emoji: '🚗', label: 'transportation', amount: 25 },
];

function WeeklySummary() {
  const max = CATEGORIES[0].amount;
  return (
    <div className="space-y-2">
      <p>weekly summary: nov 10 → nov 16</p>
      <p>
        you spent <CountUp to={450} prefix="$" /> this week with amazon leading the way.
      </p>
      <div className="space-y-1.5 py-1">
        {CATEGORIES.map((c, i) => (
          <div key={c.label}>
            <div className="flex justify-between gap-2 text-[12px]">
              <span>
                {c.emoji} {c.label}
              </span>
              <span className="tabular-nums">${c.amount}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-gray-300/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#007AFF] origin-left animate-grow-x"
                style={{ width: `${(c.amount / max) * 100}%`, animationDelay: `${300 + i * 150}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p>
        balances: td bank <CountUp to={3589} prefix="$" delay={400} />
      </p>
    </div>
  );
}

function Bubble({ m, onLike }: { m: Msg; onLike: () => void }) {
  const lastTap = useRef(0);
  const isUser = m.from === 'user';

  // Our own double-tap detection: dblclick is unreliable on touch screens.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      if (!m.liked) confettiBurst(e.clientX, e.clientY, { count: 24, emojis: ['❤️', '💖', '✨'] });
      onLike();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        onClick={onClick}
        className={`relative max-w-[220px] rounded-3xl px-4 py-2.5 text-sm shadow-sm select-none cursor-pointer ${
          isUser
            ? 'bg-[#007AFF] text-white rounded-br-md origin-bottom-right animate-bubble-in-right'
            : 'bg-gray-200 text-gray-900 rounded-bl-md origin-bottom-left animate-bubble-in-left'
        }`}
      >
        {m.kind === 'summary' ? <WeeklySummary /> : m.text}
        {m.liked && (
          <span
            className={`absolute -top-3 ${
              isUser ? '-left-3' : '-right-3'
            } flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow-md ring-2 ring-white animate-pop`}
          >
            ❤️
          </span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-label="trilogy is typing">
      <div className="flex items-center gap-1 rounded-3xl rounded-bl-md bg-gray-200 px-4 py-3 origin-bottom-left animate-bubble-in-left">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-gray-500 animate-typing-dot"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** The hero iPhone: tilts toward the cursor, plays out a conversation, and lets visitors reply. */
export default function PhoneDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { threshold: 0.3, rootMargin: '0px' });
  const reduced = useReducedMotion();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(true);
  const [used, setUsed] = useState<string[]>([]);

  const timers = useRef<number[]>([]);
  const run = useRef(0);
  const nextId = useRef(0);
  const firstPlay = useRef(true);

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        timers.current.push(window.setTimeout(resolve, reduced ? 0 : ms));
      }),
    [reduced],
  );

  const push = (m: NewMsg) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }]);

  /** Shows the typing dots, then the message. Returns false if a replay interrupted it. */
  const botSay = useCallback(
    async (m: NewMsg, runId: number) => {
      setTyping(true);
      await wait(1100);
      if (runId !== run.current) return false;
      setTyping(false);
      push(m);
      await wait(450);
      return runId === run.current;
    },
    [wait],
  );

  const play = useCallback(async () => {
    const id = ++run.current;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setUsed([]);
    setTyping(false);
    setBusy(true);

    const introPlaying = firstPlay.current && !document.documentElement.classList.contains('intro-seen');
    firstPlay.current = false;
    await wait(introPlaying ? 1900 : 400);
    if (id !== run.current) return;
    for (const m of INTRO) {
      if (m.from === 'bot') {
        if (!(await botSay(m, id))) return;
      } else {
        await wait(800);
        if (id !== run.current) return;
        push(m);
        await wait(400);
        if (id !== run.current) return;
      }
    }
    setBusy(false);
  }, [wait, botSay]);

  const reply = async (r: (typeof REPLIES)[number]) => {
    if (busy) return;
    const id = run.current;
    setBusy(true);
    setUsed((u) => [...u, r.label]);
    push({ from: 'user', kind: 'text', text: r.label });
    await wait(500);
    if (id !== run.current) return;
    if (!(await botSay({ from: 'bot', kind: 'text', text: r.reply }, id))) return;
    setBusy(false);
  };

  const toggleLike = (id: number) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, liked: !m.liked } : m)));

  // Start the conversation the first time the phone is on screen.
  useEffect(() => {
    if (inView) play();
  }, [inView, play]);

  useEffect(() => {
    const t = timers;
    return () => t.current.forEach(clearTimeout);
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [messages.length, typing, reduced]);

  // Tilt the phone toward the cursor.
  useEffect(() => {
    const el = tiltRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap || reduced) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = wrap.getBoundingClientRect();
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        const dx = clamp((px - (r.left + r.width / 2)) / (window.innerWidth / 2));
        const dy = clamp((py - (r.top + r.height / 2)) / (window.innerHeight / 2));
        el.style.transform = `rotateY(${-15 + dx * 14}deg) rotateX(${5 - dy * 10}deg) rotateZ(${3 - dx * 2}deg)`;
        el.style.setProperty('--glare-x', `${50 + dx * 40}%`);
        el.style.setProperty('--glare-y', `${30 + dy * 40}%`);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const remaining = REPLIES.filter((r) => !used.includes(r.label));

  return (
    <div ref={wrapRef} className="relative flex flex-col items-center gap-6">
      <div className="animate-float scale-[0.86] min-[360px]:scale-[0.94] sm:scale-100 -my-6 min-[360px]:-my-2 sm:my-0" style={{ perspective: '1000px' }}>
        <div
          ref={tiltRef}
          className="relative z-10 transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: 'rotateY(-15deg) rotateX(5deg) rotateZ(3deg)', transformStyle: 'preserve-3d' }}
        >
          {/* Notifications floating in 3D around the phone; they parallax with the tilt */}
          {ORBIT.map((o) => (
            <div
              key={o.text}
              aria-hidden
              className={`absolute z-20 hidden sm:block ${o.pos}`}
              style={{ transform: `translateZ(${o.z}px)` }}
            >
              <div className="animate-pop" style={{ animationDelay: `calc(var(--intro, 0s) + ${o.delay + 1.2}s)` }}>
                <div
                  className="animate-orbit-bob whitespace-nowrap rounded-2xl bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-xl ring-1 ring-black/5"
                  style={{ animationDelay: `${-o.delay * 2}s` }}
                >
                  {o.text}
                </div>
              </div>
            </div>
          ))}

          {/* Glass panel behind */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-indigo-100 rounded-[3.5rem] blur-xl opacity-70" />

          {/* iPhone frame */}
          <div
            className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-[3rem] p-3 shadow-2xl"
            style={{ boxShadow: '-20px 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset' }}
          >
            <div className="relative flex flex-col bg-white rounded-[2.5rem] overflow-hidden" style={{ width: 280, height: 560 }}>
              {/* Status bar */}
              <div className="flex items-center justify-between px-6 pt-3 pb-1">
                <span className="text-sm font-semibold text-gray-900">9:41</span>
                <div className="flex items-center space-x-1">
                  <Signal className="w-3 h-3 text-gray-900" />
                  <Wifi className="w-3 h-3 text-gray-900" />
                  <Battery className="w-4 h-3 text-gray-900" />
                </div>
              </div>

              {/* Contact header */}
              <div className="flex flex-col items-center pt-4 pb-2 border-b border-gray-100 bg-gray-50/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5AC8FA] to-[#007AFF] text-white text-sm font-bold">
                  t
                </div>
                <span className="mt-1 flex items-center text-[11px] text-gray-700">
                  trilogy <ChevronRight className="w-3 h-3 text-gray-400" />
                </span>
              </div>

              {/* Conversation */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2" aria-live="polite">
                <p className="text-[10px] text-gray-400 text-center">today 8:03 AM</p>
                {messages.map((m) => (
                  <Bubble key={m.id} m={m} onLike={() => toggleLike(m.id)} />
                ))}
                {typing && <TypingIndicator />}
              </div>

              {/* Quick replies */}
              <div
                className={`flex flex-wrap justify-center gap-1.5 px-3 pt-2 pb-5 min-h-[76px] border-t border-gray-100 transition-opacity duration-300 ${
                  busy ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {remaining.length > 0 ? (
                  remaining.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      disabled={busy}
                      onClick={() => reply(r)}
                      className="rounded-full border border-[#007AFF]/30 bg-white px-3 py-1 text-[11px] text-[#007AFF] transition-all hover:bg-[#007AFF] hover:text-white active:scale-95 disabled:cursor-not-allowed"
                    >
                      {r.label}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => play()}
                    className="inline-flex items-center gap-1 rounded-full bg-[#007AFF] px-3 py-1 text-[11px] text-white transition-transform active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" /> start over
                  </button>
                )}
              </div>

              {/* Screen glare that moves with the tilt */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                style={{
                  background:
                    'radial-gradient(circle at var(--glare-x, 30%) var(--glare-y, 20%), rgba(255,255,255,0.45), transparent 45%)',
                }}
              />
            </div>

            {/* Notch */}
            <div
              className="absolute top-6 left-1/2 -translate-x-1/2 bg-black rounded-full"
              style={{ width: 100, height: 25 }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 text-center text-xs text-gray-400 lowercase">
        <span>
          tap a reply to chat<span className="hidden min-[400px]:inline"> · double-tap a bubble to ❤️</span>
        </span>
        <button
          type="button"
          onClick={() => play()}
          className="group inline-flex items-center gap-1 rounded-full px-2 py-1 text-gray-500 hover:text-[#007AFF] hover:bg-blue-50 transition-colors"
        >
          <RotateCcw className="w-3 h-3 transition-transform duration-500 group-hover:-rotate-[360deg]" />
          replay
        </button>
      </div>
    </div>
  );
}
