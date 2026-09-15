import { del, get, put } from "@vercel/blob";
import type { Room } from "./types.js";

const rooms = new Map<string, Room>();
const clips = new Map<string, Buffer>();
const locks = new Map<string, Promise<void>>();

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const roomStorageMode = redisUrl && redisToken ? "redis" : "memory";
export const clipStorageMode = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN ? "vercel-blob" : "memory";

const roomKey = (code: string) => `charadoom:room:${code}`;
const ROOM_TTL_SECONDS = 24 * 60 * 60;

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export async function getRoom(code: string): Promise<Room | null> {
  if (roomStorageMode === "memory") return rooms.get(code) ?? null;
  const result = await redisCommand(["GET", roomKey(code)]) as string | null;
  return result ? JSON.parse(result) as Room : null;
}

async function redisCommand(command: Array<string | number>) {
  const response = await fetch(redisUrl!, {
    method: "POST",
    headers: { authorization: `Bearer ${redisToken}`, "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Redis failed: ${response.status}`);
  const data = await response.json() as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Redis failed: ${data.error}`);
  return data.result;
}

export async function saveRoom(room: Room, createOnly = false, expectedVersion?: number) {
  room.updatedAt = Date.now();
  if (roomStorageMode === "memory") {
    if (createOnly && rooms.has(room.code)) throw new Error("ROOM_EXISTS");
    room.version = createOnly ? 1 : (expectedVersion ?? room.version) + 1;
    rooms.set(room.code, structuredClone(room));
    return;
  }
  if (createOnly) {
    room.version = 1;
    const result = await redisCommand(["SET", roomKey(room.code), JSON.stringify(room), "NX", "EX", ROOM_TTL_SECONDS]);
    if (result !== "OK") throw new Error("ROOM_EXISTS");
    return;
  }
  if (expectedVersion === undefined) throw new Error("ROOM_CONFLICT");
  room.version = expectedVersion + 1;
  const script = "local v=redis.call('GET',KEYS[1]); if not v then return -1 end; local d=cjson.decode(v); if tonumber(d.version)~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'KEEPTTL'); return 1";
  const result = await redisCommand(["EVAL", script, 1, roomKey(room.code), expectedVersion, JSON.stringify(room)]);
  if (result !== 1) throw new Error(result === -1 ? "ROOM_NOT_FOUND" : "ROOM_CONFLICT");
}

export async function updateRoom<T>(code: string, update: (room: Room) => T | Promise<T>): Promise<T> {
  const previous = locks.get(code) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const chained = previous.then(() => current);
  locks.set(code, chained);
  await previous;
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const room = await getRoom(code);
      if (!room) throw new Error("ROOM_NOT_FOUND");
      const version = room.version;
      const output = await update(room);
      try {
        await saveRoom(room, false, version);
        return output;
      } catch (error) {
        if ((error as Error).message !== "ROOM_CONFLICT" || attempt === 5) throw error;
      }
    }
    throw new Error("ROOM_CONFLICT");
  } finally {
    release();
    if (locks.get(code) === chained) locks.delete(code);
  }
}

export async function saveClip(path: string, bytes: Buffer, contentType: string) {
  if (clipStorageMode === "memory") {
    clips.set(path, Buffer.from(bytes));
    return path;
  }
  await put(path, bytes, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: bytes.byteLength > 4_000_000,
  });
  return path;
}

export async function getClip(path: string): Promise<Buffer | null> {
  if (clipStorageMode === "memory") return clips.get(path) ?? null;
  const result = await get(path, { access: "private" });
  if (!result?.stream || result.statusCode !== 200) return null;
  return streamToBuffer(result.stream);
}

export async function deleteRoom(code: string) {
  const room = await getRoom(code);
  if (roomStorageMode === "memory") rooms.delete(code);
  else await redisCommand(["DEL", roomKey(code)]);
  const paths = room?.players.flatMap((player) => player.clipPath ? [player.clipPath] : []) ?? [];
  if (clipStorageMode === "memory") {
    paths.forEach((path) => clips.delete(path));
  } else if (paths.length) {
    await del(paths);
  }
}

export async function deleteClip(path: string) {
  if (clipStorageMode === "memory") clips.delete(path);
  else await del(path);
}

export function resetMemoryStore() {
  rooms.clear();
  clips.clear();
}
