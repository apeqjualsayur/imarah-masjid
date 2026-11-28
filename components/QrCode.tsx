import { qrShape } from "@/lib/qr";

/** A crisp QR code at any size. Dark on white (the app has a light theme only), so every banking app can read it. */
export function QrCode({ text, label, className = "size-64" }: { text: string; label: string; className?: string }) {
  const { path, size } = qrShape(text);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
      data-testid="qr-duitnow"
    >
      <rect width={size} height={size} className="fill-surface" />
      <path d={path} className="fill-ink" />
    </svg>
  );
}
