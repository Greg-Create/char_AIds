import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { Role } from '../App';
import type { JudgeResult } from '../api';
import type { Prompt } from '../data/prompts';
import { useSound } from '../audio/SoundProvider';
import { BigButton } from '../components/ui/BigButton';
import { HostWaiting } from '../components/ui/HostWaiting';
import { cannonConfetti } from '../components/fx/confetti';

interface RoundCompleteProps {
  role: Role;
  prompt: Prompt;
  result: JudgeResult;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function RoundComplete({ role, prompt, result, onPlayAgain, onHome }: RoundCompleteProps) {
  const sound = useSound();
  const won = result.winnerId === 'you';

  useEffect(() => {
    if (won) {
      sound.win();
      cannonConfetti();
      const again = window.setTimeout(cannonConfetti, 900);
      return () => window.clearTimeout(again);
    }
    sound.roundEnd();
    return undefined;
  }, [sound, won]);

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.h2 className="display complete__title" style={won ? undefined : { color: 'var(--blue)' }} initial={{ scale: 0.2, rotate: 20, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
        {won ? 'YOU WIN!' : 'YOU LOSE!'}
      </motion.h2>

      <motion.div className="card complete__card" initial={{ y: 60, opacity: 0, rotate: 3 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 240, damping: 16 }}>
        <span style={{ fontWeight: 700, color: '#7c6f96', fontSize: 18 }}>You both acted out {prompt.emoji} {prompt.label}</span>
        <motion.span className="complete__prompt" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          {result.youScore} – {result.opponentScore}
        </motion.span>
        <span style={{ fontWeight: 600, color: 'var(--pink-deep)', fontSize: 16 }}>🤖 {result.verdict}</span>
        {result.postStatus !== 'disabled' && (
          <span style={{ fontWeight: 600, color: '#7c6f96', fontSize: 14 }}>
            {result.postStatus === 'posted' ? 'The losing clip was posted.' : result.postStatus === 'failed' ? 'The X post failed.' : 'Publishing the losing clip…'}
          </span>
        )}
        {result.postUrl && <a href={result.postUrl} target="_blank" rel="noreferrer">Open the X post</a>}
      </motion.div>

      <motion.div className="complete__actions" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 14 }}>
        {role === 'host' ? (
          <BigButton variant="primary" icon="🎡" attention onClick={onPlayAgain}>Play again</BigButton>
        ) : (
          <HostWaiting text="Player 1 can start a rematch" />
        )}
        <BigButton variant="secondary" icon="🏠" onClick={onHome}>Back home</BigButton>
      </motion.div>
    </motion.div>
  );
}
