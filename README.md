# charAIds 🎭

**Act it out. Guess it. Lose your dignity.**

A bright, bubbly, slightly ridiculous 1v1 charades duel for two Macs on the same
Wi-Fi. Player 1 spins the wheel, both players get the same prompt, player 1 acts
for 15 seconds while player 2 watches, then they swap, and Gemini picks the winner.

Everything runs locally on player 1's Mac: the Vite dev server, the Express API,
and the calls to Gemini. No cloud, no codes.

## Run it

```bash
npm install
cp .env.example .env.local   # then put your GEMINI_API_KEY in .env.local
npm run dev
```

`npm run dev` starts the API on port 8787 and the web app on **https://localhost:5173**.
The terminal prints the LAN address for the second Mac, and the lobby shows it too.

1. **Player 1** opens `https://localhost:5173` and presses PLAY.
2. **Player 2** opens `https://<player-1-ip>:5173` on their Mac and presses PLAY.
   The two auto-pair; there are no room codes.
3. Both press **Camera ready**, player 1 presses **Start**.

HTTPS uses a self-signed certificate (browsers only allow the camera on secure
origins). Each Mac accepts the certificate warning once.

Without a Gemini key the API still runs and a deterministic fallback judge scores
the rounds.

## Play flow

```
Player 1: Home → PLAY → Lobby → Wheel (SPIN) → Reveal (START ACTING)
          → YOUR TURN (15s, recorded) → watch player 2 → verdict → PLAY AGAIN

Player 2: Home → PLAY → Lobby → synchronized wheel → Reveal
          → watch player 1 → YOUR TURN (15s, recorded) → verdict
```

During a turn the acting Mac records two-second video windows and sends each to
`POST /api/rooms/:code/segments`, where Gemini scores accuracy, energy and motion
clarity. The other Mac receives the live camera over WebRTC (signalled through the
API, LAN only). After the second turn `POST /api/rooms/:code/judge` asks Gemini to
compare both sets of window scores and write a verdict.

## Stack

- Vite + React 18 + TypeScript, Framer Motion, canvas-confetti, Web Audio placeholders
- Express API, in-memory rooms and clips (restart clears everything)
- Gemini `gemini-3.5-flash-lite` via `generateContent` with native video windows

## Layout

```
server/
  app.ts          rooms, auto-pairing, turn-based round state, judging
  gemini.ts       segment analysis + final comparison (with fallbacks)
  store.ts        in-memory rooms/clips with per-room update locking
  dev.ts          binds 0.0.0.0:8787 and prints the LAN URL
shared/prompts.ts prompt bank used by server and client
src/
  App.tsx         screen state machine driven by polling the room
  api.ts          API client
  game/           recordRound (MediaRecorder windows), usePeerVideo (WebRTC)
  screens/        Home, Lobby, WheelSpin, PromptReveal, ActingRound,
                  SpectateRound, Judging, RoundComplete
  components/     wheel + physics, camera, countdown, effects, buttons
```

## Endpoints

- `GET /api/health` (Gemini status, LAN URLs)
- `POST /api/rooms/auto` (create or auto-join)
- `GET /api/rooms/:code`
- `POST /api/rooms/:code/ready` · `/start` · `/advance` · `/finish` · `/leave`
- `POST /api/rooms/:code/segments` · `/clips` · `/judge`
- `POST|GET /api/rooms/:code/signals` (WebRTC signalling)
- `POST /api/rooms/:code/publish` (optional X post of the losing clip, off by default)
