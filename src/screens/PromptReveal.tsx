import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { Role } from '../App';
import type { Prompt } from '../data/prompts';
import { useSound } from '../audio/SoundProvider';
import { BigButton } from '../components/ui/BigButton';
import { HostWaiting } from '../components/ui/HostWaiting';
import { burstConfetti, sparkleRain } from '../components/fx/confetti';
import { useSimulatedHost } from '../game/useSimulatedHost';
import { ROUND_SECONDS } from './ActingRound';

interface PromptRevealProps {
  prompt: Prompt;
  role: Role;
  onStart: () => void;
}

export function PromptReveal({ prompt, role, onStart }: PromptRevealProps) {
  const sound = useSound();
  const isHost = role === 'host';

  // Only the host kicks off the round; guests follow when the host does.
  useSimulatedHost(!isHost, 3200, onStart);

  useEffect(() => {
    sound.reveal();
    sparkleRain(1800);
    const burst = window.setTimeout(() => burstConfetti({ y: 0.5, power: 1.4 }), 350);
    return () => window.clearTimeout(burst);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div className="screen" initial={false} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}>
      <div className="reveal">
        <div className="reveal__rays" />
        <motion.div
          className="reveal__card"
          initial={{ scale: 0.4, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 13, mass: 0.9 }}
        >
          <motion.span className="reveal__kicker" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 14 }}>
            Everyone is acting out…
          </motion.span>
          <motion.div className="reveal__emoji" initial={{ scale: 0.3, rotate: -30 }} animate={{ scale: [0.3, 1.2, 1], rotate: [-30, 8, 0] }} transition={{ delay: 0.15, duration: 0.45, ease: 'easeOut' }}>
            {prompt.emoji}
          </motion.div>
          <motion.div className="display reveal__word" initial={{ scale: 0.3, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.35, type: 'spring', stiffness: 380, damping: 12 }}>
            {prompt.label}
          </motion.div>
        </motion.div>

        <motion.div className="reveal__actions" initial={{ y: 60, scale: 0.5 }} animate={{ y: 0, scale: 1 }} transition={{ delay: 0.8, type: 'spring', stiffness: 320, damping: 14 }}>
          {isHost ? (
            <BigButton variant="primary" icon="🎬" attention onClick={onStart}>
              Start acting
            </BigButton>
          ) : (
            <HostWaiting text="Waiting for the host to start" />
          )}
          <span className="text-white reveal__note">Everyone gets {ROUND_SECONDS} seconds. Cameras on. No talking!</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
