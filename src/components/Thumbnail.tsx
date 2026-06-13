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
  const a = `hsl(${hue}, 60%, 22%)`;
  const b = `hsl(${(hue + 35) % 360}, 70%, 14%)`;
  const accent = `hsl(${(hue + 18) % 360}, 80%, 60%)`;
  const titleSize =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";

  return (
    <div
      className={`relative w-full aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-line ${className ?? ""}`}
      style={{
        background: `radial-gradient(120% 100% at 20% 10%, ${a} 0%, ${b} 60%, #060A1E 100%)`,
      }}
    >
      {/* faint scripture-paper lines */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #F4EFE4 0 1px, transparent 1px 22px)",
        }}
      />
      {/* sun-glow accent */}
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-2xl"
        style={{ background: accent, opacity: 0.35 }}
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
