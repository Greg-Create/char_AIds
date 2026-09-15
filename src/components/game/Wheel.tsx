import { animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Prompt } from '../../data/prompts';
import { useSound } from '../../audio/SoundProvider';
import { burstConfetti } from '../fx/confetti';
import { SIM_DT, indexUnderPointer, planSpin } from './wheelPhysics';

const SIZE = 420;
const C = SIZE / 2;
const R = 172; // wheel face radius
const RIM_R = 187; // light ring radius
const BULBS = 24;
const BULB_COLORS = ['#ffd93d', '#ff6bb5', '#38bdf8', '#4ade80'];
const MAX_SPEED = 1000; // deg/s, used to normalise sound/pointer intensity

function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function segmentPath(i: number, n: number) {
  const seg = 360 / n;
  const [x1, y1] = polar(R, i * seg);
  const [x2, y2] = polar(R, (i + 1) * seg);
  return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

export type WheelPhase = 'idle' | 'spinning' | 'landed';

interface WheelProps {
  prompts: Prompt[];
  /** The segment the wheel will deterministically land on. */
  targetIndex: number;
  /** Flip to true to launch the spin. */
  spin: boolean;
  onPhaseChange?: (phase: WheelPhase) => void;
  /** Fires after the landing celebration, once the prompt is ready to reveal. */
  onLanded: (index: number) => void;
  onTapIdle?: () => void;
}

export function Wheel({ prompts, targetIndex, spin, onPhaseChange, onLanded, onTapIdle }: WheelProps) {
  const n = prompts.length;
  const seg = 360 / n;
  const baseOffset = seg / 2; // start with a segment centred under the pointer
  const rotate = useMotionValue(baseOffset);
  const pointerRot = useMotionValue(0);
  const [phase, setPhase] = useState<WheelPhase>('idle');
  const sound = useSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;
  const onPhaseRef = useRef(onPhaseChange);
  onPhaseRef.current = onPhaseChange;

  useEffect(() => {
    onPhaseRef.current?.(phase);
  }, [phase]);

  useEffect(() => {
    if (!spin || phase !== 'idle') return;
    setPhase('spinning');

    const jitter = (Math.random() - 0.5) * seg * 0.4;
    const plan = planSpin(targetIndex, n, baseOffset, jitter);
    const { samples } = plan;
    let lastIdx = indexUnderPointer(rotate.get(), n);
    let raf = 0;
    let landedTimer: number | undefined;
    const start = performance.now();

    soundRef.current.wheel.start();

    const frame = () => {
      const t = (performance.now() - start) / 1000;
      const pos = t / SIM_DT;
      const i = Math.min(samples.length - 1, Math.floor(pos));
      const next = Math.min(samples.length - 1, i + 1);
      const angle = samples[i] + (samples[next] - samples[i]) * (pos - i);
      const omega = Math.abs(samples[next] - samples[i]) / SIM_DT;
      const speed = Math.min(1, omega / MAX_SPEED);

      rotate.set(angle);
      soundRef.current.wheel.update(speed);

      const idx = indexUnderPointer(angle, n);
      if (idx !== lastIdx) {
        lastIdx = idx;
        soundRef.current.wheel.tick(speed);
        animate(pointerRot, [-(10 + speed * 16), 0], { type: 'spring', stiffness: 900, damping: 14 });
      }

      if (i >= samples.length - 1) {
        rotate.set(samples[samples.length - 1]);
        soundRef.current.wheel.stop();
        soundRef.current.wheel.land();
        setPhase('landed');
        burstConfetti({ y: 0.45, power: 1.2 });
        landedTimer = window.setTimeout(() => onLandedRef.current(targetIndex), 1500);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      soundRef.current.wheel.stop();
      if (landedTimer) window.clearTimeout(landedTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  return (
    <div className={`wheel-stage wheel-stage--${phase}`} onClick={phase === 'idle' ? onTapIdle : undefined} role={phase === 'idle' ? 'button' : undefined} aria-label={phase === 'idle' ? 'Spin the wheel' : undefined}>
      <div className="wheel-depth" aria-hidden />

      {/* Rotating face */}
      <motion.div className="wheel-rotor" style={{ rotate }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel-svg" aria-hidden>
          <defs>
            <radialGradient id="wheel-gloss" cx="35%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#2d1b4e" stopOpacity="0.28" />
            </radialGradient>
            <radialGradient id="hub-gold" cx="40%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#fff6c2" />
              <stop offset="55%" stopColor="#ffd93d" />
              <stop offset="100%" stopColor="#d99400" />
            </radialGradient>
            <filter id="wheel-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={C} cy={C} r={R + 8} fill="#2d1b4e" />

          {prompts.map((p, i) => (
            <path key={p.id} d={segmentPath(i, n)} fill={p.color} stroke="#fff" strokeWidth={3} strokeLinejoin="round" />
          ))}
          <circle cx={C} cy={C} r={R - 1.5} fill="none" stroke="#fff" strokeWidth={3} strokeOpacity={0.9} />
          <circle cx={C} cy={C} r={R + 4} fill="none" stroke="#f5b301" strokeWidth={8} />

          {/* Pegs on every boundary — these are what the pointer flaps against */}
          {prompts.map((p, i) => {
            const [x, y] = polar(R - 6, i * seg);
            return <circle key={`${p.id}-peg`} cx={x} cy={y} r={4.5} fill="#fff" stroke="#2d1b4e" strokeWidth={2} />;
          })}

          {prompts.map((p, i) => {
            const fontSize = p.label.length > 11 ? 12.5 : 15;
            return (
              <g key={`${p.id}-label`} transform={`rotate(${i * seg + seg / 2} ${C} ${C})`}>
                <text x={C} y={C - 136} fontSize={fontSize} textAnchor="end" dominantBaseline="central" transform={`rotate(-90 ${C} ${C - 136})`}>
                  {p.label}
                </text>
                <text x={C} y={C - 154} fontSize={20} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90 ${C} ${C - 154})`} style={{ stroke: 'none' }}>
                  {p.emoji}
                </text>
              </g>
            );
          })}

          {phase === 'landed' && (
            <motion.path
              d={segmentPath(targetIndex, n)}
              fill="#fff"
              stroke="#ffd93d"
              strokeWidth={6}
              strokeLinejoin="round"
              filter="url(#wheel-glow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.75, 0.25, 0.75, 0.3] }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
            />
          )}

          <circle cx={C} cy={C} r={R} fill="url(#wheel-gloss)" pointerEvents="none" />

          {/* Hub */}
          <circle cx={C} cy={C + 3} r={42} fill="rgba(20, 8, 40, 0.45)" />
          <circle cx={C} cy={C} r={42} fill="#2d1b4e" />
          <circle cx={C} cy={C} r={35} fill="url(#hub-gold)" stroke="#fff" strokeWidth={3} />
          <ellipse cx={C - 9} cy={C - 13} rx={13} ry={7} fill="#fff" fillOpacity={0.55} />
          <text x={C} y={C + 2} fontSize={32} textAnchor="middle" dominantBaseline="central" style={{ stroke: 'none' }}>
            ⭐
          </text>
        </svg>
      </motion.div>

      {/* Static rim + lights */}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel-svg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
        <defs>
          <linearGradient id="rim-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff1a8" />
            <stop offset="45%" stopColor="#f5b301" />
            <stop offset="100%" stopColor="#b97a00" />
          </linearGradient>
          <linearGradient id="rim-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={RIM_R} fill="none" stroke="#2d1b4e" strokeWidth={26} />
        <circle cx={C} cy={C} r={RIM_R} fill="none" stroke="url(#rim-gold)" strokeWidth={16} />
        <circle cx={C} cy={C} r={RIM_R + 5} fill="none" stroke="url(#rim-shine)" strokeWidth={2.5} />
        <circle cx={C} cy={C} r={RIM_R - 6} fill="none" stroke="#7a4d00" strokeWidth={1.5} strokeOpacity={0.6} />
        {Array.from({ length: BULBS }, (_, i) => {
          const [x, y] = polar(RIM_R, (i * 360) / BULBS);
          const color = BULB_COLORS[i % BULB_COLORS.length];
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={8} fill="#2d1b4e" />
              <circle cx={x} cy={y} r={6.5} fill="#6b5a2e" />
              <circle className="bulb" cx={x} cy={y} r={5.5} fill={color} style={{ animationDelay: `${(i % 4) * 0.12}s`, color }} />
              <circle cx={x - 1.8} cy={y - 1.8} r={1.6} fill="#fff" fillOpacity={0.9} />
            </g>
          );
        })}
      </svg>

      {/* Pointer / flapper */}
      <motion.div className="wheel-pointer" style={{ rotate: pointerRot }}>
        <svg viewBox="0 0 60 60" width="100%" height="100%" aria-hidden>
          <defs>
            <linearGradient id="pointer-red" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8aa6" />
              <stop offset="100%" stopColor="#e0214d" />
            </linearGradient>
          </defs>
          <path d="M30 59 L6 18 Q30 0 54 18 Z" fill="url(#pointer-red)" stroke="#2d1b4e" strokeWidth={5} strokeLinejoin="round" />
          <path d="M18 17 Q30 9 42 17" fill="none" stroke="#fff" strokeWidth={3} strokeOpacity={0.7} strokeLinecap="round" />
          <circle cx={30} cy={19} r={9.5} fill="url(#hub-gold)" stroke="#2d1b4e" strokeWidth={4} />
          <circle cx={27} cy={16} r={2.5} fill="#fff" fillOpacity={0.8} />
        </svg>
      </motion.div>
    </div>
  );
}
