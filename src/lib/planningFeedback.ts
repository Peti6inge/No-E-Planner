import { soundSave, soundSuccess } from './eightBitSound';

export const PLANNING_PARTICLE_BURST = 'coqli-planning-particle-burst';

export type ParticleBurstDetail = { clientX: number; clientY: number };

export const particleBurstAt = (clientX: number, clientY: number) => {
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

const burstTarget = (target: HTMLElement | ParticleBurstDetail) => {
  if (target instanceof HTMLElement) {
    particleBurstFromElement(target);
  } else {
    particleBurstAt(target.clientX, target.clientY);
  }
};

/** Ajout de ticket — son « réponse enregistrée » + particules. */
export const planningAddFeedback = (target: HTMLElement | ParticleBurstDetail) => {
  soundSave();
  burstTarget(target);
};

/** Validation DONE — son « stash appliqué » + particules. */
export const planningValidateFeedback = (target: HTMLElement) => {
  soundSuccess();
  particleBurstFromElement(target);
};
