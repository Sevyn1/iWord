import * as React from "react";

type ThumbnailProps = {
  title: string;
  hue: number;
  /** Optional small label shown above the title (e.g. scripture ref). */
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** When true, render only the gradient art with no title/label overlay. */
  hideText?: boolean;
};

/**
 * Deterministic gradient thumbnail. No external image deps — gives every
 * sermon card a distinct look seeded by `hue`.
 */
export function Thumbnail({
  title,
  hue,
  label,
  className,
  size = "md",
  hideText = false,
}: ThumbnailProps) {
  const a = `hsl(${hue}, 72%, 42%)`;
  const b = `hsl(${(hue + 38) % 360}, 74%, 26%)`;
  const c = `hsl(${(hue - 10 + 360) % 360}, 60%, 14%)`;
  const accent = `hsl(${(hue + 18) % 360}, 92%, 64%)`;
  const titleSize =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";

  return (
    <div
      className={`relative w-full aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-line ${className ?? ""}`}
      style={{
        background: `radial-gradient(130% 110% at 18% 0%, ${a} 0%, ${b} 52%, ${c} 100%)`,
      }}
    >
      {/* faint scripture-paper lines */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #F6F1E7 0 1px, transparent 1px 22px)",
        }}
      />
      {/* glossy top highlight */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/2"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)",
        }}
      />
      {/* sun-glow accent */}
      <div
        aria-hidden
        className="absolute -top-12 -right-8 w-52 h-52 rounded-full blur-2xl"
        style={{ background: accent, opacity: 0.55 }}
      />
      {/* readability scrim behind text */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "linear-gradient(0deg, rgba(6,10,30,0.6), transparent)",
        }}
      />
      <div className="absolute inset-0 p-4 flex flex-col justify-end">
        {!hideText && label && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-cream/70 mb-1">
            {label}
          </span>
        )}
        {!hideText && (
          <span className={`font-display ${titleSize} leading-tight text-cream drop-shadow-sm`}>
            {title}
          </span>
        )}
      </div>
    </div>
  );
}
