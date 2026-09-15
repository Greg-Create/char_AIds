import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as synth from './synth';

interface SoundApi {
  muted: boolean;
  toggleMuted: () => void;
  click: () => void;
  hover: () => void;
  whoosh: () => void;
  wheel: {
    start: () => void;
    update: (speed: number) => void;
    stop: () => void;
    tick: (speed: number) => void;
    land: () => void;
  };
  reveal: () => void;
  countdownTick: (urgent: boolean) => void;
  finalCountdown: () => void;
  roundEnd: () => void;
  win: () => void;
  confetti: () => void;
}

const SoundContext = createContext<SoundApi | null>(null);
const STORAGE_KEY = 'char-aids:muted';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    synth.setMuted(muted);
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [muted]);

  // Unlock the AudioContext on the first gesture anywhere on the page.
  useEffect(() => {
    const unlock = () => synth.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleMuted = useCallback(() => setMuted((m) => !m), []);

  const api = useMemo<SoundApi>(
    () => ({
      muted,
      toggleMuted,
      click: synth.sfxClick,
      hover: synth.sfxHover,
      whoosh: synth.sfxWhoosh,
      wheel: {
        start: synth.startSpin,
        update: synth.updateSpin,
        stop: synth.stopSpin,
        tick: synth.sfxWheelTick,
        land: synth.sfxWheelLand,
      },
      reveal: synth.sfxReveal,
      countdownTick: synth.sfxCountdownTick,
      finalCountdown: synth.sfxFinalCountdown,
      roundEnd: synth.sfxRoundEnd,
      win: synth.sfxWin,
      confetti: synth.sfxConfetti,
    }),
    [muted, toggleMuted],
  );

  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundApi {
  const api = useContext(SoundContext);
  if (!api) throw new Error('useSound must be used inside <SoundProvider>');
  return api;
}
