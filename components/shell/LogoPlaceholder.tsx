// Stands in for the masjid's own logo until logo upload is built.
export function LogoPlaceholder({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={className}>
      <circle cx="24" cy="24" r="24" className="fill-primary" />
      <path d="M13 33v-7a11 11 0 0 1 22 0v7h-7v-5a4 4 0 0 0-8 0v5z" className="fill-surface" />
      <path d="M9 33V21l1.5-3 1.5 3v12zM36 33V21l1.5-3 1.5 3v12z" className="fill-surface" />
      <rect x="8" y="34" width="32" height="2.5" rx="1" className="fill-gold-tint" />
      <circle cx="24" cy="11.5" r="2.5" className="fill-gold-tint" />
    </svg>
  );
}
