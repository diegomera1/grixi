type GrixiLogoProps = {
  className?: string;
  /** Height in pixels — width scales proportionally */
  height?: number;
  /** "light" renders dark text, "dark" renders white text. Icon always violet. */
  variant?: "light" | "dark";
};

export function GrixiLogo({
  className = "",
  height = 32,
  variant = "light",
}: GrixiLogoProps) {
  const textColor = variant === "dark" ? "#FAFAFA" : "#09090B";
  const brandColor = "#7C3AED";
  const brandLight = "#A78BFA";

  // Aspect ratio based on the logo design: icon + wordmark
  const aspectRatio = 3.6;
  const width = height * aspectRatio;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 360 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Grixi"
    >
      {/* ── Network icon (G-shaped nodes + connections) ── */}
      <g>
        {/* Connection lines */}
        <line x1="30" y1="25" x2="55" y2="15" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="55" y1="15" x2="72" y2="35" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="72" y1="35" x2="68" y2="62" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="68" y1="62" x2="45" y2="78" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="45" y1="78" x2="20" y2="68" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="68" x2="18" y2="44" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="18" y1="44" x2="30" y2="25" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />

        {/* Inner cross connections */}
        <line x1="30" y1="25" x2="68" y2="62" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <line x1="55" y1="15" x2="45" y2="78" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <line x1="72" y1="35" x2="20" y2="68" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <line x1="18" y1="44" x2="72" y2="35" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

        {/* Nodes */}
        <circle cx="30" cy="25" r="6" fill={brandColor} />
        <circle cx="55" cy="15" r="6" fill={brandColor} />
        <circle cx="72" cy="35" r="6" fill={brandColor} />
        <circle cx="68" cy="62" r="6" fill={brandColor} />
        <circle cx="45" cy="78" r="6" fill={brandColor} />
        <circle cx="20" cy="68" r="6" fill={brandColor} />
        <circle cx="18" cy="44" r="6" fill={brandColor} />

        {/* Center node (slightly larger, lighter) */}
        <circle cx="45" cy="45" r="5" fill={brandLight} opacity="0.9" />
        <line x1="45" y1="45" x2="30" y2="25" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="45" y1="45" x2="72" y2="35" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="45" y1="45" x2="68" y2="62" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="45" y1="45" x2="20" y2="68" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />

        {/* G-shape opening — a small gap line to suggest the letter G */}
        <line x1="72" y1="48" x2="55" y2="48" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* ── Wordmark: GRIXI ── */}
      <text
        x="100"
        y="63"
        fontFamily="var(--font-geist-sans), system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="46"
        fontWeight="700"
        letterSpacing="6"
        fill={textColor}
      >
        GRIXI
      </text>
    </svg>
  );
}

/** Icon-only version for compact spaces (favicon, mobile header etc.) */
export function GrixiIcon({
  className = "",
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  const brandColor = "#7C3AED";
  const brandLight = "#A78BFA";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Grixi icon"
    >
      {/* Connection lines */}
      <line x1="30" y1="25" x2="55" y2="15" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      <line x1="55" y1="15" x2="72" y2="35" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      <line x1="72" y1="35" x2="68" y2="62" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      <line x1="68" y1="62" x2="45" y2="78" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      <line x1="45" y1="78" x2="20" y2="68" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="68" x2="18" y2="44" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
      <line x1="18" y1="44" x2="30" y2="25" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />

      {/* Inner cross connections */}
      <line x1="30" y1="25" x2="68" y2="62" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <line x1="55" y1="15" x2="45" y2="78" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <line x1="72" y1="35" x2="20" y2="68" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <line x1="18" y1="44" x2="72" y2="35" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

      {/* Nodes */}
      <circle cx="30" cy="25" r="6" fill={brandColor} />
      <circle cx="55" cy="15" r="6" fill={brandColor} />
      <circle cx="72" cy="35" r="6" fill={brandColor} />
      <circle cx="68" cy="62" r="6" fill={brandColor} />
      <circle cx="45" cy="78" r="6" fill={brandColor} />
      <circle cx="20" cy="68" r="6" fill={brandColor} />
      <circle cx="18" cy="44" r="6" fill={brandColor} />

      {/* Center node */}
      <circle cx="45" cy="45" r="5" fill={brandLight} opacity="0.9" />
      <line x1="45" y1="45" x2="30" y2="25" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="45" y1="45" x2="72" y2="35" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="45" y1="45" x2="68" y2="62" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="45" y1="45" x2="20" y2="68" stroke={brandLight} strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* G-shape opening */}
      <line x1="72" y1="48" x2="55" y2="48" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
