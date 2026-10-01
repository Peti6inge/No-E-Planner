type BeepOptions = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  slide?: number;
  delay?: number;
};

let audioCtx: AudioContext | null = null;

const ctx = (): AudioContext | null => {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
};

export const beep = ({ freq, dur, type, vol, slide, delay }: BeepOptions) => {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + (delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type ?? 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slide) {
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol ?? 0.07, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
};

/** Clic UI court — même preset que Coqli planning board. */
export const soundClick = () => {
  beep({ freq: 420, dur: 0.04, type: 'square', vol: 0.04 });
};

/** Enregistrement réponse / sauvegarde (Coqli `soundSave`). */
export const soundSave = () => {
  beep({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.06 });
  beep({ freq: 880, dur: 0.12, type: 'sine', vol: 0.05, delay: 0.06 });
};

/** Stash appliqué / succès (Coqli `soundSuccess`). */
export const soundSuccess = () => {
  beep({ freq: 523, dur: 0.08, type: 'square', vol: 0.07 });
  beep({ freq: 784, dur: 0.12, type: 'square', vol: 0.06, delay: 0.07 });
  beep({ freq: 1046, dur: 0.16, type: 'triangle', vol: 0.05, delay: 0.14 });
};
