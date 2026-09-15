import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeVideoSegment, GEMINI_MODEL } from './gemini.js';

test('Gemini receives a native video window sampled at 5 FPS', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let requestedUrl = '';
  let requestedBody: Record<string, any> = {};

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body));
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ accuracy: 90, energy: 80, motionClarity: 85, note: 'Clear motion' }) }] } }],
    });
  };

  try {
    const observation = await analyzeVideoSegment('Dinosaur', Buffer.from('native-video'), 'video/webm;codecs=vp8', 3);
    const videoPart = requestedBody.contents[0].parts[0];
    assert.ok(requestedUrl.includes(`/models/${GEMINI_MODEL}:generateContent`));
    assert.equal(videoPart.inlineData.mimeType, 'video/webm');
    assert.equal(videoPart.inlineData.data, Buffer.from('native-video').toString('base64'));
    assert.equal(videoPart.videoMetadata.fps, 5);
    assert.equal(requestedBody.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
    assert.equal(observation.segmentIndex, 3);
    assert.equal(observation.accuracy, 90);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
