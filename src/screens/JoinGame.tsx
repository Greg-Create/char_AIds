import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/ui/BigButton';
import { useSound } from '../audio/SoundProvider';

const CODE_LENGTH = 6;

export function JoinGame({ onJoin, onBack }: { onJoin: (code: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sound = useSound();
  const ready = code.length === CODE_LENGTH;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (ready) onJoin(code);
  };

  return (
    <motion.div className="screen" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
      <motion.div className="card" style={{ maxWidth: 520, width: '100%' }} initial={{ scale: 0.7, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 15 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>🔑</div>
        <h2 className="display" style={{ fontSize: 'clamp(30px, 6vw, 44px)', color: 'var(--purple-deep)', margin: '10px 0 4px' }}>
          Got a game code?
        </h2>
        <p style={{ margin: 0, fontWeight: 600, color: '#7c6f96' }}>Type the 6-letter code your host shared.</p>

        <label className="code-input" htmlFor="code" onClick={() => inputRef.current?.focus()}>
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <motion.span
              key={i}
              className={`code-input__cell ${i === code.length ? 'code-input__cell--active' : ''}`}
              animate={code[i] ? { scale: [1.25, 1], rotate: [8, 0] } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 14 }}
            >
              {code[i] ?? ''}
            </motion.span>
          ))}
        </label>
        <input
          id="code"
          ref={inputRef}
          className="sr-input"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => {
            const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
            if (next.length > code.length) sound.hover();
            setCode(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <div className="stack">
          <BigButton variant="primary" icon="🚀" disabled={!ready} style={{ opacity: ready ? 1 : 0.55 }} onClick={submit}>
            Join
          </BigButton>
          <button type="button" className="link-btn" style={{ color: 'var(--purple-deep)', textShadow: 'none' }} onClick={() => { sound.click(); onBack(); }}>
            ← Back home
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
