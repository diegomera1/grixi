"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GrixiLogo } from "@/components/ui/grixi-logo";

gsap.registerPlugin(ScrollTrigger);

export function Footer() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: footerRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <footer
      ref={footerRef}
      className="border-t border-[var(--border)] bg-[var(--bg-primary)] px-6 py-16 lg:px-10 lg:py-20"
    >
      <div ref={contentRef} className="mx-auto max-w-[1800px]">
        <div className="flex flex-col gap-12 sm:flex-row sm:items-end sm:justify-between">
          {/* Logo + tagline */}
          <div>
            {mounted && (
              <GrixiLogo
                height={28}
                variant={isDark ? "dark" : "light"}
                className="mb-5"
              />
            )}
            <p className="max-w-xs text-[13px] leading-relaxed text-[var(--text-muted)]">
              La interconexión inteligente de toda la empresa.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-10">
            <Link
              href="/login"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Ingresar
            </Link>
            <a
              href="https://github.com/diegomera1/grixi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              GitHub
            </a>
            <a
              href="mailto:diegomera86@gmail.com"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Contacto
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 flex items-center justify-between border-t border-[var(--border)] pt-6">
          <span className="text-[11px] text-[var(--text-muted)]">
            © {new Date().getFullYear()} Grixi
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            Supabase · Next.js · Gemini AI
          </span>
        </div>
      </div>
    </footer>
  );
}
