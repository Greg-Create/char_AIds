import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { BigButton } from '../ui/BigButton';

type Status = 'loading' | 'ok' | 'denied' | 'unsupported';

export type CameraStatus = Status;

interface CameraProps {
  /** Fires once the permission prompt resolves (granted, denied, or unsupported). */
  onReady?: (status: Exclude<Status, 'loading'>) => void;
  children?: React.ReactNode;
}

/** Live webcam preview inside a chunky game frame, with a graceful no-camera fallback. */
export function Camera({ onReady, children }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (status !== 'loading') onReadyRef.current?.(status);
  }, [status]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    setStatus('loading');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('denied');
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  return (
    <div className="camera-wrap">
      <span className="camera-deco" style={{ top: -28, left: -22, animationDuration: '4.2s' }}>🎬</span>
      <span className="camera-deco" style={{ top: -30, right: -18, animationDuration: '5s', animationDelay: '-2s' }}>⭐</span>
      <span className="camera-deco" style={{ bottom: -26, left: -26, animationDuration: '4.6s', animationDelay: '-1s' }}>🎭</span>
      <span className="camera-deco" style={{ bottom: -24, right: -22, animationDuration: '3.8s', animationDelay: '-3s' }}>✨</span>

      <motion.div
        className="camera-frame"
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
      >
        <video ref={videoRef} autoPlay playsInline muted style={{ display: status === 'ok' ? 'block' : 'none' }} />
        <div className="camera-frame__vignette" />
        {status === 'ok' && (
          <div className="camera-frame__label">
            <span className="rec-dot" /> LIVE
          </div>
        )}
        {status === 'loading' && (
          <div className="camera-frame__fallback">
            <div className="big">📸</div>
            <strong style={{ fontSize: 22 }}>Warming up the camera…</strong>
            <span style={{ opacity: 0.85 }}>Say yes to the camera prompt!</span>
          </div>
        )}
        {status === 'denied' && (
          <div className="camera-frame__fallback">
            <div className="big">🙈</div>
            <strong style={{ fontSize: 24 }}>No camera? No problem!</strong>
            <span style={{ opacity: 0.85, maxWidth: 320 }}>Act it out for the room anyway. You can allow camera access and try again.</span>
            <BigButton size="sm" variant="pink" icon="🔄" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </BigButton>
          </div>
        )}
        {status === 'unsupported' && (
          <div className="camera-frame__fallback">
            <div className="big">🎥</div>
            <strong style={{ fontSize: 24 }}>This browser has no camera support</strong>
            <span style={{ opacity: 0.85 }}>Act it out for the room instead!</span>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  );
}
