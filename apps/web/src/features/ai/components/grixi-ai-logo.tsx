"use client";

import { useId } from "react";
import { motion } from "framer-motion";

type GrixiAiLogoProps = {
  size?: number;
  showText?: boolean;
  animate?: boolean;
};

/**
 * Grixi AI Logo — Network icon with AI sparkle effect
 * Based on the core Grixi network/graph identity
 */
export function GrixiAiLogo({
  size = 48,
  showText = true,
  animate = true,
}: GrixiAiLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `ai-grad-${uid}`;
  const glowId = `ai-glow-${uid}`;

  const brandColor = "#7C3AED";
  const brandLight = "#A78BFA";
  const aiGlow = "#C4B5FD";

  return (
    <div className="flex items-center gap-3">
      {/* Animated icon container */}
      <motion.div
        initial={animate ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
        className="relative"
      >
        {/* Glow effect behind the icon */}
        <motion.div
          animate={
            animate
              ? {
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.15, 1],
                }
              : undefined
          }
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `radial-gradient(circle, ${aiGlow}40 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />

        {/* Main icon */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={brandColor} />
              <stop offset="100%" stopColor={brandLight} />
            </linearGradient>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor={brandLight} floodOpacity="0.3" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connection lines */}
          <g opacity="0.7">
            <line x1="30" y1="25" x2="55" y2="15" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="55" y1="15" x2="72" y2="35" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="72" y1="35" x2="68" y2="62" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="68" y1="62" x2="45" y2="78" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="45" y1="78" x2="20" y2="68" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="68" x2="18" y2="44" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="18" y1="44" x2="30" y2="25" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* Inner cross connections */}
          <g opacity="0.4">
            <line x1="30" y1="25" x2="68" y2="62" stroke={brandColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="55" y1="15" x2="45" y2="78" stroke={brandColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="72" y1="35" x2="20" y2="68" stroke={brandColor} strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Nodes */}
          <circle cx="30" cy="25" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="55" cy="15" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="72" cy="35" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="68" cy="62" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="45" cy="78" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="20" cy="68" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="18" cy="44" r="5" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />

          {/* Center node — AI brain, larger with glow */}
          <circle cx="45" cy="45" r="7" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle cx="45" cy="45" r="4" fill="white" opacity="0.3" />

          {/* Center connections */}
          <g opacity="0.5">
            <line x1="45" y1="45" x2="30" y2="25" stroke={brandLight} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="45" y1="45" x2="72" y2="35" stroke={brandLight} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="45" y1="45" x2="68" y2="62" stroke={brandLight} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="45" y1="45" x2="20" y2="68" stroke={brandLight} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="45" y1="45" x2="55" y2="15" stroke={brandLight} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="45" y1="45" x2="45" y2="78" stroke={brandLight} strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* AI Sparkle — top right */}
          <g transform="translate(75, 8)" filter={`url(#${glowId})`}>
            <path
              d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5Z"
              fill={brandLight}
            />
          </g>

          {/* Small sparkle — bottom left */}
          <g transform="translate(2, 80)" opacity="0.7">
            <path
              d="M5 0L6 3.5L9.5 4.5L6 5.5L5 9L4 5.5L0.5 4.5L4 3.5Z"
              fill={aiGlow}
            />
          </g>
        </svg>
      </motion.div>

      {/* Text */}
      {showText && (
        <motion.div
          initial={animate ? { opacity: 0, x: -10 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-col"
        >
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            GRIXI{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">
              AI
            </span>
          </span>
          <span className="text-[10px] font-medium text-[var(--text-muted)]">
            Powered by Gemini
          </span>
        </motion.div>
      )}
    </div>
  );
}
