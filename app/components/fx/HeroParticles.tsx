'use client';

import { useEffect, useRef } from 'react';

const GLYPHS = ['$', '💸', '📈', '💳', '🪙', '✨', '💙', '¢', '%', '$'];
const BASE_RISE = (z: number) => -(0.15 + z * 0.45);

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  glyph: string;
  burstLife?: number;
};

/**
 * Canvas of money glyphs drifting upward at different depths. They scatter away from the cursor,
 * shift with mouse parallax, and clicking empty hero space fires a burst. Pauses off-screen.
 */
export default function HeroParticles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = host.clientWidth;
      h = host.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const spawn = (anywhere: boolean): Particle => {
      const z = 0.25 + Math.random() * 0.75;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 30,
        z,
        vx: (Math.random() - 0.5) * 0.2,
        vy: BASE_RISE(z),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.01,
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      };
    };
    const particles: Particle[] = Array.from({ length: w < 640 ? 16 : 38 }, () => spawn(true));

    let mx = -9999;
    let my = -9999;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('a,button,[data-no-burst]')) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || particles.length > 220) return;
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        particles.push({
          ...spawn(true),
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          z: 0.7 + Math.random() * 0.3,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vr: (Math.random() - 0.5) * 0.2,
          burstLife: 0,
        });
      }
    };

    let raf = 0;
    let visible = true;
    const tick = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // scatter away from the cursor
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150) {
          const d = Math.sqrt(d2) || 1;
          const force = ((150 - d) / 150) * 1.4 * p.z;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
        }

        if (p.burstLife !== undefined) {
          p.vx *= 0.97;
          p.vy = p.vy * 0.97 + 0.05;
          p.burstLife++;
          if (p.burstLife > 120) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          p.vx *= 0.94;
          p.vy += (BASE_RISE(p.z) - p.vy) * 0.06;
          if (p.y < -40) Object.assign(p, spawn(false));
          if (p.x < -40) p.x = w + 40;
          if (p.x > w + 40) p.x = -40;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        const alpha = p.burstLife !== undefined ? Math.max(0, 1 - p.burstLife / 120) * 0.9 : 0.1 + p.z * 0.4;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x - px * 70 * p.z, p.y - py * 50 * p.z);
        ctx.rotate(p.rot);
        ctx.font = `${Math.round(12 + p.z * 22)}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
        ctx.fillStyle = p.z > 0.6 ? '#007AFF' : '#818cf8';
        ctx.fillText(p.glyph, 0, 0);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (visible && !document.hidden && !raf) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    resume();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />;
}
