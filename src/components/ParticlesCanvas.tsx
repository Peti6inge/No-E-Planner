import { useEffect, useRef } from 'react';
import { soundClick } from '../lib/eightBitSound';
import { PLANNING_PARTICLE_BURST, type ParticleBurstDetail } from '../lib/planningFeedback';

const NEON = ['#67e8f9', '#22d3ee', '#a78bfa', '#c084fc', '#e879f9', '#f0abfc', '#e0e7ff'];
const UNIT = 8;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  core: boolean;
};

function snap8(v: number) {
  return Math.round(v / UNIT) * UNIT;
}

export function burstAt(items: Particle[], clientX: number, clientY: number) {
  const x = clientX;
  const y = clientY;
  const nPix = 8 + Math.floor(Math.random() * 4);
  for (let i = 0; i < nPix; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 1.6 + Math.random() * 6;
    const roll = Math.random();
    const size = UNIT * (roll < 0.45 ? 1 : roll < 0.8 ? 1.5 : 2.5);
    items.push({
      x: snap8(x) - size / 2,
      y: snap8(y) - size / 2,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 1.5,
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      size,
      color: NEON[Math.floor(Math.random() * NEON.length)],
      core: Math.random() < 0.45,
    });
  }
}

export function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fx = canvas.getContext('2d');
    if (!fx) return;

    fx.imageSmoothingEnabled = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const drawPixel = (p: Particle) => {
      const a = Math.max(0, p.life);
      fx.globalAlpha = a;
      fx.shadowBlur = 22 + p.size * 0.6;
      fx.shadowColor = p.color;
      fx.fillStyle = p.color;
      const px = snap8(p.x);
      const py = snap8(p.y);
      fx.fillRect(px, py, p.size, p.size);
      if (p.core && p.size >= UNIT) {
        fx.shadowBlur = 8;
        fx.fillStyle = '#fafafa';
        const inset = p.size > UNIT ? UNIT / 2 : 0;
        fx.fillRect(px + inset, py + inset, p.size - inset * 2, p.size - inset * 2);
      }
    };

    let frameId = 0;
    const tick = () => {
      fx.clearRect(0, 0, canvas.width, canvas.height);
      const items = itemsRef.current;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        drawPixel(p);
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.048;
        p.life -= p.decay;
        if (p.life <= 0) items.splice(i, 1);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    const onBurst = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.coqli-add-btn')) return;
      if (target?.closest('button, a, [role="button"]')) {
        soundClick();
        burstAt(itemsRef.current, e.clientX, e.clientY);
      }
    };
    document.addEventListener('click', onBurst);

    const onPlanningBurst = (e: Event) => {
      const detail = (e as CustomEvent<ParticleBurstDetail>).detail;
      if (detail && Number.isFinite(detail.clientX) && Number.isFinite(detail.clientY)) {
        burstAt(itemsRef.current, detail.clientX, detail.clientY);
      }
    };
    window.addEventListener(PLANNING_PARTICLE_BURST, onPlanningBurst);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('click', onBurst);
      window.removeEventListener(PLANNING_PARTICLE_BURST, onPlanningBurst);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="fx"
      className="particles-canvas"
      aria-hidden="true"
    />
  );
}
