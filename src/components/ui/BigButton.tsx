import { motion, type HTMLMotionProps } from 'framer-motion';
import { useSound } from '../../audio/SoundProvider';

type Variant = 'primary' | 'secondary' | 'pink';

interface BigButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: string;
  children: React.ReactNode;
  /** Idle wiggle + sparkles to draw the eye (use on the main CTA only). */
  attention?: boolean;
}

export function BigButton({ variant = 'secondary', size = 'md', icon, children, attention, onClick, className = '', ...rest }: BigButtonProps) {
  const sound = useSound();

  const button = (
    <motion.button
      type="button"
      className={`btn btn--${variant} ${size === 'sm' ? 'btn--sm' : ''} ${className}`}
      whileHover={{ scale: 1.07, rotate: -1.5 }}
      whileTap={{ scale: 0.93, rotate: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      onHoverStart={() => sound.hover()}
      onClick={(e) => {
        sound.click();
        onClick?.(e);
      }}
      {...rest}
    >
      <span className="btn__shine" />
      {icon && <span aria-hidden>{icon}</span>}
      <span>{children}</span>
      {attention && (
        <>
          <motion.span className="btn__sparkle" style={{ top: -14, right: -6 }} animate={{ scale: [0.6, 1.2, 0.6], rotate: [0, 40, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
            ✨
          </motion.span>
          <motion.span className="btn__sparkle" style={{ bottom: -12, left: -10 }} animate={{ scale: [1, 0.5, 1], rotate: [0, -40, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            ⭐
          </motion.span>
        </>
      )}
    </motion.button>
  );

  if (!attention) return button;

  return (
    <motion.span
      style={{ display: 'inline-block' }}
      animate={{ scale: [1, 1.045, 1], rotate: [0, -1.5, 1.5, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' }}
    >
      {button}
    </motion.span>
  );
}
