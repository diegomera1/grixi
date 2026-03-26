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

/**
 * Animated network of nodes that gently attract toward the cursor.
 * Inspired by the GRIXI logo's network-graph "G" shape.
 * Uses Canvas 2D for smooth 60fps animation.
 */
export function AnimatedNodes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const startTimeRef = useRef(Date.now());

  const NODE_COUNT = 50;
  const CONNECTION_DISTANCE = 160;
  const MOUSE_ATTRACT_RADIUS = 280;
  const MOUSE_ATTRACT_STRENGTH = 0.008;

  const initNodes = useCallback((width: number, height: number) => {
    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 1.2,
        opacity: Math.random() * 0.4 + 0.2,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;
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
      const time = Date.now() * 0.001;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      // Fade-in the canvas over 1.5s
      const canvasAlpha = Math.min(1, elapsed / 1.5);

      ctx.globalAlpha = canvasAlpha;

      // Update & draw nodes
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

        // Draw node with softer purple
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.fill();

        // Subtle glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 4, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, r * 4
        );
        gradient.addColorStop(0, `rgba(139, 92, 246, ${alpha * 0.15})`);
        gradient.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw connections between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw connections to cursor for nearby nodes (subtle highlight)
      if (mouseRef.current.x > 0) {
        for (const node of nodes) {
          const dx = node.x - mouseRef.current.x;
          const dy = node.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_ATTRACT_RADIUS * 0.6) {
            const alpha = (1 - dist / (MOUSE_ATTRACT_RADIUS * 0.6)) * 0.06;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
            ctx.lineWidth = 0.4;
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
  }, [initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{
        background: "linear-gradient(145deg, #06060c 0%, #0c0a24 40%, #15133a 100%)",
      }}
    />
  );
}
