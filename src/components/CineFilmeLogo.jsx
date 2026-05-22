'use client';

import { useTheme } from './ThemeProvider';

const SIZES = {
  sm: { icon: 28, wordmark: 18, tagline: 8,  gap: 8  },
  md: { icon: 40, wordmark: 26, tagline: 10, gap: 10 },
  lg: { icon: 56, wordmark: 36, tagline: 12, gap: 14 },
};

export default function CineFilmeLogo({
  variant    = null,   // null = auto from ThemeContext
  size       = 'md',
  showTagline = true,
  accent     = '#7c5cff',
}) {
  const { theme } = useTheme();
  const dark = variant !== null ? variant === 'dark' : theme === 'dark';

  const ink    = dark ? '#f6f2e8' : '#0a0a0f';
  const stripe = dark ? '#0a0a0f' : '#f6f2e8';
  const muted  = dark ? 'rgba(246,242,232,0.35)' : 'rgba(10,10,15,0.35)';
  const s      = SIZES[size] ?? SIZES.md;
  const iconH  = Math.round(s.icon * 92 / 80);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: s.gap }}>
      {/* ── Popcorn bucket icon ── */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={s.icon}
        height={iconH}
        viewBox="0 0 80 92"
        fill="none"
        aria-hidden="true"
      >
        {/* Popcorn balls */}
        <circle cx="22" cy="24" r="9"  fill={ink} />
        <circle cx="40" cy="15" r="11" fill={ink} />
        <circle cx="58" cy="24" r="9"  fill={ink} />
        <circle cx="31" cy="29" r="6"  fill={ink} />
        <circle cx="50" cy="29" r="6"  fill={ink} />

        {/* Bucket body */}
        <path d="M13 32 L67 32 L61 84 L19 84 Z" fill={ink} />

        {/* Vertical stripes */}
        <path d="M29 32 L25 84 L31 84 L35 32 Z" fill={stripe} opacity="0.9" />
        <path d="M45 32 L41 84 L47 84 L51 32 Z" fill={stripe} opacity="0.9" />

        {/* Top rim */}
        <rect x="13" y="32" width="54" height="5" rx="2" fill={stripe} opacity="0.2" />
      </svg>

      {/* ── Text lockup ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: s.wordmark,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: ink,
            userSelect: 'none',
          }}
        >
          Cine<span style={{ color: accent }}>Filme</span>
        </span>

        {showTagline && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontWeight: 500,
              fontSize: s.tagline,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: muted,
              userSelect: 'none',
            }}
          >
            EST. 2026 · PRA CINÉFILOS
          </span>
        )}
      </div>
    </div>
  );
}
