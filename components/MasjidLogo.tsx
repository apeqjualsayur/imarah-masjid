import { initials } from "@/lib/logo";

type Props = {
  name: string;
  /** A signed link to the logo, or null for initials. */
  src: string | null;
  shape?: "circle" | "square";
  className?: string;
};

/**
 * The masjid's logo, fitted inside the shape without cropping. Without a logo
 * it shows the name's initials in a tint circle.
 */
export function MasjidLogo({ name, src, shape = "circle", className = "size-12" }: Props) {
  const rounded = shape === "circle" ? "rounded-pill" : "rounded-card";

  if (!src) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center bg-tint font-bold text-primary-dark ${rounded} ${className}`}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-surface ${rounded} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link from private storage */}
      <img src={src} alt="" className="size-full object-contain" />
    </span>
  );
}
