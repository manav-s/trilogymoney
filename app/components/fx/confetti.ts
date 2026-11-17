'use client';

/**
 * Tiny dependency-free confetti / emoji-rain engine.
 * One shared full-screen canvas is created lazily and its loop stops whenever nothing is on screen.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  emoji?: string;
  life: number;
  ttl: number;
};

const COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00', '#34C759'];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '90',
  });
  document.body.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
}

function loop() {
  if (!ctx) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  particles = particles.filter((p) => p.life < p.ttl && p.y < h + 80);

  for (const p of particles) {
    p.vy += p.g;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life++;
    const fade = Math.max(0, (p.life - p.ttl * 0.75) / (p.ttl * 0.25));
    ctx.save();
    ctx.globalAlpha = 1 - fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.emoji) {
      ctx.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
    } else {
      ctx.fillStyle = p.color;
      // flat ribbons that "flip" as they spin
      ctx.fillRect(-p.size / 2, (-p.size / 4) * Math.cos(p.rot * 3), p.size, (p.size / 2) * Math.cos(p.rot * 3));
    }
    ctx.restore();
  }

  if (particles.length) {
    raf = requestAnimationFrame(loop);
  } else {
    raf = 0;
    ctx.clearRect(0, 0, w, h);
  }
}

function start() {
  if (!raf) raf = requestAnimationFrame(loop);
}

/** Explosion of confetti (and optional emojis) from a viewport point. */
export function confettiBurst(x: number, y: number, { count = 90, emojis }: { count?: number; emojis?: string[] } = {}) {
  if (reducedMotion()) return;
  ensureCanvas();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    const emoji = emojis && Math.random() < 0.35 ? emojis[Math.floor(Math.random() * emojis.length)] : undefined;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      g: 0.22,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      size: emoji ? 18 + Math.random() * 14 : 7 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      emoji,
      life: 0,
      ttl: 110 + Math.random() * 60,
    });
  }
  start();
}

/** Emojis falling from the top of the screen. */
export function emojiRain(emojis: string[], count = 140) {
  if (reducedMotion()) return;
  ensureCanvas();
  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * w,
      y: -40 - Math.random() * window.innerHeight * 1.2,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 2 + Math.random() * 4,
      g: 0.06,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.08,
      size: 22 + Math.random() * 22,
      color: '',
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      life: 0,
      ttl: 600,
    });
  }
  start();
}
