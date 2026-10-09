import * as React from "react";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

/**
 * iWord logo — "Radiant Book": an open book under a burst of light,
 * the Word illuminated. Pure inline SVG, no external assets.
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
          <linearGradient id="iword-page" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5EFE2" />
            <stop offset="100%" stopColor="#D8CDB4" />
          </linearGradient>
        </defs>
        {/* outer ring */}
        <circle cx="20" cy="20" r="18" stroke="#B5853A" strokeWidth="1.3" opacity="0.55" />
        {/* light burst above the book */}
        <circle cx="20" cy="13.5" r="3.4" fill="url(#iword-sun)" />
        <g stroke="#E0B265" strokeWidth="1.1" strokeLinecap="round" opacity="0.9">
          <line x1="20" y1="6" x2="20" y2="8.6" />
          <line x1="13.6" y1="8.4" x2="15.4" y2="10.2" />
          <line x1="26.4" y1="8.4" x2="24.6" y2="10.2" />
          <line x1="11.5" y1="13.5" x2="14.2" y2="13.5" />
          <line x1="28.5" y1="13.5" x2="25.8" y2="13.5" />
        </g>
        {/* open book */}
        <path
          d="M8.5 21.5c4-1.8 8-1.8 11.5 0.8 3.5-2.6 7.5-2.6 11.5-0.8V31c-4-1.8-8-1.8-11.5 0.8C16.5 29.2 12.5 29.2 8.5 31V21.5Z"
          fill="url(#iword-page)"
        />
        <path d="M20 22.3v9.5" stroke="#B5853A" strokeWidth="1" opacity="0.7" />
        <path
          d="M8.5 21.5c4-1.8 8-1.8 11.5 0.8 3.5-2.6 7.5-2.6 11.5-0.8V31c-4-1.8-8-1.8-11.5 0.8C16.5 29.2 12.5 29.2 8.5 31V21.5Z"
          stroke="#B5853A"
          strokeWidth="1.1"
        />
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
