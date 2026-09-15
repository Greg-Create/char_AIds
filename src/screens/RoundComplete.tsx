import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { Role } from '../App';
import type { Prompt } from '../data/prompts';
import { useSound } from '../audio/SoundProvider';
import { BigButton } from '../components/ui/BigButton';
import { HostWaiting } from '../components/ui/HostWaiting';
import { cannonConfetti } from '../components/fx/confetti';
import { useSimulatedHost } from '../game/useSimulatedHost';

interface RoundCompleteProps {
  round: number;
  role: Role;
  prompt: Prompt;
  onNextRound: () => void;
  onHome: () => void;
}

export function RoundComplete({ round, role, prompt, onNextRound, onHome }: RoundCompleteProps) {
  const sound = useSound();
  const isHost = role === 'host';

  useEffect(() => {
    sound.win();
    cannonConfetti();
    const again = window.setTimeout(cannonConfetti, 900);
    return () => window.clearTimeout(again);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The host decides when the next round starts; guests follow.
  useSimulatedHost(!isHost, 4000, onNextRound);

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.h2 className="display complete__title" initial={{ scale: 0.2, rotate: 20, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
        TIME'S UP!
      </motion.h2>

      <motion.div className="card complete__card" initial={{ y: 60, opacity: 0, rotate: 3 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 240, damping: 16 }}>
        <span style={{ fontWeight: 700, color: '#7c6f96', fontSize: 18 }}>Round {round} · everyone was acting out</span>
        <motion.span className="complete__prompt" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          {prompt.emoji} {prompt.label}
        </motion.span>
        <span style={{ fontWeight: 600, color: 'var(--pink-deep)', fontSize: 16 }}>Who did it best? Argue amongst yourselves.</span>
      </motion.div>

      <motion.div className="complete__actions" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 14 }}>
        {isHost ? (
          <>
            <BigButton variant="primary" icon="🎡" attention onClick={onNextRound}>
              Next round
            </BigButton>
            <span className="text-white" style={{ fontWeight: 700, marginTop: -6 }}>
              Up next: round {round + 1}
            </span>
          </>
        ) : (
          <HostWaiting text="Waiting for the host to spin again" />
        )}
        <BigButton variant="secondary" icon="🏠" onClick={onHome}>
          {isHost ? 'End party' : 'Leave party'}
        </BigButton>
      </motion.div>
    </motion.div>
  );
}
