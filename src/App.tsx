import { AnimatePresence } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import { SoundProvider, useSound } from './audio/SoundProvider';
import { Background } from './components/fx/Background';
import { Curtain } from './components/fx/Curtain';
import { SoundToggle } from './components/ui/SoundToggle';
import { PROMPTS, generateGameCode, pickPromptIndex } from './data/prompts';
import { ActingRound } from './screens/ActingRound';
import { Home } from './screens/Home';
import { JoinGame } from './screens/JoinGame';
import { PromptReveal } from './screens/PromptReveal';
import { RoundComplete } from './screens/RoundComplete';
import { WheelSpin } from './screens/WheelSpin';

/** Every state the game can be in, in play order. */
type Screen = 'home' | 'join' | 'wheel' | 'reveal' | 'acting' | 'complete';

/** The party creator (host) drives the wheel; everyone else follows along. */
export type Role = 'host' | 'guest';

interface GameState {
  code: string;
  role: Role;
  promptIndex: number;
  /** Bumped per party so screens remount with fresh state. */
  session: number;
}

const CURTAIN_COVER_MS = 520;
const CURTAIN_TOTAL_MS = 1050;

function Game() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<GameState>({ code: '', role: 'host', promptIndex: 0, session: 0 });
  const [curtain, setCurtain] = useState<{ active: boolean; label: string }>({ active: false, label: '' });
  const timers = useRef<number[]>([]);
  const sound = useSound();

  /** Dramatic game-show wipe: cover the screen, swap state underneath, uncover. */
  const wipeTo = useCallback(
    (next: Screen, label: string) => {
      timers.current.forEach(window.clearTimeout);
      sound.whoosh();
      setCurtain({ active: true, label });
      timers.current = [
        window.setTimeout(() => setScreen(next), CURTAIN_COVER_MS),
        window.setTimeout(() => setCurtain((c) => ({ ...c, active: false })), CURTAIN_TOTAL_MS),
      ];
    },
    [sound],
  );

  /**
   * One party = one prompt. Everyone acts out the same thing, so this is the
   * single source of truth. With a backend, the host would pick and broadcast
   * it; guests would receive it here instead. The previous prompt is avoided
   * so "Play again" never repeats itself back to back.
   */
  const newParty = useCallback(
    (code: string, role: Role): GameState => ({
      code,
      role,
      promptIndex: pickPromptIndex([game.promptIndex]),
      session: game.session + 1,
    }),
    [game.promptIndex, game.session],
  );

  const startGame = () => {
    setGame(newParty(generateGameCode(), 'host'));
    wipeTo('wheel', "LET'S PLAY!");
  };

  const joinGame = (code: string) => {
    setGame(newParty(code, 'guest'));
    wipeTo('wheel', 'YOU’RE IN!');
  };

  const playAgain = () => {
    setGame(newParty(generateGameCode(), 'host'));
    wipeTo('wheel', 'AGAIN!');
  };

  const goHome = () => {
    setScreen('home');
  };

  const prompt = PROMPTS[game.promptIndex];

  return (
    <div className="app">
      <Background />
      <SoundToggle />
      <AnimatePresence mode="wait">
        {screen === 'home' && <Home key="home" onStart={startGame} onJoin={() => setScreen('join')} />}
        {screen === 'join' && <JoinGame key="join" onJoin={joinGame} onBack={goHome} />}
        {screen === 'wheel' && <WheelSpin key={`wheel-${game.session}`} prompts={PROMPTS} targetIndex={game.promptIndex} code={game.code} role={game.role} onLanded={() => setScreen('reveal')} />}
        {screen === 'reveal' && <PromptReveal key={`reveal-${game.session}`} prompt={prompt} role={game.role} onStart={() => setScreen('acting')} />}
        {screen === 'acting' && <ActingRound key={`acting-${game.session}`} role={game.role} prompt={prompt} onDone={() => setScreen('complete')} />}
        {screen === 'complete' && <RoundComplete key={`complete-${game.session}`} role={game.role} prompt={prompt} onPlayAgain={playAgain} onHome={goHome} />}
      </AnimatePresence>
      <Curtain active={curtain.active} label={curtain.label} />
    </div>
  );
}

export default function App() {
  return (
    <SoundProvider>
      <Game />
    </SoundProvider>
  );
}
