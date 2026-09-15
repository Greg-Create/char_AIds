import { createHash, randomBytes, randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { analyzeVideoSegment, compareSegmentScores, GEMINI_MODEL } from "./gemini.js";
import { deleteClip, deleteRoom, getClip, getRoom, listRooms, saveClip, saveRoom, updateRoom } from "./store.js";
import type { Player, Room } from "./types.js";
import { postLosingClip } from "./x.js";
import { PROMPT_DEFINITIONS } from "../shared/prompts.js";

/**
 * Local two-Mac charades API.
 *
 * - No room codes: the first PLAY creates a room, the second PLAY on the same
 *   network joins it automatically.
 * - Turn based: player 1 acts for 15 seconds while player 2 watches, then they
 *   swap, then Gemini compares both performances.
 */

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1 } });
const prompts = PROMPT_DEFINITIONS.map((prompt) => prompt.label);
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREROLL_MS = 4000;
const ROUND_MS = 15_000;
const OPEN_ROOM_MAX_AGE_MS = 15 * 60 * 1000;
export const WEB_PORT = Number(process.env.WEB_PORT || 5173);

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", request.headers.origin || "*");
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-player-id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (request.method === "OPTIONS") return response.status(204).end();
  next();
});
app.use(express.json({ limit: "1mb" }));

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const issueToken = () => randomBytes(24).toString("base64url");
const makeCode = () => Array.from(randomBytes(6), (byte) => codeAlphabet[byte % codeAlphabet.length]).join("");

/** LAN addresses the second Mac can open. */
export function lanUrls(port = WEB_PORT) {
  const urls: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) urls.push(`https://${entry.address}:${port}`);
    }
  }
  return urls;
}

function createPlayer() {
  const token = issueToken();
  const player: Player = { id: randomUUID(), tokenHash: hashToken(token), ready: false, consent: false, observations: [] };
  return { player, token };
}

function authenticate(request: Request, room: Room) {
  const playerId = String(request.headers["x-player-id"] || "");
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  const player = room.players.find((item) => item.id === playerId);
  if (!player || !token || player.tokenHash !== hashToken(token)) throw new Error("UNAUTHORIZED");
  return player;
}

function actorOf(room: Room) {
  return room.players[room.turn];
}

function roomView(room: Room, requesterId?: string) {
  const requester = requesterId ? room.players.find((player) => player.id === requesterId) : undefined;
  const opponent = requester ? room.players.find((player) => player.id !== requester.id) : undefined;
  const result = room.result && requester ? {
    winnerId: room.result.winnerPlayerId === requester.id ? "you" : "opponent",
    youScore: room.result.scores[requester.id],
    opponentScore: opponent ? room.result.scores[opponent.id] : 0,
    verdict: room.result.verdict,
    postStatus: room.result.postStatus,
    postUrl: room.result.postUrl,
  } : undefined;
  const actor = actorOf(room);
  return {
    roomCode: room.code,
    status: room.status,
    roundNumber: room.roundNumber || 0,
    prompt: room.status === "lobby" ? undefined : room.prompt,
    turn: room.turn,
    actorId: room.status === "round" ? actor?.id : undefined,
    youAreActor: room.status === "round" && Boolean(requester) && actor?.id === requester?.id,
    yourIndex: requester ? room.players.indexOf(requester) : -1,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    players: room.players.map((player) => ({ id: player.id, ready: player.ready, consent: player.consent, clipReady: Boolean(player.clipPath) })),
    result,
  };
}

function resetRound(room: Room) {
  room.roundNumber = (room.roundNumber || 0) + 1;
  room.status = "wheel";
  room.prompt = prompts[Math.floor(Math.random() * prompts.length)];
  room.turn = 0;
  room.startedAt = undefined;
  room.endsAt = undefined;
  room.result = undefined;
  room.judgingBy = undefined;
  room.signals = [];
  room.nextSignalId = 1;
  room.players.forEach((player) => {
    player.clipPath = undefined;
    player.clipMimeType = undefined;
    player.observations = [];
  });
}

async function createRoom() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeCode();
    if (await getRoom(code)) continue;
    const { player, token } = createPlayer();
    const now = Date.now();
    const room: Room = { code, version: 0, createdAt: now, updatedAt: now, status: "lobby", roundNumber: 0, turn: 0, players: [player], signals: [], nextSignalId: 1 };
    await saveRoom(room, true);
    return { roomCode: room.code, playerId: player.id, playerToken: token, role: "host" as const };
  }
  throw new Error("Could not allocate a room");
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, gemini: Boolean(process.env.GEMINI_API_KEY), geminiModel: GEMINI_MODEL, lanUrls: lanUrls() });
});

/** Pair automatically: join the open room on this server, or open a new one. */
app.post("/api/rooms/auto", async (_request, response) => {
  const open = listRooms()
    .filter((room) => room.status === "lobby" && room.players.length === 1 && Date.now() - room.updatedAt < OPEN_ROOM_MAX_AGE_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (open) {
    const session = await updateRoom(open.code, (room) => {
      if (room.players.length >= 2 || room.status !== "lobby") throw new Error("ROOM_FULL");
      const { player, token } = createPlayer();
      room.players.push(player);
      return { roomCode: room.code, playerId: player.id, playerToken: token, role: "guest" as const };
    }).catch(() => null);
    if (session) return response.status(201).json(session);
  }
  response.status(201).json(await createRoom());
});

app.get("/api/rooms/:code", async (request, response) => {
  const room = await getRoom(String(request.params.code).toUpperCase());
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const player = authenticate(request, room);
  response.json(roomView(room, player.id));
});

app.post("/api/rooms/:code/leave", async (request, response) => {
  const code = String(request.params.code).toUpperCase();
  const room = await getRoom(code);
  if (!room) return response.status(204).end();
  const player = authenticate(request, room);
  if (room.players[0]?.id === player.id) {
    await deleteRoom(code);
  } else {
    if (player.clipPath) await deleteClip(player.clipPath);
    await updateRoom(code, (current) => {
      const leaving = authenticate(request, current);
      current.players = current.players.filter((item) => item.id !== leaving.id);
      current.status = "lobby";
      current.prompt = undefined;
      current.turn = 0;
      current.startedAt = undefined;
      current.endsAt = undefined;
      current.result = undefined;
      current.judgingBy = undefined;
      current.signals = [];
      current.players.forEach((item) => { item.ready = false; });
    });
  }
  response.status(204).end();
});

app.post("/api/rooms/:code/ready", async (request, response) => {
  const view = await updateRoom(String(request.params.code).toUpperCase(), (room) => {
    const player = authenticate(request, room);
    if (room.status !== "lobby") throw new Error("ROUND_IN_PROGRESS");
    player.consent = request.body?.consent === true;
    player.ready = true;
    return roomView(room, player.id);
  });
  response.json(view);
});

app.post("/api/rooms/:code/start", async (request, response) => {
  const view = await updateRoom(String(request.params.code).toUpperCase(), (room) => {
    const player = authenticate(request, room);
    if (room.players[0]?.id !== player.id) throw new Error("HOST_ONLY");
    if (room.players.length !== 2) throw new Error("OPPONENT_NOT_FOUND");
    if (room.status === "lobby" && !room.players.every((item) => item.ready)) throw new Error("PLAYERS_NOT_READY");
    if (!["lobby", "result"].includes(room.status)) throw new Error("ROUND_IN_PROGRESS");
    resetRound(room);
    return roomView(room, player.id);
  });
  response.json(view);
});

app.post("/api/rooms/:code/advance", async (request, response) => {
  const view = await updateRoom(String(request.params.code).toUpperCase(), (room) => {
    const player = authenticate(request, room);
    if (room.players[0]?.id !== player.id) throw new Error("HOST_ONLY");
    const destination = request.body?.to;
    if (room.status === "wheel" && destination === "reveal") {
      room.status = "reveal";
    } else if (room.status === "reveal" && destination === "round") {
      room.status = "round";
      room.turn = 0;
      room.signals = [];
      room.startedAt = Date.now() + PREROLL_MS;
      room.endsAt = room.startedAt + ROUND_MS;
    } else {
      throw new Error("INVALID_TRANSITION");
    }
    return roomView(room, player.id);
  });
  response.json(view);
});

/** The acting player is done: hand the camera to player 2, or go to judging. */
app.post("/api/rooms/:code/finish", async (request, response) => {
  const view = await updateRoom(String(request.params.code).toUpperCase(), (room) => {
    const player = authenticate(request, room);
    if (room.status !== "round") return roomView(room, player.id);
    if (actorOf(room)?.id !== player.id) throw new Error("NOT_YOUR_TURN");
    if (room.turn === 0) {
      room.turn = 1;
      room.signals = [];
      room.nextSignalId = 1;
      room.startedAt = Date.now() + PREROLL_MS;
      room.endsAt = room.startedAt + ROUND_MS;
    } else {
      room.status = "judging";
      room.startedAt = undefined;
      room.endsAt = undefined;
    }
    return roomView(room, player.id);
  });
  response.json(view);
});

app.post("/api/rooms/:code/segments", upload.single("segment"), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: "Missing video segment" });
  const code = String(request.params.code).toUpperCase();
  const room = await getRoom(code);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const player = authenticate(request, room);
  if (room.status !== "round" || !room.prompt) return response.status(409).json({ error: "Round is not active" });
  if (actorOf(room)?.id !== player.id) return response.status(409).json({ error: "Not your turn" });
  const segmentIndex = Number(request.body?.segmentIndex);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex > 9) return response.status(400).json({ error: "Invalid segment index" });
  const observation = await analyzeVideoSegment(room.prompt, request.file.buffer, request.file.mimetype || "video/webm", segmentIndex);
  await updateRoom(code, (current) => {
    const currentPlayer = authenticate(request, current);
    currentPlayer.observations = currentPlayer.observations
      .filter((item) => item.segmentIndex !== segmentIndex)
      .concat(observation)
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .slice(-8);
  });
  response.status(202).json(observation);
});

app.post("/api/rooms/:code/clips", upload.single("clip"), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: "Missing clip" });
  const code = String(request.params.code).toUpperCase();
  const room = await getRoom(code);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const player = authenticate(request, room);
  const extension = request.file.mimetype.startsWith("video/mp4") ? "mp4" : "webm";
  const path = `clips/${room.code}/${player.id}.${extension}`;
  await saveClip(path, request.file.buffer);
  const view = await updateRoom(code, (current) => {
    const currentPlayer = authenticate(request, current);
    currentPlayer.clipPath = path;
    currentPlayer.clipMimeType = request.file!.mimetype || `video/${extension}`;
    return roomView(current, currentPlayer.id);
  });
  response.status(201).json(view);
});

app.post("/api/rooms/:code/judge", async (request, response) => {
  const code = String(request.params.code).toUpperCase();
  const room = await getRoom(code);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const requester = authenticate(request, room);
  if (room.result) return response.json(roomView(room, requester.id).result);
  if (room.players.length !== 2) return response.status(409).json({ error: "Waiting for opponent" });
  if (room.status !== "judging") return response.status(409).json({ error: "Both turns must finish first" });
  if (room.judgingBy && room.judgingBy !== requester.id) return response.status(409).json({ error: "Judging already started" });
  await updateRoom(code, (current) => { current.judgingBy = requester.id; });

  const fresh = await getRoom(code);
  if (!fresh?.prompt) throw new Error("ROOM_NOT_FOUND");
  const comparison = await compareSegmentScores(fresh.prompt, fresh.players);
  const winner = fresh.players[comparison.winnerIndex];
  const canPublish = fresh.players.every((player) => player.consent) && process.env.ENABLE_X_POSTS === "true" && Boolean(process.env.X_USER_ACCESS_TOKEN);
  const scores = { [fresh.players[0].id]: comparison.scores[0], [fresh.players[1].id]: comparison.scores[1] };
  const result = await updateRoom(code, (current) => {
    current.status = "result";
    current.result = { winnerPlayerId: winner.id, scores, verdict: comparison.verdict, postStatus: canPublish ? "queued" : "disabled" };
    return roomView(current, requester.id).result;
  });
  response.json(result);
});

app.post("/api/rooms/:code/publish", async (request, response) => {
  const code = String(request.params.code).toUpperCase();
  const room = await getRoom(code);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const requester = authenticate(request, room);
  if (!room.result) return response.status(409).json({ error: "Result is not ready" });
  if (room.result.postStatus !== "queued") return response.json(roomView(room, requester.id).result);
  if (!room.players.every((player) => player.clipPath)) return response.status(409).json({ error: "Waiting for stored clips" });
  const claimed = await updateRoom(code, (current) => {
    if (!current.result || current.result.postStatus !== "queued") return false;
    current.result.postStatus = "publishing";
    return true;
  });
  if (!claimed) {
    const current = await getRoom(code);
    return response.json(current ? roomView(current, requester.id).result : undefined);
  }
  const loser = room.players.find((player) => player.id !== room.result!.winnerPlayerId)!;
  const bytes = await getClip(loser.clipPath!);
  if (!bytes) throw new Error("CLIP_NOT_FOUND");
  let postStatus: "posted" | "failed" = "failed";
  let postUrl: string | undefined;
  try {
    const published = await postLosingClip(bytes, loser.clipMimeType || "video/webm", room.code);
    postStatus = published.status === "posted" ? "posted" : "failed";
    postUrl = published.url;
  } catch (error) {
    console.error(error);
  }
  const result = await updateRoom(code, (current) => {
    if (!current.result) throw new Error("ROOM_NOT_FOUND");
    current.result.postStatus = postStatus;
    current.result.postUrl = postUrl;
    return roomView(current, requester.id).result;
  });
  response.json(result);
});

app.post("/api/rooms/:code/signals", async (request, response) => {
  const signal = await updateRoom(String(request.params.code).toUpperCase(), (room) => {
    const player = authenticate(request, room);
    const other = room.players.find((item) => item.id !== player.id);
    if (!other) throw new Error("OPPONENT_NOT_FOUND");
    const kind = request.body?.kind;
    if (!["offer", "answer", "ice"].includes(kind)) throw new Error("INVALID_SIGNAL");
    const item = { id: room.nextSignalId++, from: player.id, to: other.id, kind, data: request.body.data, createdAt: Date.now() };
    room.signals.push(item);
    room.signals = room.signals.slice(-100);
    return item;
  });
  response.status(201).json(signal);
});

app.get("/api/rooms/:code/signals", async (request, response) => {
  const room = await getRoom(String(request.params.code).toUpperCase());
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const player = authenticate(request, room);
  const after = Number(request.query.after || 0);
  response.json({ signals: room.signals.filter((signal) => signal.to === player.id && signal.id > after) });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message === "UNAUTHORIZED" ? 401
    : message === "ROOM_NOT_FOUND" ? 404
      : ["ROOM_FULL", "ROUND_IN_PROGRESS", "OPPONENT_NOT_FOUND", "PLAYERS_NOT_READY", "HOST_ONLY", "NOT_YOUR_TURN"].includes(message) ? 409
        : ["INVALID_SIGNAL", "INVALID_TRANSITION"].includes(message) ? 400 : 500;
  if (status === 500) console.error(error);
  response.status(status).json({ error: message });
});

export default app;
