import assert from 'node:assert/strict';
import test from 'node:test';
import { postLosingClip } from './x.js';

test('X upload accepts WebM and tolerates an empty APPEND response', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnabled = process.env.ENABLE_X_POSTS;
  const originalToken = process.env.X_USER_ACCESS_TOKEN;
  process.env.ENABLE_X_POSTS = 'true';
  process.env.X_USER_ACCESS_TOKEN = 'test-token';
  let initializedAs = '';
  let calls = 0;

  globalThis.fetch = async (_input, init) => {
    calls += 1;
    if (calls === 1) {
      initializedAs = String((init?.body as FormData).get('media_type'));
      return Response.json({ data: { id: '123' } });
    }
    if (calls === 2) return new Response(null, { status: 204 });
    if (calls === 3) return Response.json({ data: { id: '123' } });
    return Response.json({ data: { id: '456' } });
  };

  try {
    const result = await postLosingClip(Buffer.from('webm-video'), 'video/webm;codecs=vp8', 'ABC123');
    assert.equal(initializedAs, 'video/webm');
    assert.equal(result.status, 'posted');
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnabled === undefined) delete process.env.ENABLE_X_POSTS;
    else process.env.ENABLE_X_POSTS = originalEnabled;
    if (originalToken === undefined) delete process.env.X_USER_ACCESS_TOKEN;
    else process.env.X_USER_ACCESS_TOKEN = originalToken;
  }
});
