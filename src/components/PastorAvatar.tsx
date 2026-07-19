type Props = {
  imageUrl?: string;
  name: string;
  initials: string;
  hue: number;
  /** Sizing, ring and text-size classes for the circular avatar. */
  className?: string;
};

/**
 * A pastor's circular avatar. Shows their photo when we have one, otherwise a
 * gradient tile with their initials. Used everywhere a pastor is listed so the
 * photos stay consistent across the site.
 */
export function PastorAvatar({ imageUrl, name, initials, hue, className = "" }: Props) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={`object-cover bg-white/10 ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center font-semibold text-white ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue},65%,38%), hsl(${(hue + 30) % 360},70%,22%))`,
      }}
    >
      {initials}
    </div>
  );
}
