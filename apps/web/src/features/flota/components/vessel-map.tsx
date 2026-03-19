"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Navigation, Anchor, Clock, Compass,
  Ship, Waves, Locate,
} from "lucide-react";

// Demo route: Manta → Guayaquil → Balboa → Cartagena → Houston
const ROUTE_WAYPOINTS = [
  { name: "Manta", lat: -0.9537, lon: -80.7339, status: "departed" as const },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891, status: "next" as const },
  { name: "Canal de Panamá", lat: 8.9500, lon: -79.5667, status: "pending" as const },
  { name: "Cartagena", lat: 10.3910, lon: -75.5144, status: "pending" as const },
  { name: "Houston", lat: 29.7604, lon: -95.3698, status: "pending" as const },
];

const VESSEL = {
  lat: -1.5200,
  lon: -80.2100,
  heading: 195,
  speed: 12.4,
  name: "MV Grixi Pacífico",
};

const ROUTE_PROGRESS = {
  pct: 6,
  traveled: "180 nm",
  remaining: "2,670 nm",
  eta: "~9 días",
};

// Simplified coastline coordinates for Central America / South America region
const COASTLINES: [number, number][][] = [
  // Ecuador coast
  [[-80.0, 1.5], [-80.2, 0.5], [-80.5, -0.5], [-80.1, -1.0], [-80.5, -2.2], [-80.0, -3.5], [-79.5, -4.0]],
  // Colombia coast
  [[-77.0, 1.0], [-76.8, 2.0], [-77.5, 4.0], [-77.0, 6.0], [-76.0, 8.0], [-75.5, 10.5], [-76.5, 11.5]],
  // Panama
  [[-77.5, 7.5], [-79.0, 8.0], [-79.5, 9.0], [-80.0, 8.5], [-82.0, 8.5], [-83.0, 9.5]],
  // Central America
  [[-83.0, 9.5], [-84.5, 11.0], [-86.0, 12.5], [-87.5, 13.5], [-89.0, 14.5], [-90.0, 15.5], [-92.0, 15.0], [-94.0, 16.5], [-96.0, 16.0], [-97.5, 17.0]],
  // Mexico Gulf / Texas
  [[-97.5, 17.0], [-97.0, 19.5], [-96.0, 19.8], [-95.0, 20.5], [-94.0, 22.0], [-93.0, 24.0], [-95.0, 26.0], [-97.0, 26.0], [-97.5, 28.0], [-96.0, 29.5], [-94.5, 29.5], [-93.5, 29.8], [-92.5, 29.5], [-91.0, 29.5], [-89.5, 29.0], [-88.5, 30.0]],
  // Cuba
  [[-85.0, 21.5], [-83.0, 22.0], [-81.5, 23.0], [-80.0, 23.0], [-79.5, 22.0], [-82.0, 21.5], [-84.0, 21.5], [-85.0, 21.5]],
  // Peru coast
  [[-79.5, -4.0], [-80.0, -5.0], [-81.0, -6.0], [-80.5, -7.0], [-80.0, -8.0], [-79.5, -9.5]],
];

type VesselMapProps = {
  vesselName?: string;
  compact?: boolean;
};

// Mercator projection helpers
function latLonToXY(
  lat: number,
  lon: number,
  width: number,
  height: number,
  center: { lat: number; lon: number },
  zoomDeg: number
): { x: number; y: number } {
  const lonRange = zoomDeg;
  const latRange = zoomDeg * (height / width);
  const x = ((lon - center.lon + lonRange / 2) / lonRange) * width;
  const y = ((center.lat - lat + latRange / 2) / latRange) * height;
  return { x, y };
}

export function VesselMap({ vesselName = "MV Grixi Pacífico", compact = false }: VesselMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [activePort, setActivePort] = useState<string | null>(null);

  const mapCenter = { lat: 14, lon: -82 };
  const zoomDeg = 50;

  const drawMap = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    const toXY = (lat: number, lon: number) => latLonToXY(lat, lon, w, h, mapCenter, zoomDeg);

    // Ocean background — dark navy gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, "#0a1628");
    oceanGrad.addColorStop(0.5, "#0c1e3a");
    oceanGrad.addColorStop(1, "#081422");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Ocean grid lines (subtle)
    ctx.strokeStyle = "rgba(14, 165, 233, 0.06)";
    ctx.lineWidth = 0.5;
    for (let lat = -10; lat <= 35; lat += 5) {
      const p1 = toXY(lat, mapCenter.lon - zoomDeg / 2 - 5);
      const p2 = toXY(lat, mapCenter.lon + zoomDeg / 2 + 5);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let lon = -100; lon <= -60; lon += 5) {
      const p1 = toXY(mapCenter.lat - zoomDeg / 2 - 5, lon);
      const p2 = toXY(mapCenter.lat + zoomDeg / 2 + 5, lon);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Coastlines — filled land
    ctx.fillStyle = "rgba(14, 165, 233, 0.08)";
    ctx.strokeStyle = "rgba(14, 165, 233, 0.25)";
    ctx.lineWidth = 1;
    COASTLINES.forEach((coast) => {
      ctx.beginPath();
      coast.forEach(([lon, lat], i) => {
        const p = toXY(lat, lon);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });

    // Planned route — dashed line
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(14, 165, 233, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ROUTE_WAYPOINTS.forEach((wp, i) => {
      const p = toXY(wp.lat, wp.lon);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Traveled route — solid emerald
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const start = toXY(ROUTE_WAYPOINTS[0].lat, ROUTE_WAYPOINTS[0].lon);
    const vessel = toXY(VESSEL.lat, VESSEL.lon);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(vessel.x, vessel.y);
    ctx.stroke();

    // Port markers
    ROUTE_WAYPOINTS.forEach((wp) => {
      const p = toXY(wp.lat, wp.lon);
      const color = wp.status === "departed" ? "#10B981" : wp.status === "next" ? "#0EA5E9" : "#64748b";
      const isActive = activePort === wp.name;
      const size = isActive ? 5 : wp.status === "departed" ? 4 : 3;

      // Outer glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, size + 3, 0, Math.PI * 2);
      ctx.fillStyle = `${color}20`;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.font = `${isActive ? "bold " : ""}${isActive ? 11 : 9}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = isActive ? "#ffffff" : "rgba(255,255,255,0.6)";
      ctx.textAlign = "center";
      ctx.fillText(wp.name, p.x, p.y - size - 6);
    });

    // Vessel — pulsing glow circle
    const vp = toXY(VESSEL.lat, VESSEL.lon);
    const pulse = Math.sin(time * 0.003) * 0.3 + 0.7;

    // Outer pulse ring
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, 18 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(14, 165, 233, ${0.08 * pulse})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(vp.x, vp.y, 12 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(14, 165, 233, ${0.15 * pulse})`;
    ctx.fill();

    // Direction arrow
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.rotate((VESSEL.heading * Math.PI) / 180);
    ctx.fillStyle = "#0EA5E9";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-4, 4);
    ctx.lineTo(0, 1);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Center dot
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Vessel name label
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#0EA5E9";
    ctx.textAlign = "center";
    ctx.fillText(vesselName, vp.x, vp.y + 22);
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`${Math.abs(VESSEL.lat).toFixed(2)}°S, ${Math.abs(VESSEL.lon).toFixed(2)}°W`, vp.x, vp.y + 34);

    animRef.current = requestAnimationFrame(drawMap);
  }, [activePort, vesselName, mapCenter, zoomDeg]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawMap);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawMap]);

  const height = compact ? "h-[380px]" : "h-[500px]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${height} rounded-xl overflow-hidden border border-[var(--border)]`}
    >
      {/* Maritime Canvas Map */}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        style={{ display: "block" }}
      />

      {/* Top-left: Vessel info card */}
      <div className="absolute top-3 left-3 z-20 rounded-xl border border-white/10 bg-[#0c1e3a]/90 backdrop-blur-xl p-3 shadow-lg min-w-[200px]">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
          <Ship size={14} className="text-[#0EA5E9]" />
          <span className="text-[11px] font-bold text-white">{vesselName}</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { icon: Navigation, label: "Rumbo", value: `${VESSEL.heading}°` },
            { icon: Waves, label: "Velocidad", value: `${VESSEL.speed} kn` },
            { icon: Compass, label: "Posición", value: `${Math.abs(VESSEL.lat).toFixed(2)}°S` },
            { icon: Anchor, label: "Destino", value: "Guayaquil" },
            { icon: Clock, label: "ETA", value: ROUTE_PROGRESS.eta },
            { icon: Locate, label: "Lon.", value: `${Math.abs(VESSEL.lon).toFixed(2)}°W` },
          ].map((info) => (
            <div key={info.label} className="flex items-center gap-1.5">
              <info.icon size={10} className="text-[#0EA5E9]/60 shrink-0" />
              <div>
                <p className="text-[7px] font-medium text-white/40 uppercase tracking-wider">{info.label}</p>
                <p className="text-[10px] font-bold text-white/90">{info.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar: Route progress + waypoints */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-[#0c1e3a]/90 backdrop-blur-xl border-t border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="shrink-0 min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/40">Progreso Ruta</span>
              <span className="text-[9px] font-bold text-[#0EA5E9]">{ROUTE_PROGRESS.pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#10B981] to-[#0EA5E9] rounded-full transition-all" style={{ width: `${ROUTE_PROGRESS.pct}%` }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-white/30">{ROUTE_PROGRESS.traveled}</span>
              <span className="text-[7px] text-white/30">{ROUTE_PROGRESS.remaining}</span>
            </div>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-white/10 shrink-0" />

          {/* Waypoints as horizontal list */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {ROUTE_WAYPOINTS.map((wp, i) => (
              <button
                key={wp.name}
                onClick={() => setActivePort(activePort === wp.name ? null : wp.name)}
                className={`flex items-center gap-1.5 shrink-0 rounded-lg px-2 py-1 transition-colors text-[10px] font-medium ${
                  activePort === wp.name
                    ? "bg-[#0EA5E9]/20 text-[#0EA5E9]"
                    : "hover:bg-white/5 text-white/50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  wp.status === "departed" ? "bg-[#10B981]" :
                  wp.status === "next" ? "bg-[#0EA5E9] animate-pulse" :
                  "bg-white/20"
                }`} />
                {wp.name}
                {i < ROUTE_WAYPOINTS.length - 1 && (
                  <span className="text-white/20 ml-1">→</span>
                )}
              </button>
            ))}
          </div>

          {/* Coordinates */}
          <div className="shrink-0 text-right">
            <p className="text-[8px] text-white/30 font-mono">
              {Math.abs(VESSEL.lat).toFixed(4)}°S, {Math.abs(VESSEL.lon).toFixed(4)}°W
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
