import confetti from 'canvas-confetti';

const PALETTE = ['#ffd93d', '#ff6bb5', '#8b5cf6', '#38bdf8', '#ff8a3d', '#4ade80', '#ffffff'];

export function burstConfetti(opts: { x?: number; y?: number; power?: number } = {}) {
  const { x = 0.5, y = 0.5, power = 1 } = opts;
  confetti({ particleCount: Math.round(120 * power), spread: 100, startVelocity: 55, origin: { x, y }, colors: PALETTE, scalar: 1.1, zIndex: 45 });
  confetti({ particleCount: Math.round(40 * power), spread: 140, startVelocity: 35, origin: { x, y }, colors: PALETTE, shapes: ['star'], scalar: 1.6, zIndex: 45 });
}

/** Two side cannons — the classic "you won" shot. */
export function cannonConfetti() {
  const shot = (angle: number, x: number) =>
    confetti({ particleCount: 90, angle, spread: 65, startVelocity: 65, origin: { x, y: 0.75 }, colors: PALETTE, zIndex: 45 });
  shot(60, 0);
  shot(120, 1);
  setTimeout(() => {
    shot(70, 0.05);
    shot(110, 0.95);
  }, 250);
}

/** Sparkle rain used behind the prompt reveal. */
export function sparkleRain(durationMs = 1600) {
  const end = Date.now() + durationMs;
  const tick = () => {
    confetti({ particleCount: 3, angle: 90, spread: 360, startVelocity: 18, gravity: 0.5, origin: { x: Math.random(), y: Math.random() * 0.6 }, colors: ['#ffffff', '#ffd93d', '#ff6bb5'], shapes: ['star'], scalar: 1.1, ticks: 70, zIndex: 45 });
    if (Date.now() < end) window.setTimeout(tick, 110);
  };
  tick();
}
