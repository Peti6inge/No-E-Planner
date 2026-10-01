import { soundClick } from './eightBitSound';

export const PLANNING_PARTICLE_BURST = 'coqli-planning-particle-burst';

export type ParticleBurstDetail = { clientX: number; clientY: number };

export const particleBurstAt = (clientX: number, clientY: number) => {
  soundClick();
  window.dispatchEvent(
    new CustomEvent<ParticleBurstDetail>(PLANNING_PARTICLE_BURST, {
      detail: { clientX, clientY },
    }),
  );
};

export const particleBurstFromElement = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  particleBurstAt(r.left + r.width / 2, r.top + r.height / 2);
};

/** Son 8-bit + particules (centre de l’élément ou coordonnées explicites). */
export const planningUiFeedback = (
  target: HTMLElement | ParticleBurstDetail,
) => {
  if (target instanceof HTMLElement) {
    particleBurstFromElement(target);
  } else {
    particleBurstAt(target.clientX, target.clientY);
  }
};
