# char-AIDS 🎭

**Act it out. Guess it. Lose your dignity.**

A bright, bubbly, slightly ridiculous charades party game. The host spins a carnival wheel, everyone in the party gets the same prompt, and everyone acts it out on camera for 15 seconds at once.

## Play flow

```
Host:   Home → PLAY → Wheel (press SPIN) → Prompt reveal (press START ACTING)
        → camera permission → 3-2-1-ACT! → 15-second round → TIME'S UP → PLAY AGAIN / home

One party is exactly one round. PLAY AGAIN starts a brand-new party with a fresh code.

Guest:  Home → JOIN GAME (6-letter code) → same screens, but every host control
        is replaced by a "Waiting for the host…" pill.
```

There is no backend yet. Guest devices simulate the host with a short delay via
`src/game/useSimulatedHost.ts`. That hook is the single seam to replace with a
real party channel later; nothing else needs to know.

The round timer only starts once the camera permission prompt has been answered,
then counts in with 3-2-1-ACT! on the camera frame.

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL. `npm run build` type-checks and produces a production bundle in `dist/`.

## Stack

- Vite + React 18 + TypeScript
- Framer Motion for springs, transitions and the pointer flapper
- canvas-confetti for particle bursts
- Web Audio API for procedural placeholder sound effects (no audio files needed)

## Project layout

```
src/
  App.tsx                    state machine: home | join | wheel | reveal | acting | complete
                             plus party state: code, role (host | guest), prompt
  game/useSimulatedHost.ts   guests' stand-in for host actions until there is a backend
  audio/
    synth.ts                 every sound effect as one swappable function
    SoundProvider.tsx        useSound() hook + mute toggle (persisted)
  components/
    game/Wheel.tsx           SVG carnival wheel, plays back a precomputed spin
    game/wheelPhysics.ts     friction + peg-flapper simulation; deterministic landing
    game/Countdown.tsx       useRoundTimer + big number (above camera) + horizontal bar (below)
    game/Camera.tsx          getUserMedia preview with denied/unsupported fallbacks
    fx/                      ambient background, floating decorations, curtain wipe, confetti
    ui/                      BigButton, SoundToggle, HostWaiting / RoleBadge
  screens/                   one component per game state
  data/prompts.ts            placeholder prompt bank
```

## Wheel physics

The spin is a real simulation, not a tween. The rotor has constant bearing friction plus viscous drag, and a pointer flapper that resists the wheel for the first few degrees after every peg. As the wheel slows it visibly hesitates on each peg; if it runs out of energy mid-peg the flapper shoves it back. To land on a chosen prompt, `planSpin` searches launch speeds until the simulated resting angle matches, then the trajectory is played back frame by frame.

## Swapping in real sounds

Each effect in `src/audio/synth.ts` is a single function (`sfxWheelLand`, `sfxCountdownTick`, …). Replace a function body with a sample player and nothing else changes.
