import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export function timerColor(frac: number) {
  if (frac > 0.6) return '#4ade80';
  if (frac > 0.4) return '#ffd93d';
  if (frac > 0.2) return '#ff8a3d';
  return '#ff4d6d';
}

interface RoundTimerOptions {
  seconds: number;
  /** The clock only runs while this is true. */
  running: boolean;
  onSecond?: (remainingWhole: number) => void;
  onDone?: () => void;
}

/** Honest round clock driven by performance.now(), so it survives jank and background tabs. */
export function useRoundTimer({ seconds, running, onSecond, onDone }: RoundTimerOptions) {
  const [remaining, setRemaining] = useState(seconds);
  const onSecondRef = useRef(onSecond);
  onSecondRef.current = onSecond;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let lastWhole = seconds;
    let raf = 0;
    let done = false;
    const loop = () => {
      const rem = Math.max(0, seconds - (performance.now() - start) / 1000);
      setRemaining(rem);
      const whole = Math.ceil(rem);
      if (whole !== lastWhole) {
        lastWhole = whole;
        if (whole > 0) onSecondRef.current?.(whole);
      }
      if (rem <= 0) {
        if (!done) {
          done = true;
          onDoneRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, seconds]);

  const frac = remaining / seconds;
  return {
    remaining,
    whole: Math.ceil(remaining),
    frac,
    urgent: running && remaining <= 5 && remaining > 0,
    color: timerColor(frac),
  };
}

interface TimerNumberProps {
  value: number;
  label: string;
  urgent?: boolean;
  dim?: boolean;
}

/** Big bouncing number shown above the camera. */
export function TimerNumber({ value, label, urgent, dim }: TimerNumberProps) {
  return (
    <div className={`timer-number ${urgent ? 'timer-number--urgent' : ''} ${dim ? 'timer-number--dim' : ''}`} role="timer" aria-live="off" aria-label={`${value} seconds`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="display timer-number__value"
          initial={{ scale: 1.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="timer-number__label">{label}</span>
    </div>
  );
}

interface TimerBarProps {
  frac: number;
  color: string;
  urgent?: boolean;
}

/** Horizontal draining bar shown below the camera. */
export function TimerBar({ frac, color, urgent }: TimerBarProps) {
  return (
    <div className={`timer-bar ${urgent ? 'timer-bar--urgent' : ''}`} style={{ color }} aria-hidden>
      <div className="timer-bar__fill" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />
      <div className="timer-bar__gloss" />
    </div>
  );
}
