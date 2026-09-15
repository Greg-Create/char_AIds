import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';

export type BackgroundVariant = 'video' | 'gradient';

/**
 * App-wide backdrop with two looks:
 * - 'video'    → looping cartoon video (home / join)
 * - 'gradient' → animated purple gradient with stars (game flow)
 *
 * Only the active layer is mounted, so the video is not decoding while the
 * wheel and camera are on screen. Switching crossfades briefly.
 */
export function Background({ variant }: { variant: BackgroundVariant }) {
  return (
    <div className="bg" aria-hidden>
      <AnimatePresence initial={false}>
        {variant === 'video' ? (
          <motion.div key="video" className="bg__layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <VideoLayer />
            <div className="bg__fade bg__fade--top" />
            <div className="bg__fade bg__fade--bottom" />
            <div className="bg__fade bg__fade--left" />
            <div className="bg__fade bg__fade--right" />
          </motion.div>
        ) : (
          <motion.div key="gradient" className="bg__layer bg__layer--gradient" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <GradientLayer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Video                                                               */
/* ------------------------------------------------------------------ */

/**
 * Performance notes:
 * - Muted + playsInline so every browser autoplays it without a gesture.
 * - Promoted to its own compositor layer; nothing above it uses backdrop-filter.
 * - Users with reduced-motion or data-saver get the still poster instead.
 */
function VideoLayer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduceMotion || saveData) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }
    // Browsers sometimes pause a muted autoplay loop on their own (tab hidden
    // during load, window resize, bfcache restore) and never resume it. There
    // are no controls, so a pause is never intentional: keep it running
    // whenever the page is visible.
    const play = () => {
      if (!document.hidden && video.paused) void video.play().catch(() => {});
    };
    let retry = 0;
    const onPause = () => {
      window.clearTimeout(retry);
      retry = window.setTimeout(play, 150);
    };
    const onVisibility = () => (document.hidden ? video.pause() : play());
    play();
    video.addEventListener('pause', onPause);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', play);
    window.addEventListener('pageshow', play);
    return () => {
      window.clearTimeout(retry);
      video.removeEventListener('pause', onPause);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', play);
      window.removeEventListener('pageshow', play);
    };
  }, []);

  return (
    <video ref={videoRef} className="bg__video" autoPlay muted loop playsInline preload="auto" poster="/bg-poster.jpg" disablePictureInPicture disableRemotePlayback>
      <source src="/bg-loop.webm" type="video/webm" />
      <source src="/bg-loop.mp4" type="video/mp4" />
    </video>
  );
}

/* ------------------------------------------------------------------ */
/* Gradient + stars                                                    */
/* ------------------------------------------------------------------ */

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function GradientLayer() {
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        top: rand(0, 100),
        left: rand(0, 100),
        size: rand(10, 26),
        duration: rand(1.6, 3.6),
        delay: -rand(0, 3),
        glyph: i % 3 === 0 ? '✦' : i % 3 === 1 ? '✧' : '★',
      })),
    [],
  );

  return (
    <>
      <div className="bg__glow" style={{ width: '55vmax', height: '55vmax', left: '-10%', top: '-15%', background: '#38bdf8' }} />
      <div className="bg__glow" style={{ width: '50vmax', height: '50vmax', right: '-15%', bottom: '-20%', background: '#ffd93d', animationDelay: '-9s' }} />
      {stars.map((s) => (
        <span key={s.id} className="star" style={{ top: `${s.top}%`, left: `${s.left}%`, fontSize: s.size, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }}>
          {s.glyph}
        </span>
      ))}
    </>
  );
}
