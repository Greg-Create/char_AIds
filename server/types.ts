export type RoomStatus = "lobby" | "wheel" | "reveal" | "round" | "judging" | "result";

export type LiveObservation = {
  segmentIndex: number;
  accuracy: number;
  energy: number;
  motionClarity: number;
  note: string;
  createdAt: number;
};

export type Player = {
  id: string;
  tokenHash: string;
  ready: boolean;
  consent: boolean;
  clipPath?: string;
  clipMimeType?: string;
  observations: LiveObservation[];
};

export type Signal = {
  id: number;
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  data: unknown;
  createdAt: number;
};

export type RoundResult = {
  winnerPlayerId: string;
  scores: Record<string, number>;
  verdict: string;
  postStatus: "queued" | "publishing" | "posted" | "disabled" | "failed";
  postUrl?: string;
};

export type Room = {
  code: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  status: RoomStatus;
  roundNumber: number;
  prompt?: string;
  /** Which player is acting: players[turn]. Player 1 goes first, then player 2. */
  turn: 0 | 1;
  startedAt?: number;
  endsAt?: number;
  players: Player[];
  signals: Signal[];
  nextSignalId: number;
  judgingBy?: string;
  result?: RoundResult;
};
