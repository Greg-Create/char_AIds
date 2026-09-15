const VIDEO_BITS_PER_SECOND = 1_400_000;
const SEGMENT_MS = 1_900;

export function preferredRecordingMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export type CaptureResult = {
  clip: Blob;
  segmentUploads: Promise<void>[];
};

export type RoundCapture = {
  mimeType: string;
  stop: () => Promise<CaptureResult>;
};

export function startRoundCapture(
  stream: MediaStream,
  uploadSegment: (segment: Blob, index: number) => Promise<unknown>,
  onSegmentError?: (error: Error) => void,
): RoundCapture {
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record video.');
  const selectedMimeType = preferredRecordingMimeType();
  const options: MediaRecorderOptions = {
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    ...(selectedMimeType ? { mimeType: selectedMimeType } : {}),
  };
  const fullRecorder = new MediaRecorder(stream, options);
  const fullChunks: BlobPart[] = [];
  const segmentUploads: Promise<void>[] = [];
  let active = true;
  let segmentIndex = 0;
  let segmentRecorder: MediaRecorder | null = null;
  let segmentTimer: number | undefined;
  let segmentStopped: Promise<void> = Promise.resolve();

  const mimeType = fullRecorder.mimeType || selectedMimeType || 'video/webm';
  let resolveFull!: (clip: Blob) => void;
  const fullStopped = new Promise<Blob>((resolve) => { resolveFull = resolve; });
  fullRecorder.ondataavailable = (event) => {
    if (event.data.size) fullChunks.push(event.data);
  };
  fullRecorder.onstop = () => resolveFull(new Blob(fullChunks, { type: mimeType }));
  fullRecorder.start();

  const beginSegment = () => {
    if (!active || segmentIndex > 9) return;
    const recorder = new MediaRecorder(stream, options);
    segmentRecorder = recorder;
    const chunks: BlobPart[] = [];
    let resolveSegment!: () => void;
    segmentStopped = new Promise<void>((resolve) => { resolveSegment = resolve; });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const index = segmentIndex;
      segmentIndex += 1;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (blob.size) {
        const pending = uploadSegment(blob, index)
          .then(() => undefined)
          .catch((error: unknown) => onSegmentError?.(error instanceof Error ? error : new Error(String(error))));
        segmentUploads.push(pending);
      }
      resolveSegment();
      if (active) queueMicrotask(beginSegment);
    };
    recorder.start();
    segmentTimer = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, SEGMENT_MS);
  };

  beginSegment();

  return {
    mimeType,
    async stop() {
      if (!active) return { clip: await fullStopped, segmentUploads };
      active = false;
      if (segmentTimer !== undefined) window.clearTimeout(segmentTimer);
      if (segmentRecorder?.state === 'recording') segmentRecorder.stop();
      await segmentStopped;
      if (fullRecorder.state === 'recording') fullRecorder.stop();
      return { clip: await fullStopped, segmentUploads };
    },
  };
}
