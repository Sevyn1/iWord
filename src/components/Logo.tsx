import * as React from "react";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

/**
 * iWord logo. The dot of the "i" is a glowing sun — "let there be light"
 * paired with "the Word." Pure inline SVG, no external assets.
 */
export function Logo({ size = 28, showWordmark = true, className }: LogoProps) {
  const h = size;
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        width={h}
        height={h}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="iword-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F8D89A" />
            <stop offset="60%" stopColor="#E0B265" />
            <stop offset="100%" stopColor="#B5853A" />
          </radialGradient>
        </defs>
        {/* outer ring */}
        <circle cx="20" cy="20" r="18" stroke="#B5853A" strokeWidth="1.3" opacity="0.55" />
        {/* the "i" stem */}
        <rect x="17.5" y="17" width="5" height="17" rx="2.5" fill="#1B2138" />
        {/* the sun-dot */}
        <circle cx="20" cy="10" r="4.2" fill="url(#iword-sun)" />
        {/* small rays */}
        <g stroke="#E0B265" strokeWidth="1.1" strokeLinecap="round" opacity="0.85">
          <line x1="20" y1="2"  x2="20" y2="4.5" />
          <line x1="28" y1="10" x2="25.8" y2="10" />
          <line x1="12" y1="10" x2="14.2" y2="10" />
          <line x1="25.8" y1="4.2" x2="24.2" y2="5.8" />
          <line x1="14.2" y1="4.2" x2="15.8" y2="5.8" />
        </g>
      </svg>
      {showWordmark && (
        <span
          className="font-display text-cream text-xl tracking-tight"
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          <span className="text-gold">i</span>Word
        </span>
      )}
    </span>
  );
}
