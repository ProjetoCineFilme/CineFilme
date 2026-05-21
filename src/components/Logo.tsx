interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={Math.round(size * 92 / 80)}
      viewBox="0 0 80 92"
      fill="none"
      className={className}
    >
      {/* Popcorn balls — warm cream */}
      <circle cx="22" cy="24" r="9"  fill="#f6f2e8" />
      <circle cx="40" cy="16" r="11" fill="#f6f2e8" />
      <circle cx="58" cy="24" r="9"  fill="#f6f2e8" />
      <circle cx="32" cy="28" r="6"  fill="#f6f2e8" />
      <circle cx="50" cy="28" r="6"  fill="#f6f2e8" />

      {/* Cup */}
      <path d="M14 32 L66 32 L60 84 L20 84 Z" fill="#0f0f12" />

      {/* Cup stripes */}
      <rect x="28" y="32" width="6" height="52" fill="#f6f2e8" opacity="0.18" />
      <rect x="46" y="32" width="6" height="52" fill="#f6f2e8" opacity="0.18" />
    </svg>
  );
}
