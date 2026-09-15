import { motion } from 'framer-motion';
import { HostWaiting } from '../components/ui/HostWaiting';

export function Judging({ note }: { note?: string }) {
  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="card" style={{ maxWidth: 620, width: '100%' }}>
        <motion.div style={{ fontSize: 64, lineHeight: 1 }} animate={{ rotate: [-8, 8, -8], y: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>🤖</motion.div>
        <h2 className="display" style={{ color: 'var(--purple-deep)', margin: '10px 0 14px', fontSize: 'clamp(28px, 6vw, 44px)' }}>Hold on…</h2>
        <HostWaiting text={note || 'Gemini is comparing both performances'} />
      </div>
    </motion.div>
  );
}
