"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Navigation, Anchor, Clock, Compass,
  Ship, Waves,
} from "lucide-react";

// Demo route: Manta → Guayaquil → Balboa → Cartagena → Houston
const ROUTE_WAYPOINTS = [
  { name: "Manta", lat: -0.9537, lon: -80.7339, status: "departed" as const },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891, status: "next" as const },
  { name: "Canal de Panamá", lat: 8.9500, lon: -79.5667, status: "pending" as const },
  { name: "Cartagena", lat: 10.3910, lon: -75.5144, status: "pending" as const },
  { name: "Houston", lat: 29.7604, lon: -95.3698, status: "pending" as const },
];

const VESSEL_POSITION = { lat: -1.5200, lon: -80.2100 };
const VESSEL_HEADING = 195;
const VESSEL_SPEED = 12.4;

// Route progress
const ROUTE_PROGRESS = {
  pct: 6,
  traveled: "180 nm",
  remaining: "2,670 nm",
  eta: "~9 días",
};

type VesselMapProps = {
  vesselName?: string;
  compact?: boolean;
};

export function VesselMap({ vesselName = "MV Grixi Pacífico", compact = false }: VesselMapProps) {
  const [activePort, setActivePort] = useState<string | null>(null);

  const height = compact ? "h-[380px]" : "h-[500px]";

  // OpenStreetMap embed centered on vessel position with route visible

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${VESSEL_POSITION.lon - 15},${VESSEL_POSITION.lat - 8},${VESSEL_POSITION.lon + 15},${VESSEL_POSITION.lat + 8}&layer=mapnik&marker=${VESSEL_POSITION.lat},${VESSEL_POSITION.lon}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${height} rounded-xl overflow-hidden border border-[var(--border)]`}
    >
      {/* Map Background */}
      <iframe
        title="Mapa de posición del buque"
        src={mapSrc}
        className="h-full w-full border-0"
        style={{ filter: "saturate(0.6) contrast(1.1)" }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />

      {/* Vessel pulse overlay — positioned at center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-[#0EA5E9]/20 animate-ping" />
          <div className="absolute -inset-2 rounded-full bg-[#0EA5E9]/30 animate-pulse" />
          <Ship size={20} className="text-[#0EA5E9] drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
        </div>
      </div>

      {/* Top-left: Vessel info card */}
      <div className="absolute top-3 left-3 z-20 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-xl p-3 shadow-lg min-w-[200px]">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border)]">
          <Ship size={14} className="text-[#0EA5E9]" />
          <span className="text-[11px] font-bold text-[var(--text-primary)]">{vesselName}</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { icon: Navigation, label: "Rumbo", value: `${VESSEL_HEADING}°` },
            { icon: Waves, label: "Velocidad", value: `${VESSEL_SPEED} kn` },
            { icon: Compass, label: "Pos.", value: `${Math.abs(VESSEL_POSITION.lat).toFixed(2)}°S` },
            { icon: Anchor, label: "Destino", value: "Guayaquil" },
            { icon: Clock, label: "ETA", value: ROUTE_PROGRESS.eta },
          ].map((info) => (
            <div key={info.label} className="flex items-center gap-1.5">
              <info.icon size={10} className="text-[#0EA5E9]/60 shrink-0" />
              <div>
                <p className="text-[7px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{info.label}</p>
                <p className="text-[10px] font-bold text-[var(--text-primary)]">{info.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar: Route progress + waypoints */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-[var(--bg-surface)]/95 backdrop-blur-xl border-t border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="shrink-0 min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Progreso Ruta</span>
              <span className="text-[9px] font-bold text-[#0EA5E9]">{ROUTE_PROGRESS.pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#10B981] to-[#0EA5E9] rounded-full transition-all" style={{ width: `${ROUTE_PROGRESS.pct}%` }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-[var(--text-muted)]">{ROUTE_PROGRESS.traveled}</span>
              <span className="text-[7px] text-[var(--text-muted)]">{ROUTE_PROGRESS.remaining}</span>
            </div>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-[var(--border)] shrink-0" />

          {/* Waypoints as horizontal list */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {ROUTE_WAYPOINTS.map((wp, i) => (
              <button
                key={wp.name}
                onClick={() => setActivePort(activePort === wp.name ? null : wp.name)}
                className={`flex items-center gap-1.5 shrink-0 rounded-lg px-2 py-1 transition-colors text-[10px] font-medium ${
                  activePort === wp.name
                    ? "bg-[#0EA5E9]/10 text-[#0EA5E9]"
                    : "hover:bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  wp.status === "departed" ? "bg-[#10B981]" :
                  wp.status === "next" ? "bg-[#0EA5E9] animate-pulse" :
                  "bg-[var(--text-muted)]/40"
                }`} />
                {wp.name}
                {i < ROUTE_WAYPOINTS.length - 1 && (
                  <span className="text-[var(--text-muted)]/30 ml-1">→</span>
                )}
              </button>
            ))}
          </div>

          {/* Coordinates */}
          <div className="shrink-0 text-right">
            <p className="text-[8px] text-[var(--text-muted)] font-mono">
              {Math.abs(VESSEL_POSITION.lat).toFixed(4)}°S, {Math.abs(VESSEL_POSITION.lon).toFixed(4)}°W
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
