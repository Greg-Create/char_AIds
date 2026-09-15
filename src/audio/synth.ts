/**
 * Procedural placeholder sound effects built on the Web Audio API.
 *
 * Every exported function is a single "sound hook". To swap in a real audio
 * file later, replace the body of that function with something like:
 *
 *   playSample('/sounds/wheel-land.mp3', { volume: 0.8 })
 *
 * and nothing else in the app needs to change.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const MASTER_VOLUME = 0.55;

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

/** Call from the first user gesture so browsers unlock audio. */
export function unlockAudio() {
  audio();
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
}

export function isMuted() {
  return muted;
}

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  to?: number;
  type?: Wave;
  dur?: number;
  vol?: number;
  at?: number;
  attack?: number;
}

function tone({ freq, to, type = 'sine', dur = 0.1, vol = 0.3, at = 0, attack = 0.005 }: ToneOpts) {
  const a = audio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function getNoise(ctx: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noise({ dur = 0.05, vol = 0.2, at = 0, filterFrom = 2000, filterTo }: { dur?: number; vol?: number; at?: number; filterFrom?: number; filterTo?: number }) {
  const a = audio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(filterFrom, t0);
  if (filterTo) filter.frequency.exponentialRampToValueAtTime(filterTo, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

export function sfxClick() {
  tone({ freq: 520, to: 820, type: 'square', dur: 0.07, vol: 0.12 });
  noise({ dur: 0.03, vol: 0.06, filterFrom: 3000 });
}

export function sfxHover() {
  tone({ freq: 1100, to: 1300, type: 'sine', dur: 0.045, vol: 0.05 });
}

export function sfxWhoosh() {
  noise({ dur: 0.55, vol: 0.35, filterFrom: 200, filterTo: 3500 });
}

/* ------------------------------------------------------------------ */
/* Wheel                                                               */
/* ------------------------------------------------------------------ */

let whir: { osc: OscillatorNode; noiseSrc: AudioBufferSourceNode; oscGain: GainNode; noiseGain: GainNode; filter: BiquadFilterNode } | null = null;

/** Continuous spinning whir. Call updateSpin(speed 0..1) every frame. */
export function startSpin() {
  const a = audio();
  if (!a || whir) return;
  const { ctx, master } = a;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 70;
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  osc.connect(filter).connect(oscGain).connect(master);
  osc.start();

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = getNoise(ctx);
  noiseSrc.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 900;
  nf.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseSrc.connect(nf).connect(noiseGain).connect(master);
  noiseSrc.start();

  whir = { osc, noiseSrc, oscGain, noiseGain, filter };
}

export function updateSpin(speed: number) {
  if (!whir || !ctx) return;
  const s = Math.max(0, Math.min(1, speed));
  const t = ctx.currentTime;
  whir.osc.frequency.setTargetAtTime(60 + s * 160, t, 0.05);
  whir.filter.frequency.setTargetAtTime(300 + s * 900, t, 0.05);
  whir.oscGain.gain.setTargetAtTime(s * 0.08, t, 0.05);
  whir.noiseGain.gain.setTargetAtTime(s * 0.12, t, 0.05);
}

export function stopSpin() {
  if (!whir || !ctx) return;
  const t = ctx.currentTime;
  whir.oscGain.gain.setTargetAtTime(0, t, 0.1);
  whir.noiseGain.gain.setTargetAtTime(0, t, 0.1);
  const w = whir;
  whir = null;
  setTimeout(() => {
    w.osc.stop();
    w.noiseSrc.stop();
  }, 400);
}

/** Peg tick as a wheel section passes the pointer. speed 0..1 controls pitch/volume. */
export function sfxWheelTick(speed: number) {
  const s = Math.max(0.15, Math.min(1, speed));
  noise({ dur: 0.025, vol: 0.12 + s * 0.15, filterFrom: 2500 + s * 1500 });
  tone({ freq: 900 + s * 500, to: 500, type: 'triangle', dur: 0.04, vol: 0.06 + s * 0.06 });
}

/** DING! when the wheel lands. */
export function sfxWheelLand() {
  tone({ freq: 1046, type: 'triangle', dur: 0.7, vol: 0.32 });
  tone({ freq: 1568, type: 'sine', dur: 0.9, vol: 0.22, at: 0.05 });
  tone({ freq: 2093, type: 'sine', dur: 1.1, vol: 0.1, at: 0.08 });
}

/* ------------------------------------------------------------------ */
/* Reveal / round                                                      */
/* ------------------------------------------------------------------ */

export function sfxReveal() {
  const notes = [523, 659, 784, 1046, 1318];
  notes.forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.18, at: i * 0.075 }));
  tone({ freq: 1046, type: 'sine', dur: 1.2, vol: 0.2, at: 0.4 });
  tone({ freq: 1318, type: 'sine', dur: 1.2, vol: 0.15, at: 0.4 });
  noise({ dur: 0.5, vol: 0.2, at: 0.35, filterFrom: 800, filterTo: 5000 });
}

export function sfxCountdownTick(urgent: boolean) {
  if (urgent) {
    tone({ freq: 880, type: 'square', dur: 0.09, vol: 0.14 });
    tone({ freq: 660, type: 'square', dur: 0.09, vol: 0.08, at: 0.1 });
  } else {
    tone({ freq: 660, type: 'sine', dur: 0.07, vol: 0.1 });
  }
}

export function sfxFinalCountdown() {
  tone({ freq: 880, type: 'square', dur: 0.08, vol: 0.16 });
  tone({ freq: 1174, type: 'square', dur: 0.12, vol: 0.16, at: 0.1 });
}

/** Time's up: slide-whistle down + pop. */
export function sfxRoundEnd() {
  tone({ freq: 1400, to: 300, type: 'sine', dur: 0.55, vol: 0.25 });
  noise({ dur: 0.18, vol: 0.4, at: 0.5, filterFrom: 600, filterTo: 200 });
  tone({ freq: 220, type: 'square', dur: 0.25, vol: 0.18, at: 0.52 });
}

/** Fanfare for round complete / confetti. */
export function sfxWin() {
  const chord = [523, 659, 784];
  chord.forEach((f) => tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.14 }));
  chord.forEach((f) => tone({ freq: f * 1.25, type: 'triangle', dur: 0.35, vol: 0.14, at: 0.3 }));
  [784, 988, 1175, 1568].forEach((f) => tone({ freq: f, type: 'triangle', dur: 1.3, vol: 0.13, at: 0.6 }));
  noise({ dur: 0.7, vol: 0.25, at: 0.6, filterFrom: 1200, filterTo: 6000 });
}

export function sfxConfetti() {
  noise({ dur: 0.35, vol: 0.3, filterFrom: 1500, filterTo: 5000 });
  tone({ freq: 1568, type: 'sine', dur: 0.3, vol: 0.1 });
}
