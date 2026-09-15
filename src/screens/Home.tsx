import { motion } from 'framer-motion';
import { BigButton } from '../components/ui/BigButton';

const TITLE = 'charAIds';
const LETTER_COLORS = ['#ffd93d', '#ff6bb5', '#38bdf8', '#4ade80', '#ffffff', '#ff8a3d', '#a78bfa', '#ffd93d', '#ff6bb5'];

export function Home({ onStart, onJoin }: { onStart: () => void; onJoin: () => void }) {
  return (
    <motion.div className="screen screen--home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }}>
      <motion.div
        className="speech-bubble home__bubble"
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: [-2, 2, -2], y: [0, -5, 0] }}
        transition={{ scale: { type: 'spring', stiffness: 300, damping: 14, delay: 0.5 }, rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
      >
        🎭 Let's play charades!
      </motion.div>

      <div className="home__hero">
      <h1 className="display home__title" aria-label={TITLE}>
        {TITLE.split('').map((ch, i) => (
          <motion.span
            key={i}
            aria-hidden
            style={{ color: LETTER_COLORS[i % LETTER_COLORS.length] }}
            initial={{ y: 90, opacity: 0, rotate: -25, scale: 0.4 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            transition={{ delay: 0.08 * i, type: 'spring', stiffness: 320, damping: 13 }}
          >
            <motion.span
              style={{ display: 'inline-block' }}
              animate={{ y: [0, -14, 0], rotate: [0, i % 2 ? 4 : -4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 1 + i * 0.12, ease: 'easeInOut' }}
            >
              {ch}
            </motion.span>
          </motion.span>
        ))}
      </h1>

      <motion.p className="home__tagline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: 'spring', stiffness: 200, damping: 16 }}>
        Act it out. Guess it. Lose your dignity.
      </motion.p>
      </div>

      <motion.div className="home__actions" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1, type: 'spring', stiffness: 260, damping: 14 }}>
        <BigButton variant="primary" icon="🎉" attention onClick={onStart}>
          Play
        </BigButton>
        <BigButton variant="secondary" icon="🔑" onClick={onJoin}>
          Join Game
        </BigButton>
      </motion.div>

      <motion.p className="home__hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
        Grab your friends. The host spins, everyone acts, the room judges.
      </motion.p>
    </motion.div>
  );
}
