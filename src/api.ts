export type Session = {
  roomCode: string;
  playerId: string;
  playerToken: string;
  role: 'host' | 'guest';
};

export type JudgeResult = {
  winnerId: 'you' | 'opponent';
  youScore: number;
  opponentScore: number;
  verdict: string;
  postStatus: 'queued' | 'publishing' | 'posted' | 'disabled' | 'failed';
  postUrl?: string;
};

export type RoomView = {
  roomCode: string;
  status: 'lobby' | 'wheel' | 'reveal' | 'round' | 'judging' | 'result';
  roundNumber: number;
  prompt?: string;
  /** players[turn] is acting. 0 = player 1 (host), 1 = player 2. */
  turn: 0 | 1;
  actorId?: string;
  youAreActor: boolean;
  yourIndex: number;
  startedAt?: number;
  endsAt?: number;
  players: Array<{ id: string; ready: boolean; consent: boolean; clipReady: boolean }>;
  result?: JudgeResult;
};

export type Health = { ok: boolean; gemini: boolean; geminiModel: string; lanUrls: string[] };

export type GameSignal = {
  id: number;
  from: string;
  to: string;
  kind: 'offer' | 'answer' | 'ice';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const API_URL = '/api';

async function request<T>(path: string, init?: RequestInit, session?: Session): Promise<T> {
  const headers = new Headers(init?.headers);
  if (session) {
    headers.set('authorization', `Bearer ${session.playerToken}`);
    headers.set('x-player-id', session.playerId);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data as T;
}

const json = (body: unknown) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const gameApi = {
  health: () => request<Health>('/health'),
  /** No codes: joins the open room on this server or creates one. */
  pair: () => request<Session>('/rooms/auto', { method: 'POST' }),
  getRoom: (session: Session) => request<RoomView>(`/rooms/${session.roomCode}`, undefined, session),
  leave: (session: Session) => request<void>(`/rooms/${session.roomCode}/leave`, { method: 'POST' }, session),
  ready: (session: Session, consent: boolean) => request<RoomView>(`/rooms/${session.roomCode}/ready`, { method: 'POST', ...json({ consent }) }, session),
  start: (session: Session) => request<RoomView>(`/rooms/${session.roomCode}/start`, { method: 'POST' }, session),
  advance: (session: Session, to: 'reveal' | 'round') => request<RoomView>(`/rooms/${session.roomCode}/advance`, { method: 'POST', ...json({ to }) }, session),
  finish: (session: Session) => request<RoomView>(`/rooms/${session.roomCode}/finish`, { method: 'POST' }, session),
  uploadSegment(session: Session, segment: Blob, segmentIndex: number) {
    const form = new FormData();
    const extension = segment.type.startsWith('video/mp4') ? 'mp4' : 'webm';
    form.append('segment', segment, `segment-${segmentIndex}.${extension}`);
    form.append('segmentIndex', String(segmentIndex));
    return request(`/rooms/${session.roomCode}/segments`, { method: 'POST', body: form }, session);
  },
  uploadClip(session: Session, clip: Blob) {
    const extension = clip.type.startsWith('video/mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('clip', clip, `round.${extension}`);
    return request<RoomView>(`/rooms/${session.roomCode}/clips`, { method: 'POST', body: form }, session);
  },
  judge: (session: Session) => request<JudgeResult>(`/rooms/${session.roomCode}/judge`, { method: 'POST', signal: AbortSignal.timeout(8000) }, session),
  publish: (session: Session) => request<JudgeResult>(`/rooms/${session.roomCode}/publish`, { method: 'POST' }, session),
  sendSignal: (session: Session, signal: Pick<GameSignal, 'kind' | 'data'>) => request<GameSignal>(`/rooms/${session.roomCode}/signals`, { method: 'POST', ...json(signal) }, session),
  getSignals: (session: Session, after: number) => request<{ signals: GameSignal[] }>(`/rooms/${session.roomCode}/signals?after=${after}`, undefined, session),
};
