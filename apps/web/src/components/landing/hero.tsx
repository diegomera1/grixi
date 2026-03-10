"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ── Floating network node
type NetNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
};

function createNodes(width: number, height: number, count: number): NetNode[] {
  const nodes: NetNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      radius: 3 + Math.random() * 2.5,
      opacity: 0.35 + Math.random() * 0.35,
    });
  }
  return nodes;
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const word1Ref = useRef<HTMLDivElement>(null);
  const word2Ref = useRef<HTMLDivElement>(null);
  const word3Ref = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NetNode[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999 };
  }, []);

  // ── Full-screen canvas network animation
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = section.offsetWidth;
      const h = section.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodesRef.current = createNodes(w, h, 35);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Parse brand color
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--brand")
      .trim();
    const r = parseInt(raw.slice(1, 3) || "7c", 16);
    const g = parseInt(raw.slice(3, 5) || "3a", 16);
    const b = parseInt(raw.slice(5, 7) || "ed", 16);

    const animate = () => {
      const w = section.offsetWidth;
      const h = section.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      const connectionDist = 160;
      const mouseRadius = 250;
      const orbitDist = 70;

      // Update positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        // Wrap around edges
        if (node.x < -10) node.x = w + 10;
        if (node.x > w + 10) node.x = -10;
        if (node.y < -10) node.y = h + 10;
        if (node.y > h + 10) node.y = -10;

        // Mouse interaction — attract + orbit
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseRadius && dist > 1) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Gentle attraction toward cursor
          const attractForce = (1 - dist / mouseRadius) * 0.006;
          node.vx += nx * attractForce;
          node.vy += ny * attractForce;

          // Slow orbital rotation (tangential force)
          const tx = -ny / dist;
          const ty = nx / dist;
          const orbitForce = (1 - dist / mouseRadius) * 0.004;
          node.vx += tx * orbitForce * dist;
          node.vy += ty * orbitForce * dist;

          // Soft repulsion at minimum orbit distance
          if (dist < orbitDist) {
            const pushForce = (1 - dist / orbitDist) * 0.015;
            node.vx -= nx * pushForce;
            node.vy -= ny * pushForce;
          }
        }

        // Damping
        node.vx *= 0.992;
        node.vy *= 0.992;

        // Clamp velocity
        const maxV = 0.5;
        node.vx = Math.max(-maxV, Math.min(maxV, node.vx));
        node.vy = Math.max(-maxV, Math.min(maxV, node.vy));
      }

      // Draw connections between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.18;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw connections from nodes TO the cursor — forms a hub
      if (mouse.x > -1000) {
        for (const node of nodes) {
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseRadius) {
            const alpha = (1 - dist / mouseRadius) * 0.25;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Draw a soft glow at cursor position (interconnection hub)
        const hubGrad = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, 40
        );
        hubGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);
        hubGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 40, 0, Math.PI * 2);
        ctx.fillStyle = hubGrad;
        ctx.fill();
      }

      // Draw nodes with glow
      for (const node of nodes) {
        // Soft glow
        const grad = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, node.radius * 4
        );
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${node.opacity * 0.25})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${node.opacity * 0.6})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // ── GSAP animations
  useEffect(() => {
    const section = sectionRef.current;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.fromTo(word1Ref.current, { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4 })
        .fromTo(word2Ref.current, { y: 100, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3 }, "-=1.0")
        .fromTo(word3Ref.current, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2 }, "-=0.9")
        .fromTo(subtitleRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.4")
        .fromTo(canvasRef.current, { opacity: 0 }, { opacity: 1, duration: 2 }, "-=1.5");

      // Scroll parallax — position only
      gsap.to(word1Ref.current, {
        x: -60,
        scrollTrigger: { trigger: section, start: "top top", end: "80% top", scrub: 1.5 },
      });
      gsap.to(word2Ref.current, {
        x: 50,
        scrollTrigger: { trigger: section, start: "top top", end: "80% top", scrub: 1.5 },
      });
      gsap.to(word3Ref.current, {
        y: 20,
        scrollTrigger: { trigger: section, start: "top top", end: "60% top", scrub: 1.5 },
      });
      gsap.to(subtitleRef.current, {
        y: -20,
        scrollTrigger: { trigger: section, start: "20% top", end: "60% top", scrub: 1 },
      });
    }, sectionRef);

    section?.addEventListener("mousemove", handleMouseMove);
    section?.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      ctx.revert();
      section?.removeEventListener("mousemove", handleMouseMove);
      section?.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <section
      ref={sectionRef}
      className="hero-gradient relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden"
    >
      {/* ── Full-section network canvas ── */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[1] opacity-0"
      />

      {/* Dot grid pattern */}
      <div className="hero-dot-grid pointer-events-none absolute inset-0" />

      {/* Animated gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
      </div>

      {/* Horizontal accent lines */}
      <div className="pointer-events-none absolute inset-0">
        <div className="hero-line hero-line-1" />
        <div className="hero-line hero-line-2" />
        <div className="hero-line hero-line-3" />
      </div>

      {/* Radial gradient center glow */}
      <div className="hero-center-glow pointer-events-none absolute inset-0" />

      {/* Noise texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-[1800px] flex-col items-center px-6 lg:px-10">
        <div className="flex w-full flex-col items-center gap-3 sm:gap-1">
          <div className="w-full">
            <div
              ref={word1Ref}
              className="font-[family-name:var(--font-instrument-serif)] text-[clamp(3rem,10vw,9rem)] leading-[1.1] tracking-[-0.03em] text-[var(--text-primary)] opacity-0"
            >
              Interconexión
            </div>
          </div>

          <div className="w-full text-right">
            <div
              ref={word2Ref}
              className="font-[family-name:var(--font-instrument-serif)] text-[clamp(3rem,10vw,9rem)] italic leading-[1.15] tracking-[-0.03em] text-[var(--brand)] opacity-0"
            >
              inteligente
            </div>
          </div>

          <div className="mt-1 w-full text-center sm:mt-3">
            <div
              ref={word3Ref}
              className="font-[family-name:var(--font-instrument-serif)] text-[clamp(1.5rem,5vw,4.5rem)] leading-[1.2] tracking-[-0.02em] text-[var(--text-secondary)] opacity-0"
            >
              de toda la empresa
            </div>
          </div>
        </div>

        <p
          ref={subtitleRef}
          className="mt-10 max-w-lg text-center text-[15px] leading-[1.8] text-[var(--text-muted)] opacity-0 sm:mt-14"
        >
          Conecta sistemas, visualiza datos en tiempo real y toma decisiones con
          inteligencia artificial. Una plataforma, toda tu operación.
        </p>
      </div>

      {/* Bottom metadata */}
      <div className="absolute bottom-6 left-0 right-0 z-10 flex items-end justify-between px-6 lg:bottom-10 lg:px-10">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Plataforma Enterprise
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Multi-Tenant
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">Scroll</span>
          <div className="relative h-10 w-px bg-[var(--border)]">
            <div className="scroll-pulse absolute top-0 left-0 h-3 w-px bg-[var(--brand)]" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Base de datos en tiempo real
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Inteligencia Artificial
          </span>
        </div>
      </div>
    </section>
  );
}
