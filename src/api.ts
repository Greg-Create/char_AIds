import { upload } from '@vercel/blob/client';

export type Session = {
  roomCode: string;
  playerId: string;
  playerToken: string;
  role: "host" | "guest";
};

export type JudgeResult = {
  winnerId: "you" | "opponent";
  youScore: number;
  opponentScore: number;
  verdict: string;
  postStatus: "queued" | "publishing" | "posted" | "disabled" | "failed";
  postUrl?: string;
};

export type RoomView = {
  roomCode: string;
  status: "lobby" | "wheel" | "reveal" | "round" | "judging" | "result";
  roundNumber: number;
  prompt?: string;
  startedAt?: number;
  endsAt?: number;
  players: Array<{ id: string; ready: boolean; consent: boolean; clipReady: boolean }>;
  result?: JudgeResult;
};

export type GameSignal = {
  id: number;
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
const API_URL = configuredBase || "/api";

const sessionHeaders = (session: Session) => ({
  authorization: `Bearer ${session.playerToken}`,
  'x-player-id': session.playerId,
});

async function request<T>(path: string, init?: RequestInit, session?: Session): Promise<T> {
  const headers = new Headers(init?.headers);
  if (session) {
    headers.set("authorization", `Bearer ${session.playerToken}`);
    headers.set("x-player-id", session.playerId);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data as T;
}

export const gameApi = {
  health: () => request<{ ok: boolean; roomStorage: string; clipStorage: string; gemini: boolean; geminiModel: string; videoIngestion: string; verdictDeadlineMs: number; directClipUpload: boolean; xPosting: boolean }>("/health"),
  createRoom: () => request<Session>("/rooms", { method: "POST" }),
  joinRoom: (roomCode: string) => request<Session>(`/rooms/${roomCode}/join`, { method: "POST" }),
  getRoom: (session: Session) => request<RoomView>(`/rooms/${session.roomCode}`, undefined, session),
  leave: (session: Session) => request<void>(`/rooms/${session.roomCode}/leave`, { method: 'POST' }, session),
  ready: (session: Session, consent: boolean) => request<RoomView>(`/rooms/${session.roomCode}/ready`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consent }),
  }, session),
  start: (session: Session) => request<RoomView>(`/rooms/${session.roomCode}/start`, { method: 'POST' }, session),
  advance: (session: Session, to: 'reveal' | 'round') => request<RoomView>(`/rooms/${session.roomCode}/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to }),
  }, session),
  async uploadSegment(session: Session, segment: Blob, segmentIndex: number) {
    const form = new FormData();
    const extension = segment.type.startsWith("video/mp4") ? "mp4" : "webm";
    form.append("segment", segment, `segment-${segmentIndex}.${extension}`);
    form.append("segmentIndex", String(segmentIndex));
    return request(`/rooms/${session.roomCode}/segments`, { method: "POST", body: form }, session);
  },
  async uploadClip(session: Session, clip: Blob, direct: boolean) {
    const contentType = clip.type.split(';')[0] || 'video/webm';
    const extension = contentType === 'video/mp4' ? 'mp4' : contentType === 'video/quicktime' ? 'mov' : 'webm';
    if (direct) {
      const pathname = `clips/${session.roomCode}/${session.playerId}.${extension}`;
      const blob = await upload(pathname, clip, {
        access: 'private',
        contentType,
        multipart: clip.size > 5 * 1024 * 1024,
        handleUploadUrl: `${API_URL}/rooms/${session.roomCode}/blob-upload`,
        headers: sessionHeaders(session),
      });
      return request<RoomView>(`/rooms/${session.roomCode}/clips/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pathname: blob.pathname, contentType }),
      }, session);
    }
    const form = new FormData();
    form.append("clip", clip, `round.${extension}`);
    return request<RoomView>(`/rooms/${session.roomCode}/clips`, { method: "POST", body: form }, session);
  },
  judge: (session: Session) => request<JudgeResult>(`/rooms/${session.roomCode}/judge`, {
    method: "POST",
    signal: AbortSignal.timeout(2900),
  }, session),
  publish: (session: Session) => request<JudgeResult>(`/rooms/${session.roomCode}/publish`, { method: "POST" }, session),
  sendSignal: (session: Session, signal: Pick<GameSignal, "kind" | "data">) => request<GameSignal>(`/rooms/${session.roomCode}/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(signal),
  }, session),
  getSignals: (session: Session, after: number) => request<{ signals: GameSignal[] }>(`/rooms/${session.roomCode}/signals?after=${after}`, undefined, session),
};
