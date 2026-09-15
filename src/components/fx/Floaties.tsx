interface Floaty {
  glyph: string;
  top: string;
  left?: string;
  right?: string;
  duration: number;
  delay: number;
  size?: string;
}

const HOME_FLOATIES: Floaty[] = [
  { glyph: '🎭', top: '10%', left: '6%', duration: 5.5, delay: 0, size: 'clamp(48px, 9vw, 110px)' },
  { glyph: '⭐', top: '18%', right: '10%', duration: 4.2, delay: -1 },
  { glyph: '❓', top: '58%', left: '8%', duration: 4.8, delay: -2, size: 'clamp(44px, 8vw, 96px)' },
  { glyph: '💬', top: '68%', right: '7%', duration: 5.2, delay: -0.5 },
  { glyph: '🃏', top: '38%', right: '4%', duration: 6, delay: -3 },
  { glyph: '🎉', top: '82%', left: '22%', duration: 4.6, delay: -1.5 },
  { glyph: '🎪', top: '4%', left: '22%', duration: 6.4, delay: -2.5 },
  { glyph: '✨', top: '84%', right: '26%', duration: 3.8, delay: -0.8 },
  { glyph: '🤸', top: '40%', left: '3%', duration: 5.8, delay: -4, size: 'clamp(40px, 7vw, 84px)' },
];

/** Cartoon decorations that drift around the hero. */
export function Floaties({ items = HOME_FLOATIES }: { items?: Floaty[] }) {
  return (
    <>
      {items.map((f, i) => (
        <span
          key={i}
          className="floaty"
          aria-hidden
          style={{
            top: f.top,
            left: f.left,
            right: f.right,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            fontSize: f.size,
          }}
        >
          {f.glyph}
        </span>
      ))}
    </>
  );
}
