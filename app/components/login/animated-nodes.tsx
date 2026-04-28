"use client";

import { useEffect, useRef, useCallback } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulsePhase: number;
  baseX: number;
  baseY: number;
}

interface FloatingOrb {
  baseX: number;
  baseY: number;
  radius: number;
  color: [number, number, number];
  speed: number;
  phase: number;
}

/**
 * Animated network of nodes that gently attract toward the cursor.
 * Inspired by the GRIXI logo's network-graph "G" shape.
 * Uses Canvas 2D for smooth 60fps animation.
 *
 * v2 — Added floating orbs for depth + improved gradients + varied node sizes.
 */
export function AnimatedNodes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const orbsRef = useRef<FloatingOrb[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const startTimeRef = useRef(Date.now());

  const NODE_COUNT = 55;
  const CONNECTION_DISTANCE = 170;
  const MOUSE_ATTRACT_RADIUS = 280;
  const MOUSE_ATTRACT_STRENGTH = 0.008;

  const initNodes = useCallback((width: number, height: number) => {
    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      // Vary sizes: a few "hero" nodes are larger
      const isHero = i < 6;
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: isHero ? Math.random() * 2.5 + 2.2 : Math.random() * 1.8 + 1,
        opacity: isHero ? Math.random() * 0.3 + 0.4 : Math.random() * 0.35 + 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;
  }, []);

  const initOrbs = useCallback((width: number, height: number) => {
    orbsRef.current = [
      { baseX: width * 0.15, baseY: height * 0.35, radius: 220, color: [139, 92, 246], speed: 0.25, phase: 0 },
      { baseX: width * 0.75, baseY: height * 0.65, radius: 280, color: [79, 70, 229], speed: 0.18, phase: 2.1 },
      { baseX: width * 0.5, baseY: height * 0.15, radius: 190, color: [167, 139, 250], speed: 0.32, phase: 4.2 },
      { baseX: width * 0.85, baseY: height * 0.2, radius: 160, color: [124, 58, 237], speed: 0.22, phase: 1.4 },
    ];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      if (nodesRef.current.length === 0) {
        initNodes(window.innerWidth, window.innerHeight);
        initOrbs(window.innerWidth, window.innerHeight);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const orbs = orbsRef.current;
      const time = Date.now() * 0.001;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      // Fade-in the canvas over 1.5s
      const canvasAlpha = Math.min(1, elapsed / 1.5);

      ctx.globalAlpha = canvasAlpha;

      // ── Draw floating orbs (behind everything) ──
      for (const orb of orbs) {
        const ox = orb.baseX + Math.sin(time * orb.speed + orb.phase) * 60;
        const oy = orb.baseY + Math.cos(time * orb.speed * 0.7 + orb.phase) * 40;

        const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.radius);
        gradient.addColorStop(0, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, 0.08)`);
        gradient.addColorStop(0.5, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, 0.03)`);
        gradient.addColorStop(1, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, 0)`);

        ctx.beginPath();
        ctx.arc(ox, oy, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // ── Update & draw nodes ──
      for (const node of nodes) {
        // Gentle base drift
        node.x += node.vx;
        node.y += node.vy;

        // Mouse ATTRACTION — nodes gently drift toward cursor
        const dx = mouseRef.current.x - node.x;
        const dy = mouseRef.current.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_ATTRACT_RADIUS && dist > 1) {
          const force = (1 - dist / MOUSE_ATTRACT_RADIUS) * MOUSE_ATTRACT_STRENGTH;
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }

        // Gentle spring back toward base position (prevents clustering)
        node.vx += (node.baseX - node.x) * 0.0003;
        node.vy += (node.baseY - node.y) * 0.0003;

        // Damping
        node.vx *= 0.995;
        node.vy *= 0.995;

        // Wrap around edges with margin
        if (node.x < -30) { node.x = w + 30; node.baseX = node.x; }
        if (node.x > w + 30) { node.x = -30; node.baseX = node.x; }
        if (node.y < -30) { node.y = h + 30; node.baseY = node.y; }
        if (node.y > h + 30) { node.y = -30; node.baseY = node.y; }

        // Pulse
        const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.3 + 0.7;
        const r = node.radius * pulse;
        const alpha = node.opacity * pulse;

        // Draw node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.fill();

        // Outer glow — larger for hero nodes
        const glowMultiplier = node.radius > 2.5 ? 5 : 4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * glowMultiplier, 0, Math.PI * 2);
        const glowGrad = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, r * glowMultiplier
        );
        glowGrad.addColorStop(0, `rgba(139, 92, 246, ${alpha * 0.18})`);
        glowGrad.addColorStop(0.5, `rgba(139, 92, 246, ${alpha * 0.05})`);
        glowGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // ── Draw connections between nearby nodes ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.14;
            // Gradient line from purple to blue-purple
            const lineGrad = ctx.createLinearGradient(
              nodes[i].x, nodes[i].y,
              nodes[j].x, nodes[j].y
            );
            lineGrad.addColorStop(0, `rgba(139, 92, 246, ${alpha})`);
            lineGrad.addColorStop(1, `rgba(99, 102, 241, ${alpha * 0.7})`);

            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      // ── Draw connections to cursor for nearby nodes (subtle highlight) ──
      if (mouseRef.current.x > 0) {
        for (const node of nodes) {
          const dx = node.x - mouseRef.current.x;
          const dy = node.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_ATTRACT_RADIUS * 0.6) {
            const alpha = (1 - dist / (MOUSE_ATTRACT_RADIUS * 0.6)) * 0.08;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [initNodes, initOrbs]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{
        background: "linear-gradient(155deg, #04040a 0%, #0a0828 35%, #120f3a 60%, #0d0a2a 100%)",
      }}
    />
  );
}
