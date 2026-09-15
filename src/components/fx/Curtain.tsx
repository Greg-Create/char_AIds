import { AnimatePresence, motion } from 'framer-motion';

/** Full-screen game-show wipe used between major states. */
export function Curtain({ active, label }: { active: boolean; label: string }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="curtain"
          initial={{ clipPath: 'circle(0% at 50% 50%)' }}
          animate={{ clipPath: 'circle(150% at 50% 50%)' }}
          exit={{ clipPath: 'circle(0% at 50% 50%)', transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] } }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="curtain__rays" />
          <motion.div
            className="display curtain__text"
            initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
          >
            {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
