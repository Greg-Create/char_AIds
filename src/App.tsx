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
import { JoinGame } from './screens/JoinGame';
import { Judging } from './screens/Judging';
import { Lobby } from './screens/Lobby';
import { PromptReveal } from './screens/PromptReveal';
import { RoundComplete } from './screens/RoundComplete';
import { WheelSpin } from './screens/WheelSpin';

type Screen = 'home' | 'join' | 'lobby' | 'wheel' | 'reveal' | 'acting' | 'judging' | 'complete';
export type Role = 'host' | 'guest';

const SESSION_KEY = 'char-aids-session';
const CURTAIN_COVER_MS = 520;
const CURTAIN_TOTAL_MS = 1050;

function savedSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    return null;
  }
}

function screenForRoom(room: RoomView): Screen {
  if (room.status === 'lobby') return 'lobby';
  if (room.status === 'wheel') return 'wheel';
  if (room.status === 'reveal') return 'reveal';
  if (room.status === 'round') return 'acting';
  if (room.status === 'result') return 'complete';
  return 'judging';
}

async function waitForResult(session: Session, timeoutMs = 3200) {
  const deadline = Date.now() + timeoutMs;
  let latest = await gameApi.getRoom(session);
  while (!latest.result && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    latest = await gameApi.getRoom(session);
  }
  return latest;
}

function Game() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session | null>(() => savedSession());
  const [room, setRoom] = useState<RoomView | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [judgingNote, setJudgingNote] = useState('');
  const [directClipUpload, setDirectClipUpload] = useState(false);
  const [curtain, setCurtain] = useState({ active: false, label: '' });
  const timers = useRef<number[]>([]);
  const publishing = useRef(false);
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

  const acceptRoom = useCallback((nextRoom: RoomView) => {
    setRoom(nextRoom);
    if (finishing.current && nextRoom.status === 'round') return;
    if (nextRoom.status === 'result') finishing.current = false;
    const nextScreen = screenForRoom(nextRoom);
    setScreen(nextScreen);
  }, []);

  const rememberSession = (nextSession: Session) => {
    setSession(nextSession);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  };

  useEffect(() => {
    void gameApi.health().then((health) => setDirectClipUpload(health.directClipUpload)).catch(() => undefined);
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
          localStorage.removeItem(SESSION_KEY);
          setSession(null);
          setScreen('home');
          setError(refreshError instanceof Error ? refreshError.message : 'That room is no longer available.');
        }
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [acceptRoom, session]);

  useEffect(() => {
    if (!session || session.role !== 'host' || !room?.result || room.result.postStatus !== 'queued') return;
    if (!room.players.every((player) => player.clipReady) || publishing.current) return;
    publishing.current = true;
    void gameApi.publish(session)
      .then(() => gameApi.getRoom(session))
      .then((nextRoom) => acceptRoom(nextRoom))
      .catch((publishError) => setError(publishError instanceof Error ? publishError.message : 'The X post failed.'))
      .finally(() => { publishing.current = false; });
  }, [acceptRoom, room, session]);

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

  const startGame = () => void run(async () => {
    const nextSession = await gameApi.createRoom();
    rememberSession(nextSession);
    const nextRoom = await gameApi.getRoom(nextSession);
    setRoom(nextRoom);
    wipeTo('lobby', 'ROOM READY!');
  });

  const joinGame = (code: string) => void run(async () => {
    const nextSession = await gameApi.joinRoom(code);
    rememberSession(nextSession);
    const nextRoom = await gameApi.getRoom(nextSession);
    setRoom(nextRoom);
    wipeTo('lobby', 'YOU’RE IN!');
  });

  const readyUp = () => void run(async () => {
    if (!session) return;
    const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    camera.getTracks().forEach((track) => track.stop());
    acceptRoom(await gameApi.ready(session, consent));
  });

  const startRound = () => void run(async () => {
    if (!session) return;
    const nextRoom = await gameApi.start(session);
    setRoom(nextRoom);
    wipeTo('wheel', `ROUND ${nextRoom.roundNumber}!`);
  });

  const revealPrompt = () => void run(async () => {
    if (!session || session.role !== 'host') return;
    acceptRoom(await gameApi.advance(session, 'reveal'));
  });

  const beginActing = () => void run(async () => {
    if (!session || session.role !== 'host') return;
    acceptRoom(await gameApi.advance(session, 'round'));
  });

  const playAgain = () => void run(async () => {
    if (session) await gameApi.leave(session).catch(() => undefined);
    const nextSession = await gameApi.createRoom();
    rememberSession(nextSession);
    setConsent(false);
    const nextRoom = await gameApi.getRoom(nextSession);
    setRoom(nextRoom);
    wipeTo('lobby', 'AGAIN!');
  });

  const finishRound = (clip: Blob | null) => {
    if (!session) return;
    finishing.current = true;
    setScreen('judging');
    setJudgingNote('Returning the verdict within three seconds');
    if (clip) {
      void gameApi.uploadClip(session, clip, directClipUpload)
        .then((nextRoom) => acceptRoom(nextRoom))
        .catch((uploadError) => setError(uploadError instanceof Error ? uploadError.message : 'The full recording could not be stored.'));
    }
    void gameApi.judge(session)
      .then((result) => {
        finishing.current = false;
        setRoom((current) => current ? { ...current, status: 'result', result } : current);
        wipeTo('complete', 'VERDICT!');
      })
      .catch(async (judgeError) => {
        setJudgingNote('The request timed out; checking the server result');
        try {
          const nextRoom = await waitForResult(session);
          acceptRoom(nextRoom);
          if (!nextRoom.result) throw judgeError;
        } catch (finalError) {
          setError(finalError instanceof Error ? finalError.message : 'Judging failed.');
        }
      });
  };

  const goHome = () => {
    if (session) void gameApi.leave(session).catch(() => undefined);
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setError('');
    setScreen('home');
  };

  const promptIndex = room?.prompt ? PROMPTS.findIndex((item) => item.label === room.prompt) : 0;
  const safePromptIndex = promptIndex >= 0 ? promptIndex : 0;
  const prompt = PROMPTS[safePromptIndex];

  return (
    <div className="app">
      <Background variant={screen === 'home' || screen === 'join' ? 'video' : 'gradient'} />
      <SoundToggle />
      {error && <div className="host-wait" role="alert">⚠️ {error}</div>}
      <AnimatePresence mode="wait">
        {screen === 'home' && <Home key="home" onStart={startGame} onJoin={() => setScreen('join')} />}
        {screen === 'join' && <JoinGame key="join" onJoin={joinGame} onBack={goHome} />}
        {screen === 'lobby' && session && room && (
          <Lobby key="lobby" role={session.role} room={room} playerId={session.playerId} consent={consent} busy={busy} onConsent={setConsent} onReady={readyUp} onStart={startRound} onHome={goHome} />
        )}
        {screen === 'wheel' && session && room && (
          <WheelSpin key={`wheel-${room.roundNumber}`} prompts={PROMPTS} targetIndex={safePromptIndex} code={room.roomCode} role={session.role} onLanded={revealPrompt} />
        )}
        {screen === 'reveal' && session && room && (
          <PromptReveal key={`reveal-${room.roundNumber}`} prompt={prompt} role={session.role} onStart={beginActing} />
        )}
        {screen === 'acting' && session && room?.startedAt && room.endsAt && (
          <ActingRound key={`acting-${room.roundNumber}`} role={session.role} prompt={prompt} session={session} startedAt={room.startedAt} endsAt={room.endsAt} playerCount={room.players.length} onDone={finishRound} />
        )}
        {screen === 'judging' && <Judging key="judging" note={judgingNote} />}
        {screen === 'complete' && session && room?.result && (
          <RoundComplete key={`complete-${room.roundNumber}`} role={session.role} prompt={prompt} result={room.result} clipsReady={room.players.every((player) => player.clipReady)} onPlayAgain={playAgain} onHome={goHome} />
        )}
      </AnimatePresence>
      <Curtain active={curtain.active} label={curtain.label} />
    </div>
  );
}

export default function App() {
  return <SoundProvider><Game /></SoundProvider>;
}
