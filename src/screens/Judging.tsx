import { motion } from 'framer-motion';
import { HostWaiting } from '../components/ui/HostWaiting';

export function Judging({ note }: { note?: string }) {
  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="card" style={{ maxWidth: 620, width: '100%' }}>
        <div style={{ fontSize: 56 }}>🤖</div>
        <h2 className="display" style={{ color: 'var(--purple-deep)', marginBottom: 4 }}>Gemini is judging</h2>
        <HostWaiting text={note || 'Comparing the performances'} />
      </div>
    </motion.div>
  );
}
