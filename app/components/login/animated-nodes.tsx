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
}

/**
 * Animated network of nodes inspired by the GRIXI logo.
 * Uses Canvas 2D for smooth 60fps animation.
 */
export function AnimatedNodes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  const NODE_COUNT = 60;
  const CONNECTION_DISTANCE = 150;
  const MOUSE_INFLUENCE = 200;

  const initNodes = useCallback((width: number, height: number) => {
    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1.5,
        opacity: Math.random() * 0.5 + 0.3,
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
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (nodesRef.current.length === 0) {
        initNodes(canvas.width, canvas.height);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const time = Date.now() * 0.001;

      // Update & draw nodes
      for (const node of nodes) {
        // Move
        node.x += node.vx;
        node.y += node.vy;

        // Mouse repulsion
        const dx = node.x - mouseRef.current.x;
        const dy = node.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_INFLUENCE && dist > 0) {
          const force = (MOUSE_INFLUENCE - dist) / MOUSE_INFLUENCE * 0.02;
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }

        // Damping
        node.vx *= 0.998;
        node.vy *= 0.998;

        // Wrap around edges
        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;

        // Pulse
        const pulse = Math.sin(time * 2 + node.pulsePhase) * 0.3 + 0.7;
        const r = node.radius * pulse;
        const alpha = node.opacity * pulse;

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3);
        gradient.addColorStop(0, `rgba(139, 92, 246, ${alpha * 0.3})`);
        gradient.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.15;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0f0d2e 50%, #1e1b4b 100%)" }}
    />
  );
}
