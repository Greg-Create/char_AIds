import { motion } from 'framer-motion';

/** "Waiting for the host…" pill shown to guests while the host holds the controls. */
export function HostWaiting({ text }: { text: string }) {
  return (
    <motion.div className="host-wait" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
      <motion.span aria-hidden animate={{ rotate: [-12, 12, -12], y: [0, -3, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-block', fontSize: '1.4em' }}>
        👑
      </motion.span>
      <span>{text}</span>
      <span className="host-wait__dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </motion.div>
  );
}

export function RoleBadge({ role }: { role: 'host' | 'guest' }) {
  return <span className={`role-badge role-badge--${role}`}>{role === 'host' ? '👑 Player 1' : '🎟️ Player 2'}</span>;
}
