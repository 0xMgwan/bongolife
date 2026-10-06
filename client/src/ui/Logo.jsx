export function Crown({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="tzflag" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1eb53a" /><stop offset=".42" stopColor="#1eb53a" />
          <stop offset=".42" stopColor="#fcd116" /><stop offset=".47" stopColor="#fcd116" />
          <stop offset=".47" stopColor="#111" /><stop offset=".6" stopColor="#111" />
          <stop offset=".6" stopColor="#fcd116" /><stop offset=".65" stopColor="#fcd116" />
          <stop offset=".65" stopColor="#00a3dd" />
        </linearGradient>
      </defs>
      <path d="M10 46 L8 18 L22 29 L32 10 L42 29 L56 18 L54 46 Z" fill="#f6b11a" stroke="#c98a07" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="8" cy="17" r="3.5" fill="#f6b11a" /><circle cx="32" cy="9" r="3.5" fill="#f6b11a" /><circle cx="56" cy="17" r="3.5" fill="#f6b11a" />
      <rect x="9" y="44" width="46" height="10" rx="3" fill="url(#tzflag)" />
      <path d="M32 28 l5 6 -5 6 -5 -6 z" fill="#2fb06f" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ size = 22 }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <Crown size={size * 1.35} />
      Bongo Life
    </span>
  );
}
