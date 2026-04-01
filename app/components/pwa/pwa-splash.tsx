import { useState, useEffect } from "react";

export function PWASplash() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show splash in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      setVisible(false);
      return;
    }

    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    const removeTimer = setTimeout(() => setVisible(false), 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-9999 flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ background: "#0a0a0f" }}
    >
      {/* Logo with glow */}
      <div className="relative">
        <div
          className="absolute inset-0 scale-150 rounded-2xl blur-2xl"
          style={{ backgroundColor: "rgba(124, 58, 237, 0.2)" }}
        />
        <img
          src="/icon-512.png"
          alt="GRIXI"
          width={80}
          height={80}
          className="relative rounded-2xl animate-pulse"
        />
      </div>

      {/* Brand text */}
      <p className="mt-4 font-serif text-lg font-semibold italic tracking-wide text-white/90">
        GRIXI
      </p>
      <p className="mt-1 text-[11px] text-white/40">
        La interconexión inteligente
      </p>

      {/* Shimmer loading bar */}
      <div className="mt-8 h-0.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="skeleton h-full w-full" />
      </div>
    </div>
  );
}
