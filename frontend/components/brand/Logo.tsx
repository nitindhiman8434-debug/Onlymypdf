import { cn } from "@/lib/utils";

/**
 * OnlyMyPDF logo — inline SVG, no external image files.
 * Icon: a modern document with a folded corner. A SUBTLE medical "+"
 * is hidden inside the page using low-contrast strokes (premium,
 * not hospital). Wordmark text is exactly "OnlyMyPDF".
 *
 * `variant="dark"` flips the wordmark colour for dark backgrounds.
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-9 w-9", className)}
      role="img"
      aria-label="OnlyMyPDF"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ompPage" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#16D6C5" />
        </linearGradient>
      </defs>
      {/* page body */}
      <path
        d="M12 4h16l10 10v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
        fill="url(#ompPage)"
      />
      {/* folded corner */}
      <path d="M28 4l10 10H30a2 2 0 0 1-2-2V4Z" fill="#fff" fillOpacity="0.85" />
      {/* subtle hidden medical "+" — low contrast on purpose */}
      <g stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round">
        <line x1="23" y1="24" x2="23" y2="34" />
        <line x1="18" y1="29" x2="28" y2="29" />
      </g>
    </svg>
  );
}

export function Logo({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <LogoIcon />
      <span className="text-xl tracking-tight">
        <span className={variant === "dark" ? "text-white" : "text-navy"}>Only</span>
        <span className="text-brand">My</span>
        <span className="text-coral">PDF</span>
      </span>
    </span>
  );
}
