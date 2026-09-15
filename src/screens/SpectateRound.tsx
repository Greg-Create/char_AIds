import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '../api';
import { useSound } from '../audio/SoundProvider';
import { PeerCamera } from '../components/game/Camera';
import { TimerBar, TimerNumber, useRoundTimer } from '../components/game/Countdown';
import { usePeerVideo } from '../game/usePeerVideo';
import { ROUND_SECONDS } from './ActingRound';

interface SpectateRoundProps {
  session: Session;
  turn: 0 | 1;
  startedAt: number;
  endsAt: number;
}

/** The watching player's screen: the other Mac's live camera plus the same countdown. */
export function SpectateRound({ session, turn, startedAt, endsAt }: SpectateRoundProps) {
  const sound = useSound();
  const [pre, setPre] = useState(Math.max(0, Math.ceil((startedAt - Date.now()) / 1000)));
  const [running, setRunning] = useState(Date.now() >= startedAt);
  const [over, setOver] = useState(false);
  const { remoteStream, connectionState } = usePeerVideo(session, null, true, false);

  const handleSecond = useCallback((whole: number) => {
    if (whole <= 3) sound.finalCountdown();
    else sound.countdownTick(whole <= 5);
  }, [sound]);

  const timer = useRoundTimer({ seconds: ROUND_SECONDS, endsAt, running, onSecond: handleSecond, onDone: () => { setOver(true); sound.roundEnd(); } });

  useEffect(() => {
    if (running) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((startedAt - Date.now()) / 1000));
      setPre(remaining);
      if (Date.now() >= startedAt) {
        sound.whoosh();
        setRunning(true);
      }
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, startedAt]);

  const label = !running ? 'get ready' : over ? "time's up" : timer.urgent ? 'HURRY!' : 'seconds';

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
      <div className="acting">
        <div className="acting__header">
          <motion.h2 className="display acting__user" initial={{ y: -60, scale: 0.6, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            PLAYER {turn + 1} IS ACTING
          </motion.h2>
          <span className="role-badge role-badge--guest">👀 Watch. Judge silently.</span>
        </div>

        <motion.div initial={{ scale: 0, rotate: 12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }}>
          <TimerNumber value={running ? timer.whole : pre} label={label} urgent={timer.urgent} dim={!running} />
        </motion.div>

        <div style={{ position: 'relative' }}>
          <PeerCamera stream={remoteStream} state={connectionState} />
          <AnimatePresence>
            {!running && remoteStream && (
              <motion.div className="camera-overlay" style={{ borderRadius: 40 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className={`display camera-overlay__num ${pre === 0 ? 'camera-overlay__num--go' : ''}`}>{pre > 0 ? pre : 'ACT!'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div className="acting__bar" initial={{ scaleX: 0.3, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }}>
          <TimerBar frac={timer.frac} color={timer.color} urgent={timer.urgent} />
        </motion.div>
      </div>
    </motion.div>
  );
}
