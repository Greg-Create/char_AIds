import { useMemo } from 'react';

const COLORS = ['#ffd93d', '#ff6bb5', '#38bdf8', '#4ade80', '#ff8a3d', '#a78bfa'];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Always-on ambient layer: gradient shift, glows, rising bubbles, twinkling stars. */
export function Background() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        size: rand(28, 130),
        left: rand(-4, 100),
        duration: rand(14, 30),
        delay: -rand(0, 30),
        color: COLORS[i % COLORS.length],
      })),
    [],
  );
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
    <div className="bg" aria-hidden>
      <div className="bg__glow" style={{ width: '55vmax', height: '55vmax', left: '-10%', top: '-15%', background: '#38bdf8' }} />
      <div className="bg__glow" style={{ width: '50vmax', height: '50vmax', right: '-15%', bottom: '-20%', background: '#ffd93d', animationDelay: '-9s' }} />
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="bubble"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            borderColor: b.color,
          }}
        />
      ))}
      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={{ top: `${s.top}%`, left: `${s.left}%`, fontSize: s.size, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }}
        >
          {s.glyph}
        </span>
      ))}
    </div>
  );
}
