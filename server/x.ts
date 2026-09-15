const X_API = "https://api.x.com/2";

async function xFetch(path: string, init: RequestInit) {
  const response = await fetch(`${X_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.X_USER_ACCESS_TOKEN}`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`X API failed: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) as Record<string, any> : {};
}

function uploadForm(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

export async function postLosingClip(bytes: Buffer, mimeType: string, roomCode: string) {
  if (process.env.ENABLE_X_POSTS !== "true" || !process.env.X_USER_ACCESS_TOKEN) {
    return { status: "disabled" as const };
  }
  const mediaType = mimeType.split(";")[0];
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(mediaType)) {
    throw new Error(`X video posting does not support ${mediaType}`);
  }

  const initialized = await xFetch("/media/upload", {
    method: "POST",
    body: uploadForm({
      command: "INIT",
      total_bytes: String(bytes.byteLength),
      media_type: mediaType,
      media_category: "tweet_video",
    }),
  });
  const mediaId = String(initialized.data?.id);
  if (!mediaId) throw new Error("X did not return a media id");

  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0, segment = 0; offset < bytes.byteLength; offset += chunkSize, segment += 1) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
    await xFetch("/media/upload", {
      method: "POST",
      body: uploadForm({
        command: "APPEND",
        media_id: mediaId,
        segment_index: String(segment),
        media: new Blob([Uint8Array.from(chunk)], { type: mediaType }),
      }),
    });
  }

  let finalized = await xFetch("/media/upload", {
    method: "POST",
    body: uploadForm({ command: "FINALIZE", media_id: mediaId }),
  });
  let mediaReady = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const processing = finalized.data?.processing_info;
    if (!processing || processing.state === "succeeded") { mediaReady = true; break; }
    if (processing.state === "failed") throw new Error("X rejected the video");
    await new Promise((resolve) => setTimeout(resolve, Math.min(Number(processing.check_after_secs || 1), 5) * 1000));
    finalized = await xFetch(`/media/upload?command=STATUS&media_id=${mediaId}`, { method: "GET" });
  }
  if (!mediaReady) throw new Error("X video processing timed out");

  const post = await xFetch("/tweets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: `Lost a 15-second charades duel in room ${roomCode}. The AI has spoken.`,
      media: { media_ids: [mediaId] },
    }),
  });
  const postId = String(post.data?.id);
  const username = process.env.X_ACCOUNT_USERNAME;
  return {
    status: "posted" as const,
    url: username && postId ? `https://x.com/${username}/status/${postId}` : undefined,
  };
}
