# charAIds 🎭

**Act it out. Guess it. Lose your dignity.**

A bright, bubbly, slightly ridiculous charades party game. The host spins a carnival wheel, everyone in the party gets the same prompt, and everyone acts it out on camera for 15 seconds at once.

## Play flow

```
Host:   Home → PLAY → Lobby → Wheel (press SPIN) → Prompt reveal
        → synchronized countdown → 15-second round → Gemini verdict → PLAY AGAIN / home

One party is exactly one round. PLAY AGAIN creates a new room with a fresh code.

Guest:  Home → JOIN GAME (6-letter code) → same screens, but every host control
        is replaced by a "Waiting for the host…" pill.
```

The frontend is connected to the real room API. The server owns the six-character
room code, prompt, phase, start time, and verdict. Both clients poll the durable
room state and use the same absolute round clock. WebRTC signaling is included so
players can see each other; configure TURN for networks where direct peer
connections are blocked.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. The development command runs the API on
port 8787 and Vite on port 5173. `npm run build` type-checks the full project
and produces a production bundle in `dist/`; `npm test` exercises the two-player
API lifecycle.

## Stack

- Vite + React 18 + TypeScript
- Framer Motion for springs, transitions and the pointer flapper
- canvas-confetti for particle bursts
- Web Audio API for procedural placeholder sound effects (no audio files needed)
- Express API with in-memory local fallbacks and Redis/Vercel Blob production adapters
- Gemini 3.5 Flash-Lite native-video window analysis with a three-second application deadline

## Backend

Authenticated room requests use `Authorization: Bearer <playerToken>` and
`X-Player-Id: <playerId>`. See `.env.example` for optional Gemini, Redis, Blob,
TURN, and X credentials. Without credentials, the API remains runnable locally
using in-process room and clip storage plus a deterministic judging fallback.

The browser records independent two-second native-video windows during the
15-second round and sends them to `POST /api/rooms/:code/segments`. At the buzzer it calls
`POST /api/rooms/:code/judge`; Gemini has a strict 1.8-second inference budget
and the server falls back to the completed rolling-window scores so the app can
return a verdict inside its three-second target. The complete recording is saved
concurrently. Production browsers upload it directly to private Vercel Blob with
an authenticated, path-scoped token, bypassing Vercel Functions' request-body
limit; local development uses `POST /api/rooms/:code/clips`.

Gemini 3.5 Flash-Lite does not expose the Gemini Live API. Each rolling request
therefore uses a real chronological video blob through `generateContent`, with
`videoMetadata.fps` set to 5. It is not a sequence of independent JPEG calls.

Available endpoints:

- `GET /api/health`
- `POST /api/rooms`
- `POST /api/rooms/:code/join`
- `GET /api/rooms/:code`
- `POST /api/rooms/:code/leave`
- `POST /api/rooms/:code/ready`
- `POST /api/rooms/:code/start`
- `POST /api/rooms/:code/advance`
- `POST /api/rooms/:code/segments`
- `POST /api/rooms/:code/clips`
- `POST /api/rooms/:code/blob-upload`
- `POST /api/rooms/:code/clips/register`
- `POST /api/rooms/:code/judge`
- `POST /api/rooms/:code/publish`
- `GET|POST /api/rooms/:code/signals`

For Vercel, import the repository, attach Redis and a private Blob store, and set
the environment variables from `.env.example`. `vercel.json` builds the Vite
client and catch-all Node API function together.

## Project layout

```
src/
  App.tsx                    server-synchronized UI state machine and room polling
  api.ts                     authenticated room, media, signaling, and result client
  game/recordRound.ts        full recording plus independent two-second video windows
  game/usePeerVideo.ts       WebRTC connection driven by the signaling API
  audio/
    synth.ts                 every sound effect as one swappable function
    SoundProvider.tsx        useSound() hook + mute toggle (persisted)
  components/
    game/Wheel.tsx           SVG carnival wheel, plays back a precomputed spin
    game/wheelPhysics.ts     friction + peg-flapper simulation; deterministic landing
    game/Countdown.tsx       useRoundTimer + big number (above camera) + horizontal bar (below)
    game/Camera.tsx          local and peer video with denied/unsupported fallbacks
    fx/                      ambient background, floating decorations, curtain wipe, confetti
    ui/                      BigButton, SoundToggle, HostWaiting / RoleBadge
  screens/                   one component per game state
  data/prompts.ts            placeholder prompt bank
```

## Wheel physics

The spin is a real simulation, not a tween. The rotor has constant bearing friction plus viscous drag, and a pointer flapper that resists the wheel for the first few degrees after every peg. As the wheel slows it visibly hesitates on each peg; if it runs out of energy mid-peg the flapper shoves it back. To land on a chosen prompt, `planSpin` searches launch speeds until the simulated resting angle matches, then the trajectory is played back frame by frame.

## Background

Home and Join play a looping cartoon video (`public/bg-loop.webm` / `.mp4`, poster
`bg-poster.jpg`). It is shown uncropped with cream gradient overlays fading its
edges into the page; the page cream is sampled from the video. Reduced-motion and
data-saver users get the poster. The game screens use the animated purple gradient.

## Swapping in real sounds

Each effect in `src/audio/synth.ts` is a single function (`sfxWheelLand`, `sfxCountdownTick`, …). Replace a function body with a sample player and nothing else changes.
