import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundProvider, useSound } from './audio/SoundProvider';
import { gameApi, type RoomView, type Session } from './api';
import { Background } from './components/fx/Background';
import { Curtain } from './components/fx/Curtain';
import { SoundToggle } from './components/ui/SoundToggle';
import { PROMPTS } from './data/prompts';
import { ActingRound } from './screens/ActingRound';
import { Home } from './screens/Home';
import { Judging } from './screens/Judging';
import { Lobby } from './screens/Lobby';
import { PromptReveal } from './screens/PromptReveal';
import { RoundComplete } from './screens/RoundComplete';
import { SpectateRound } from './screens/SpectateRound';
import { WheelSpin } from './screens/WheelSpin';

/**
 * Local two-Mac flow. The API on the host Mac owns the room, prompt, turn and
 * clock; both browsers poll it. Player 1 (host) spins and starts; player 1 acts
 * first while player 2 watches, then they swap, then Gemini judges.
 */
type Screen = 'home' | 'lobby' | 'wheel' | 'reveal' | 'acting' | 'spectate' | 'judging' | 'complete';
export type Role = 'host' | 'guest';

const SESSION_KEY = 'char-aids-session';
const CURTAIN_COVER_MS = 520;
const CURTAIN_TOTAL_MS = 1050;

function savedSession(): Session | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as Session) : null;
  } catch {
    return null;
  }
}

function screenForRoom(room: RoomView): Screen {
  if (room.status === 'lobby') return 'lobby';
  if (room.status === 'wheel') return 'wheel';
  if (room.status === 'reveal') return 'reveal';
  if (room.status === 'round') return room.youAreActor ? 'acting' : 'spectate';
  if (room.status === 'result') return 'complete';
  return 'judging';
}

function curtainLabel(next: Screen, room: RoomView): string | null {
  if (next === 'wheel') return room.roundNumber > 1 ? 'REMATCH!' : "LET'S PLAY!";
  if (next === 'acting') return 'YOUR TURN!';
  if (next === 'spectate') return `PLAYER ${room.turn + 1} ACTS!`;
  if (next === 'complete') return 'VERDICT!';
  return null;
}

async function waitForResult(session: Session, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let latest = await gameApi.getRoom(session);
  while (!latest.result && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    latest = await gameApi.getRoom(session);
  }
  return latest;
}

function Game() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session | null>(() => savedSession());
  const [room, setRoom] = useState<RoomView | null>(null);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [judgingNote, setJudgingNote] = useState('');
  const [curtain, setCurtain] = useState({ active: false, label: '' });
  const timers = useRef<number[]>([]);
  const screenRef = useRef<Screen>('home');
  screenRef.current = screen;
  const latestRoom = useRef<RoomView | null>(null);
  const wheelBusy = useRef(false);
  const finishing = useRef(false);
  const sound = useSound();

  const wipeTo = useCallback((next: Screen, label: string) => {
    timers.current.forEach(window.clearTimeout);
    sound.whoosh();
    setCurtain({ active: true, label });
    timers.current = [
      window.setTimeout(() => setScreen(next), CURTAIN_COVER_MS),
      window.setTimeout(() => setCurtain((current) => ({ ...current, active: false })), CURTAIN_TOTAL_MS),
    ];
  }, [sound]);

  /** Move to whatever screen the room state implies, with a curtain on the big beats. */
  const showRoom = useCallback((nextRoom: RoomView) => {
    const next = screenForRoom(nextRoom);
    if (next === screenRef.current) return;
    const label = curtainLabel(next, nextRoom);
    if (label) wipeTo(next, label);
    else setScreen(next);
  }, [wipeTo]);

  const acceptRoom = useCallback((nextRoom: RoomView) => {
    latestRoom.current = nextRoom;
    setRoom(nextRoom);
    if (finishing.current) return; // uploading / judging: don't flip screens underneath
    if (wheelBusy.current && nextRoom.status !== 'wheel') return; // let the wheel land first
    showRoom(nextRoom);
  }, [showRoom]);

  const rememberSession = (nextSession: Session) => {
    setSession(nextSession);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    latestRoom.current = null;
  };

  useEffect(() => {
    void gameApi.health().then((health) => setLanUrls(health.lanUrls)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let initialized = false;
    const refresh = async () => {
      try {
        const nextRoom = await gameApi.getRoom(session);
        initialized = true;
        if (active) acceptRoom(nextRoom);
      } catch (refreshError) {
        if (active && !initialized) {
          clearSession();
          setScreen('home');
          setError(refreshError instanceof Error ? refreshError.message : 'That game is no longer available.');
        } else if (active && refreshError instanceof Error && refreshError.message === 'ROOM_NOT_FOUND') {
          clearSession();
          setScreen('home');
          setError('Player 1 left the game.');
        }
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptRoom, session]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const play = () => void run(async () => {
    const nextSession = await gameApi.pair();
    rememberSession(nextSession);
    const nextRoom = await gameApi.getRoom(nextSession);
    latestRoom.current = nextRoom;
    setRoom(nextRoom);
    wipeTo('lobby', nextSession.role === 'host' ? 'PLAYER 1!' : 'PLAYER 2!');
  });

  const readyUp = () => void run(async () => {
    if (!session) return;
    const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    camera.getTracks().forEach((track) => track.stop());
    acceptRoom(await gameApi.ready(session, consent));
  });

  const startRound = () => void run(async () => {
    if (!session) return;
    acceptRoom(await gameApi.start(session));
  });

  const enterWheel = () => {
    wheelBusy.current = true;
  };

  const wheelLanded = () => void run(async () => {
    wheelBusy.current = false;
    if (!session) return;
    if (session.role === 'host') {
      acceptRoom(await gameApi.advance(session, 'reveal'));
    } else if (latestRoom.current) {
      acceptRoom(latestRoom.current);
    }
  });

  const beginActing = () => void run(async () => {
    if (!session || session.role !== 'host') return;
    acceptRoom(await gameApi.advance(session, 'round'));
  });

  const playAgain = () => void run(async () => {
    if (!session) return;
    acceptRoom(await gameApi.start(session));
  });

  /** The actor's turn ended: store the clip, hand over, and judge after the second turn. */
  const finishTurn = (clip: Blob | null) => {
    if (!session) return;
    finishing.current = true;
    setJudgingNote('Saving your performance');
    setScreen('judging');
    void (async () => {
      try {
        if (clip) await gameApi.uploadClip(session, clip).catch(() => undefined);
        const view = await gameApi.finish(session);
        if (view.status === 'judging') {
          setJudgingNote('Gemini is comparing both performances');
          try {
            await gameApi.judge(session);
          } catch {
            // Slow verdict: fall through to polling below.
          }
          const final = await waitForResult(session);
          finishing.current = false;
          acceptRoom(final);
          if (!final.result) setError('Judging failed. Try a rematch.');
        } else {
          finishing.current = false;
          acceptRoom(view);
        }
      } catch (finishError) {
        finishing.current = false;
        setError(finishError instanceof Error ? finishError.message : 'Could not finish the turn.');
      }
    })();
  };

  const goHome = () => {
    if (session) void gameApi.leave(session).catch(() => undefined);
    clearSession();
    setError('');
    setConsent(false);
    wheelBusy.current = false;
    finishing.current = false;
    setScreen('home');
  };

  const promptIndex = room?.prompt ? PROMPTS.findIndex((item) => item.label === room.prompt) : 0;
  const safePromptIndex = promptIndex >= 0 ? promptIndex : 0;
  const prompt = PROMPTS[safePromptIndex];
  const roundKey = room ? `${room.roundNumber}-${room.turn}` : '0';

  return (
    <div className="app">
      <Background variant={screen === 'home' ? 'video' : 'gradient'} />
      <SoundToggle />
      {error && (
        <div className="host-wait app__error" role="alert" onClick={() => setError('')}>
          ⚠️ {error}
        </div>
      )}
      <AnimatePresence mode="wait">
        {screen === 'home' && <Home key="home" onStart={play} busy={busy} />}
        {screen === 'lobby' && session && room && (
          <Lobby key="lobby" role={session.role} room={room} playerId={session.playerId} lanUrls={lanUrls} consent={consent} busy={busy} onConsent={setConsent} onReady={readyUp} onStart={startRound} onHome={goHome} />
        )}
        {screen === 'wheel' && session && room && (
          <WheelSpin key={`wheel-${room.roundNumber}`} prompts={PROMPTS} targetIndex={safePromptIndex} role={session.role} onSpinStart={enterWheel} onLanded={wheelLanded} />
        )}
        {screen === 'reveal' && session && room && (
          <PromptReveal key={`reveal-${room.roundNumber}`} prompt={prompt} role={session.role} onStart={beginActing} />
        )}
        {screen === 'acting' && session && room?.startedAt && room.endsAt && (
          <ActingRound key={`acting-${roundKey}`} prompt={prompt} session={session} turn={room.turn} startedAt={room.startedAt} endsAt={room.endsAt} onDone={finishTurn} />
        )}
        {screen === 'spectate' && session && room?.startedAt && room.endsAt && (
          <SpectateRound key={`spectate-${roundKey}`} session={session} turn={room.turn} startedAt={room.startedAt} endsAt={room.endsAt} />
        )}
        {screen === 'judging' && <Judging key="judging" note={judgingNote || 'Gemini is comparing both performances'} />}
        {screen === 'complete' && session && room?.result && (
          <RoundComplete key={`complete-${room.roundNumber}`} role={session.role} prompt={prompt} result={room.result} onPlayAgain={playAgain} onHome={goHome} />
        )}
      </AnimatePresence>
      <Curtain active={curtain.active} label={curtain.label} />
    </div>
  );
}

export default function App() {
  return <SoundProvider><Game /></SoundProvider>;
}
