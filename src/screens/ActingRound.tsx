import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gameApi, type Session } from '../api';
import type { Prompt } from '../data/prompts';
import { useSound } from '../audio/SoundProvider';
import { Camera } from '../components/game/Camera';
import { TimerBar, TimerNumber, useRoundTimer } from '../components/game/Countdown';
import { burstConfetti } from '../components/fx/confetti';
import { startRoundCapture, type RoundCapture } from '../game/recordRound';
import { usePeerVideo } from '../game/usePeerVideo';

export const ROUND_SECONDS = 15;

type Stage = 'camera' | 'preroll' | 'acting' | 'over';

interface ActingRoundProps {
  prompt: Prompt;
  session: Session;
  turn: 0 | 1;
  startedAt: number;
  endsAt: number;
  onDone: (clip: Blob | null) => void;
}

/** The acting player's screen: camera, countdown, recording, live feed to the other Mac. */
export function ActingRound({ prompt, session, turn, startedAt, endsAt, onDone }: ActingRoundProps) {
  const sound = useSound();
  const [stage, setStage] = useState<Stage>('camera');
  const [pre, setPre] = useState(Math.max(0, Math.ceil((startedAt - Date.now()) / 1000)));
  const [peek, setPeek] = useState(false);
  const [flash, setFlash] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [captureError, setCaptureError] = useState('');
  const captureRef = useRef<RoundCapture | null>(null);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  usePeerVideo(session, localStream, true, true);

  const handleSecond = useCallback((whole: number) => {
    if (whole <= 3) sound.finalCountdown();
    else sound.countdownTick(whole <= 5);
  }, [sound]);

  const handleDone = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setStage('over');
    setFlash(true);
    sound.roundEnd();
    burstConfetti({ y: 0.35, power: 0.8 });
    window.setTimeout(() => setFlash(false), 220);
    void (async () => {
      try {
        const result = captureRef.current ? await captureRef.current.stop() : null;
        onDoneRef.current(result?.clip ?? null);
      } catch (error) {
        setCaptureError(error instanceof Error ? error.message : 'Recording failed');
        onDoneRef.current(null);
      }
    })();
  }, [sound]);

  const timer = useRoundTimer({ seconds: ROUND_SECONDS, endsAt, running: stage === 'acting', onSecond: handleSecond, onDone: handleDone });

  // Pre-roll is driven by the server's start time so both Macs agree.
  useEffect(() => {
    if (stage !== 'preroll') return;
    let lastWhole = pre;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((startedAt - Date.now()) / 1000));
      setPre(remaining);
      if (remaining !== lastWhole && remaining > 0) sound.countdownTick(true);
      lastWhole = remaining;
      if (Date.now() >= startedAt) {
        sound.whoosh();
        setStage('acting');
      }
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, startedAt]);

  useEffect(() => {
    if (stage !== 'acting' || !localStream || captureRef.current) return;
    try {
      captureRef.current = startRoundCapture(
        localStream,
        (segment, index) => gameApi.uploadSegment(session, segment, index),
        (error) => setCaptureError(`A live video window failed: ${error.message}`),
      );
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Recording is unavailable');
    }
  }, [localStream, session, stage]);

  useEffect(() => () => {
    if (captureRef.current && !finishedRef.current) void captureRef.current.stop();
  }, []);

  const timerLabel = stage === 'camera' ? 'waiting for camera' : stage === 'preroll' ? 'get ready' : stage === 'over' ? "time's up" : timer.urgent ? 'HURRY!' : 'seconds';

  return (
    <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
      <AnimatePresence>{flash && <motion.div className="flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />}</AnimatePresence>
      <div className="acting">
        <div className="acting__header">
          <motion.h2 className="display acting__user" initial={{ y: -60, scale: 0.6, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            YOUR TURN!
          </motion.h2>
          <span className="role-badge role-badge--host">🎬 Player {turn + 1}</span>
        </div>

        <motion.div initial={{ scale: 0, rotate: 12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }}>
          <TimerNumber value={stage === 'preroll' ? pre : timer.whole} label={timerLabel} urgent={timer.urgent} dim={stage === 'camera'} />
        </motion.div>

        <Camera onStream={setLocalStream} onReady={() => setStage((current) => (current === 'camera' ? 'preroll' : current))}>
          <AnimatePresence>
            {stage === 'preroll' && (
              <motion.div className="camera-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className={`display camera-overlay__num ${pre === 0 ? 'camera-overlay__num--go' : ''}`}>{pre > 0 ? pre : 'ACT!'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Camera>

        <motion.div className="acting__bar" initial={{ scaleX: 0.3, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }}>
          <TimerBar frac={timer.frac} color={timer.color} urgent={timer.urgent} />
        </motion.div>

        {captureError && <span className="text-white" role="status">{captureError}</span>}

        <motion.button
          type="button"
          className={`peek ${peek ? 'peek--open' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.96 }}
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onPointerCancel={() => setPeek(false)}
          onContextMenu={(event) => event.preventDefault()}
          aria-label="Hold to peek at your prompt"
        >
          <span aria-hidden>🤫</span>
          <span className="peek__secret">{prompt.emoji} {prompt.label}</span>
          <span className="peek__hint">hold to peek</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
