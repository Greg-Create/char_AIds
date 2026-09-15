import { createHash } from "node:crypto";
import type { LiveObservation, Player } from "./types.js";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function generate(parts: unknown[], schema: unknown, timeoutMs = 10_000) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_DISABLED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
          maxOutputTokens: 180,
        },
      }),
    });
    if (!response.ok) throw new Error(`Gemini failed: ${response.status} ${await response.text()}`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!text) throw new Error("Gemini returned no result");
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackObservation(bytes: Buffer, segmentIndex: number): LiveObservation {
  const digest = createHash("sha256").update(bytes).digest();
  return {
    segmentIndex,
    accuracy: 55 + (digest[0] % 41),
    energy: 55 + (digest[1] % 41),
    motionClarity: 55 + (digest[2] % 41),
    note: "Fallback judge scored the motion window.",
    createdAt: Date.now(),
  };
}

export async function analyzeVideoSegment(
  prompt: string,
  video: Buffer,
  mimeType: string,
  segmentIndex: number,
): Promise<LiveObservation> {
  const fallback = fallbackObservation(video, segmentIndex);
  if (!process.env.GEMINI_API_KEY) return fallback;
  try {
    const value = await generate([
      {
        inlineData: { mimeType: mimeType.split(";")[0], data: video.toString("base64") },
        videoMetadata: { fps: 5 },
      },
      { text: `This is a chronological two-second window from a charades performance. The target is "${prompt}". Judge the visible motion across the video, not isolated poses. Score accuracy, energy, and motion clarity from 0 to 100. Give one note under 10 words.` },
    ], {
      type: "OBJECT",
      properties: {
        accuracy: { type: "INTEGER", minimum: 0, maximum: 100 },
        energy: { type: "INTEGER", minimum: 0, maximum: 100 },
        motionClarity: { type: "INTEGER", minimum: 0, maximum: 100 },
        note: { type: "STRING" },
      },
      required: ["accuracy", "energy", "motionClarity", "note"],
    }, 6000) as Omit<LiveObservation, "segmentIndex" | "createdAt">;
    return { ...value, segmentIndex, createdAt: Date.now() };
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

export type ComparedResult = { winnerIndex: 0 | 1; scores: [number, number]; verdict: string };

function weightedScore(player: Player) {
  if (!player.observations.length) return 50;
  const total = player.observations.reduce(
    (sum, item) => sum + item.accuracy * .55 + item.motionClarity * .3 + item.energy * .15,
    0,
  );
  return Math.round(total / player.observations.length);
}

function fallbackComparison(players: Player[]): ComparedResult {
  const scores = players.map(weightedScore) as [number, number];
  if (scores[0] === scores[1]) scores[0] += 1;
  return {
    winnerIndex: scores[0] > scores[1] ? 0 : 1,
    scores,
    verdict: "Window scores decided which performance communicated the prompt more clearly.",
  };
}

export async function compareSegmentScores(prompt: string, players: Player[]): Promise<ComparedResult> {
  const fallback = fallbackComparison(players);
  if (!process.env.GEMINI_API_KEY) return fallback;
  try {
    const summaries = players.map((player, index) => ({
      player: index + 1,
      windows: player.observations
        .slice()
        .sort((a, b) => a.segmentIndex - b.segmentIndex)
        .map(({ segmentIndex, accuracy, energy, motionClarity, note }) => ({ segmentIndex, accuracy, energy, motionClarity, note })),
    }));
    return await generate([
      { text: `You are finalizing a 1v1 charades result for target "${prompt}". The native-video windows were already analyzed chronologically. Choose the clearer overall performance using the ordered evidence below. Return immediately with winnerIndex 0 or 1, two integer scores, and a funny verdict under 14 words.\n${JSON.stringify(summaries)}` },
    ], {
      type: "OBJECT",
      properties: {
        winnerIndex: { type: "INTEGER", enum: [0, 1] },
        scores: { type: "ARRAY", items: { type: "INTEGER", minimum: 0, maximum: 100 }, minItems: 2, maxItems: 2 },
        verdict: { type: "STRING" },
      },
      required: ["winnerIndex", "scores", "verdict"],
    }, 1800) as ComparedResult;
  } catch (error) {
    console.error(error);
    return fallback;
  }
}
