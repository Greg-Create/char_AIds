import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '../App';
import type { Prompt } from '../data/prompts';
import { useSound } from '../audio/SoundProvider';
import { Camera } from '../components/game/Camera';
import { RoleBadge } from '../components/ui/HostWaiting';
import { TimerBar, TimerNumber, useRoundTimer } from '../components/game/Countdown';
import { burstConfetti } from '../components/fx/confetti';

export const ROUND_SECONDS = 15;
const PREROLL_FROM = 3;

type Stage = 'camera' | 'preroll' | 'acting' | 'over';

interface ActingRoundProps {
  role: Role;
  prompt: Prompt;
  onDone: () => void;
}


export function ActingRound({ role, prompt, onDone }: ActingRoundProps) {
  const sound = useSound();
  const [stage, setStage] = useState<Stage>('camera');
  const [pre, setPre] = useState(PREROLL_FROM); // 3, 2, 1, then 0 = ACT!
  const [peek, setPeek] = useState(false);
  const [flash, setFlash] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const handleSecond = useCallback(
    (whole: number) => {
      if (whole <= 3) sound.finalCountdown();
      else sound.countdownTick(whole <= 5);
    },
    [sound],
  );

  const handleDone = useCallback(() => {
    setStage('over');
    setFlash(true);
    sound.roundEnd();
    burstConfetti({ y: 0.35, power: 0.8 });
    window.setTimeout(() => setFlash(false), 220);
    window.setTimeout(() => onDoneRef.current(), 1100);
  }, [sound]);

  const timer = useRoundTimer({ seconds: ROUND_SECONDS, running: stage === 'acting', onSecond: handleSecond, onDone: handleDone });

  // 3 → 2 → 1 → ACT! once the camera has answered.
  useEffect(() => {
    if (stage !== 'preroll') return;
    if (pre > 0) sound.countdownTick(true);
    else sound.whoosh();
    const t = window.setTimeout(
      () => {
        if (pre > 0) setPre(pre - 1);
        else setStage('acting');
      },
      pre > 0 ? 900 : 750,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, pre]);

  const timerLabel = stage === 'camera' ? 'waiting for camera' : stage === 'preroll' ? 'get ready' : stage === 'over' ? "time's up" : timer.urgent ? 'HURRY!' : 'seconds';

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
      <AnimatePresence>{flash && <motion.div className="flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />}</AnimatePresence>

      <div className="acting">
        <div className="acting__header">
          <motion.h2 className="display acting__user" initial={{ y: -60, scale: 0.6, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            SHOWTIME!
          </motion.h2>
          <RoleBadge role={role} />
        </div>

        <motion.div initial={{ scale: 0, rotate: 12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }}>
          <TimerNumber value={timer.whole} label={timerLabel} urgent={timer.urgent} dim={stage === 'camera' || stage === 'preroll'} />
        </motion.div>

        <Camera onReady={() => setStage((s) => (s === 'camera' ? 'preroll' : s))}>
          <AnimatePresence>
            {stage === 'preroll' && (
              <motion.div className="camera-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={pre}
                    className={`display camera-overlay__num ${pre === 0 ? 'camera-overlay__num--go' : ''}`}
                    initial={{ scale: 0.2, rotate: -20, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 1.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 13 }}
                  >
                    {pre > 0 ? pre : 'ACT!'}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </Camera>

        <motion.div className="acting__bar" initial={{ scaleX: 0.3, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.35 }}>
          <TimerBar frac={timer.frac} color={timer.color} urgent={timer.urgent} />
        </motion.div>

        <motion.button
          type="button"
          className={`peek ${peek ? 'peek--open' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.96 }}
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onPointerCancel={() => setPeek(false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Hold to peek at your prompt"
        >
          <span aria-hidden>🤫</span>
          <span className="peek__secret">
            {prompt.emoji} {prompt.label}
          </span>
          <span className="peek__hint">hold to peek</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
