import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import app from "./app.js";
import { resetMemoryStore, updateRoom } from "./store.js";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  resetMemoryStore();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function json(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  return { response, body };
}

function auth(session: Record<string, any>) {
  return { authorization: `Bearer ${session.playerToken}`, "x-player-id": session.playerId };
}

test("two players can complete a full round", async () => {
  const created = await json("/rooms", { method: "POST" });
  assert.equal(created.response.status, 201);
  const host = created.body;
  assert.equal(host.roomCode.length, 6);

  const joined = await json(`/rooms/${host.roomCode}/join`, { method: "POST" });
  assert.equal(joined.response.status, 201);
  const guest = joined.body;

  const health = await json("/health");
  assert.equal(health.body.geminiModel, "gemini-3.5-flash-lite");
  assert.equal(health.body.verdictDeadlineMs, 3000);
  assert.equal(health.body.directClipUpload, false);

  const signal = await json(`/rooms/${host.roomCode}/signals`, {
    method: "POST",
    headers: { ...auth(host), "content-type": "application/json" },
    body: JSON.stringify({ kind: "offer", data: { type: "offer", sdp: "test" } }),
  });
  assert.equal(signal.response.status, 201);
  const signals = await json(`/rooms/${host.roomCode}/signals?after=0`, { headers: auth(guest) });
  assert.equal(signals.body.signals.length, 1);

  await json(`/rooms/${host.roomCode}/ready`, {
    method: "POST",
    headers: { ...auth(host), "content-type": "application/json" },
    body: JSON.stringify({ consent: false }),
  });
  const ready = await json(`/rooms/${host.roomCode}/ready`, {
    method: "POST",
    headers: { ...auth(guest), "content-type": "application/json" },
    body: JSON.stringify({ consent: false }),
  });
  assert.equal(ready.body.status, "lobby");

  const guestStart = await json(`/rooms/${host.roomCode}/start`, { method: "POST", headers: auth(guest) });
  assert.equal(guestStart.response.status, 409);

  const started = await json(`/rooms/${host.roomCode}/start`, { method: "POST", headers: auth(host) });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.status, "wheel");
  assert.equal(started.body.roundNumber, 1);
  assert.equal(typeof started.body.prompt, "string");

  const revealed = await json(`/rooms/${host.roomCode}/advance`, {
    method: "POST",
    headers: { ...auth(host), "content-type": "application/json" },
    body: JSON.stringify({ to: "reveal" }),
  });
  assert.equal(revealed.body.status, "reveal");
  const round = await json(`/rooms/${host.roomCode}/advance`, {
    method: "POST",
    headers: { ...auth(host), "content-type": "application/json" },
    body: JSON.stringify({ to: "round" }),
  });
  assert.equal(round.body.status, "round");

  for (const session of [host, guest]) {
    for (let segmentIndex = 0; segmentIndex < 2; segmentIndex += 1) {
      const form = new FormData();
      form.append("segment", new Blob([`motion-${session.playerId}-${segmentIndex}`], { type: "video/webm" }), `segment-${segmentIndex}.webm`);
      form.append("segmentIndex", String(segmentIndex));
      const analyzed = await json(`/rooms/${host.roomCode}/segments`, { method: "POST", headers: auth(session), body: form });
      assert.equal(analyzed.response.status, 202);
      assert.equal(analyzed.body.segmentIndex, segmentIndex);
    }
  }

  await updateRoom(host.roomCode, (room) => { room.endsAt = Date.now() - 1; });
  for (const session of [host, guest]) {
    const form = new FormData();
    form.append("clip", new Blob([`fake-video-${session.playerId}`], { type: "video/webm" }), "round.webm");
    const uploaded = await json(`/rooms/${host.roomCode}/clips`, { method: "POST", headers: auth(session), body: form });
    assert.equal(uploaded.response.status, 201);
  }

  const judgingStartedAt = Date.now();
  const judged = await json(`/rooms/${host.roomCode}/judge`, { method: "POST", headers: auth(host) });
  assert.equal(judged.response.status, 200);
  assert.ok(Date.now() - judgingStartedAt < 3000);
  assert.ok(["you", "opponent"].includes(judged.body.winnerId));
  assert.equal(typeof judged.body.youScore, "number");
  assert.equal(judged.body.postStatus, "disabled");

  const finalRoom = await json(`/rooms/${host.roomCode}`, { headers: auth(guest) });
  assert.equal(finalRoom.body.status, "result");
  assert.ok(finalRoom.body.result);

  const nextRound = await json(`/rooms/${host.roomCode}/start`, { method: "POST", headers: auth(host) });
  assert.equal(nextRound.body.status, "wheel");
  assert.equal(nextRound.body.roundNumber, 2);
  assert.equal(nextRound.body.result, undefined);
  assert.ok(nextRound.body.players.every((player: Record<string, any>) => !player.clipReady));

  const guestLeft = await json(`/rooms/${host.roomCode}/leave`, { method: "POST", headers: auth(guest) });
  assert.equal(guestLeft.response.status, 204);
  const afterGuestLeft = await json(`/rooms/${host.roomCode}`, { headers: auth(host) });
  assert.equal(afterGuestLeft.body.status, "lobby");
  assert.equal(afterGuestLeft.body.players.length, 1);

  const hostLeft = await json(`/rooms/${host.roomCode}/leave`, { method: "POST", headers: auth(host) });
  assert.equal(hostLeft.response.status, 204);
  const deleted = await json(`/rooms/${host.roomCode}`, { headers: auth(host) });
  assert.equal(deleted.response.status, 404);
});
