import { motion } from 'framer-motion';
import { useSound } from '../../audio/SoundProvider';

export function SoundToggle() {
  const sound = useSound();
  return (
    <motion.button
      type="button"
      className="sound-toggle"
      aria-label={sound.muted ? 'Unmute sounds' : 'Mute sounds'}
      title={sound.muted ? 'Unmute' : 'Mute'}
      whileHover={{ scale: 1.1, rotate: -8 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        sound.toggleMuted();
        if (sound.muted) sound.click();
      }}
    >
      {sound.muted ? '🔇' : '🔊'}
    </motion.button>
  );
}
