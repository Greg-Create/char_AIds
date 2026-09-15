import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Role } from '../App';
import { Wheel, type WheelPhase } from '../components/game/Wheel';
import { BigButton } from '../components/ui/BigButton';
import { HostWaiting, RoleBadge } from '../components/ui/HostWaiting';
import type { Prompt } from '../data/prompts';
import { useSimulatedHost } from '../game/useSimulatedHost';

const SPARKLES = [
  { glyph: '✨', top: '4%', left: '4%', d: 1.8 },
  { glyph: '⭐', top: '10%', right: '6%', d: 2.4 },
  { glyph: '✦', top: '55%', left: '1%', d: 2.1 },
  { glyph: '✨', top: '70%', right: '2%', d: 1.6 },
  { glyph: '🌟', top: '88%', left: '10%', d: 2.8 },
  { glyph: '✦', top: '86%', right: '12%', d: 2.2 },
];

interface WheelSpinProps {
  prompts: Prompt[];
  targetIndex: number;
  code: string;
  role: Role;
  onLanded: (index: number) => void;
}

export function WheelSpin({ prompts, targetIndex, code, role, onLanded }: WheelSpinProps) {
  const [spin, setSpin] = useState(false);
  const [phase, setPhase] = useState<WheelPhase>('idle');
  const isHost = role === 'host';

  // Guests don't get a SPIN button: the host spins for the whole party.
  useSimulatedHost(!isHost && phase === 'idle', 2600, () => setSpin(true));

  return (
    <motion.div
      className="screen screen--top"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.7, filter: 'blur(6px)' }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      <motion.div className="wheel-meta" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        <span className="chip chip--sm">
          🔑 <span className="chip__code">{code}</span>
        </span>
        <RoleBadge role={role} />
        <span className="text-white wheel-meta__turn">
          One spin · <strong style={{ color: 'var(--yellow)' }}>everyone acts!</strong>
        </span>
      </motion.div>

      <motion.h2
        className="display wheel-title"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1, rotate: [-2, 2, -2] }}
        transition={{ y: { type: 'spring', stiffness: 260, damping: 16 }, rotate: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
      >
        🎡 Spin to win!
      </motion.h2>

      <div style={{ position: 'relative', width: '100%', maxWidth: 820 }}>
        {SPARKLES.map((s, i) => (
          <span key={i} className="wheel-sparkle" style={{ top: s.top, left: s.left, right: s.right, animationDuration: `${s.d}s`, animationDelay: `${-i * 0.4}s` }} aria-hidden>
            {s.glyph}
          </span>
        ))}
        <Wheel prompts={prompts} targetIndex={targetIndex} spin={spin} onPhaseChange={setPhase} onLanded={onLanded} onTapIdle={isHost ? () => setSpin(true) : undefined} />
      </div>

      <div className="wheel-cta">
        <AnimatePresence mode="wait">
          {phase === 'idle' && isHost && (
            <motion.div key="spin" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0, rotate: 30 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <BigButton variant="primary" icon="🎡" attention onClick={() => setSpin(true)}>
                Spin!
              </BigButton>
            </motion.div>
          )}
          {phase === 'idle' && !isHost && <HostWaiting key="wait" text="Waiting for the host to spin" />}
          {phase === 'spinning' && (
            <motion.p key="spinning" className="text-white wheel-cta__note" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              Round and round it goes… no takebacks! 🙈
            </motion.p>
          )}
          {phase === 'landed' && (
            <motion.p key="landed" className="text-white wheel-cta__note" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>
              DING! 🔔
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
