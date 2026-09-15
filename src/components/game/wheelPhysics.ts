/**
 * Deterministic carnival-wheel physics.
 *
 * The wheel is simulated as a rigid rotor with:
 *   - constant bearing friction (a0) plus viscous air drag (k * omega)
 *   - a pointer "flapper" that resists the wheel for the first PEG_WINDOW
 *     degrees after every segment boundary (peg). Passing a peg costs energy,
 *     so as the wheel slows it visibly hesitates on each peg.
 *   - a bounce-back: if the wheel runs out of energy while pushing a peg,
 *     the flapper shoves it backwards until it clears the peg and settles.
 *
 * To land on a chosen segment we search over launch speeds until the
 * simulated resting angle matches the desired one. The trajectory is
 * precomputed once and simply played back, so it is perfectly repeatable.
 */

export const SIM_DT = 1 / 240;

const A0 = 62; // deg/s² constant friction
const K = 0.11; // 1/s viscous drag
const PEG_WINDOW = 6; // degrees of flapper resistance after each peg
const PEG_DECEL = 470; // deg/s² extra decel while pushing the flapper
const ACCEL_TIME = 0.5; // seconds to reach launch speed
const MAX_T = 25;

export interface SpinPlan {
  samples: number[]; // rotor angle (deg) at every SIM_DT step
  duration: number; // seconds
  finalAngle: number; // resting rotor angle (deg), includes baseOffset
}

interface SimResult {
  samples: number[];
  finalAngle: number;
}

function simulate(v0: number, seg: number, baseOffset: number): SimResult {
  let theta = baseOffset;
  let omega = 0;
  let t = 0;
  let phase: 'accel' | 'free' | 'back' = 'accel';
  const samples: number[] = [theta];

  const pegDepth = (angle: number) => (((angle % seg) + seg) % seg);

  while (t < MAX_T) {
    if (phase === 'accel') {
      omega += (v0 / ACCEL_TIME) * SIM_DT;
      theta += omega * SIM_DT;
      if (t >= ACCEL_TIME) phase = 'free';
    } else if (phase === 'free') {
      const depth = pegDepth(theta);
      const pushingPeg = depth < PEG_WINDOW;
      const decel = A0 + K * omega + (pushingPeg ? PEG_DECEL : 0);
      omega -= decel * SIM_DT;
      if (omega <= 0) {
        if (pushingPeg) {
          // Not enough energy to clear the peg: flapper pushes the wheel back
          // until it rests just before the boundary.
          omega = -Math.sqrt(2 * A0 * (depth + 1.6));
          phase = 'back';
        } else {
          omega = 0;
          samples.push(theta);
          break;
        }
      }
      theta += omega * SIM_DT;
    } else {
      omega += A0 * SIM_DT;
      if (omega >= 0) {
        samples.push(theta);
        break;
      }
      theta += omega * SIM_DT;
    }
    t += SIM_DT;
    samples.push(theta);
  }
  return { samples, finalAngle: theta };
}

/**
 * Build a spin that starts from `baseOffset` and rests with `targetIndex`
 * under the top pointer (offset from the segment centre by `jitter` degrees).
 */
export function planSpin(targetIndex: number, segmentCount: number, baseOffset: number, jitter = 0): SpinPlan {
  const seg = 360 / segmentCount;
  const desired = 360 - (targetIndex * seg + seg / 2) + jitter;

  let best: { diff: number; sim: SimResult } | null = null;
  const candidates: SimResult[] = [];
  for (let v0 = 750; v0 <= 1450; v0 += 0.5) {
    const sim = simulate(v0, seg, baseOffset);
    const spins = (sim.finalAngle - baseOffset) / 360;
    if (spins < 5 || spins > 10) continue;
    let diff = (((sim.finalAngle - desired) % 360) + 360) % 360;
    if (diff > 180) diff -= 360;
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { diff, sim };
    if (Math.abs(diff) < 0.6) candidates.push(sim);
  }
  if (candidates.length > 0) best = { diff: 0, sim: candidates[Math.floor(Math.random() * candidates.length)] };

  // Extremely unlikely, but never leave the player without a spin.
  const sim = best ? best.sim : simulate(1000, seg, baseOffset);
  return { samples: sim.samples, duration: (sim.samples.length - 1) * SIM_DT, finalAngle: sim.finalAngle };
}

/** Which segment sits under the top pointer for a given rotor angle. */
export function indexUnderPointer(rotation: number, segmentCount: number) {
  const seg = 360 / segmentCount;
  const a = (((360 - (rotation % 360)) % 360) + 360) % 360;
  return Math.floor(a / seg) % segmentCount;
}
