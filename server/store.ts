import type { Room } from "./types.js";

/** Everything lives in this process. Restarting the API clears all rooms. */
const rooms = new Map<string, Room>();
const clips = new Map<string, Buffer>();
const locks = new Map<string, Promise<void>>();

export async function getRoom(code: string): Promise<Room | null> {
  return rooms.get(code) ?? null;
}

export function listRooms(): Room[] {
  return [...rooms.values()];
}

export async function saveRoom(room: Room, createOnly = false) {
  room.updatedAt = Date.now();
  if (createOnly && rooms.has(room.code)) throw new Error("ROOM_EXISTS");
  room.version = createOnly ? 1 : room.version + 1;
  rooms.set(room.code, structuredClone(room));
}

/** Serialises updates per room so two players can't clobber each other. */
export async function updateRoom<T>(code: string, update: (room: Room) => T | Promise<T>): Promise<T> {
  const previous = locks.get(code) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const chained = previous.then(() => current);
  locks.set(code, chained);
  await previous;
  try {
    const room = await getRoom(code);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    const output = await update(room);
    await saveRoom(room);
    return output;
  } finally {
    release();
    if (locks.get(code) === chained) locks.delete(code);
  }
}

export async function saveClip(path: string, bytes: Buffer) {
  clips.set(path, Buffer.from(bytes));
  return path;
}

export async function getClip(path: string): Promise<Buffer | null> {
  return clips.get(path) ?? null;
}

export async function deleteRoom(code: string) {
  const room = rooms.get(code);
  rooms.delete(code);
  room?.players.forEach((player) => player.clipPath && clips.delete(player.clipPath));
}

export async function deleteClip(path: string) {
  clips.delete(path);
}

export function resetMemoryStore() {
  rooms.clear();
  clips.clear();
}
