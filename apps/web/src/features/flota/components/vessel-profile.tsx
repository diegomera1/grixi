"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import {
  Anchor, AlertTriangle, Wrench, CheckCircle2,
  Compass, Waves, Ship, ThermometerSun,
  Maximize2, Minimize2,
} from "lucide-react";
import type { VesselZone, Equipment } from "../types";
import {
  ZONE_TYPE_COLORS, ZONE_TYPE_LABELS,
  EQUIPMENT_STATUS_COLORS, EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_CRITICALITY_COLORS,
} from "../types";

// ─── Zone shape definitions (SVG paths relative to a 900×340 viewBox) ────

type ZoneDef = {
  zoneType: string;
  path: string;
  labelX: number;
  labelY: number;
};

const ZONE_DEFS: ZoneDef[] = [
  // Bridge (top of superstructure)
  { zoneType: "bridge", path: "M120,90 L175,90 L175,130 L120,130 Z", labelX: 147, labelY: 113 },
  // Accommodation (middle superstructure)
  { zoneType: "accommodation", path: "M110,130 L185,130 L185,195 L110,195 Z", labelX: 147, labelY: 165 },
  // Funnel
  { zoneType: "funnel", path: "M100,60 L125,60 L125,90 L100,90 Z", labelX: 112, labelY: 78 },
  // Engine room (aft, below deck)
  { zoneType: "engine_room", path: "M110,195 L210,195 L210,265 L115,265 Z", labelX: 160, labelY: 235 },
  // Steering gear (far aft)
  { zoneType: "steering_gear", path: "M80,195 L110,195 L115,265 L85,260 Z", labelX: 97, labelY: 232 },
  // Pump room
  { zoneType: "pump_room", path: "M210,195 L270,195 L270,260 L210,260 Z", labelX: 240, labelY: 230 },
  // Cargo tanks (4 across midships)
  { zoneType: "cargo_tank", path: "M270,150 L415,150 L415,260 L270,260 Z", labelX: 342, labelY: 208 },
  // Main deck (above cargo tanks)
  { zoneType: "main_deck", path: "M185,130 L650,130 L650,150 L185,150 Z", labelX: 420, labelY: 143 },
  // Ballast tank (double bottom)
  { zoneType: "ballast_tank", path: "M200,260 L650,260 L640,290 L210,290 Z", labelX: 420, labelY: 278 },
  // Forecastle (bow area)
  { zoneType: "forecastle", path: "M650,120 L780,170 L780,200 L650,150 Z", labelX: 710, labelY: 168 },
  // Cargo tanks forward
  { zoneType: "cargo_tank", path: "M415,150 L560,150 L560,260 L415,260 Z", labelX: 487, labelY: 208 },
  // Upper deck machinery
  { zoneType: "upper_deck_machinery", path: "M560,150 L650,150 L650,260 L560,260 Z", labelX: 605, labelY: 208 },
];

// ─── Vessel SVG Profile ─────────────────────────────────

function VesselSVG({
  zones,
  equipment,
  selectedZone,
  onSelectZone,
}: {
  zones: VesselZone[];
  equipment: Equipment[];
  selectedZone: string | null;
  onSelectZone: (zoneType: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wavesRef = useRef<SVGPathElement>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Wave animation with GSAP
  useEffect(() => {
    if (!wavesRef.current) return;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(wavesRef.current, {
      attr: { d: "M0,310 Q150,295 300,310 Q450,325 600,310 Q750,295 900,310 L900,340 L0,340 Z" },
      duration: 2.5,
      ease: "sine.inOut",
    });
    return () => { tl.kill(); };
  }, []);

  // Zone glow pulse animation
  useEffect(() => {
    if (!svgRef.current) return;
    const alertZones = svgRef.current.querySelectorAll("[data-alert='true']");
    alertZones.forEach((el) => {
      gsap.to(el, {
        opacity: 0.4,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
  }, [zones, equipment]);

  // Count equipment stats per zone type
  const getZoneStats = useCallback((zoneType: string) => {
    const matchingZones = zones.filter((z) => z.zone_type === zoneType);
    const zoneIds = new Set(matchingZones.map((z) => z.id));
    const zoneEquip = equipment.filter((e) => e.zone_id && zoneIds.has(e.zone_id));
    const operational = zoneEquip.filter((e) => e.status === "operational").length;
    const failed = zoneEquip.filter((e) => e.status === "failed").length;
    const maintenance = zoneEquip.filter((e) => e.status === "maintenance").length;
    return { total: zoneEquip.length, operational, failed, maintenance, hasAlert: failed > 0 };
  }, [zones, equipment]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 60 900 280"
      className="w-full h-full"
      style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))" }}
    >
      <defs>
        {/* Ocean gradient */}
        <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2a4a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#061a2e" stopOpacity="0.9" />
        </linearGradient>
        {/* Hull gradient */}
        <linearGradient id="hullGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a6a8a" />
          <stop offset="40%" stopColor="#3a5a7a" />
          <stop offset="100%" stopColor="#2a3a4a" />
        </linearGradient>
        {/* Waterline */}
        <linearGradient id="waterlineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8B2020" />
          <stop offset="100%" stopColor="#6B1515" />
        </linearGradient>
        {/* Selection glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="alertGlow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ocean waves */}
      <path
        ref={wavesRef}
        d="M0,310 Q150,300 300,310 Q450,320 600,310 Q750,300 900,310 L900,340 L0,340 Z"
        fill="url(#oceanGrad)"
      />

      {/* Hull outline */}
      <path
        d="M80,265 L80,195 L100,150 L110,130 L650,130 L780,170 L800,200 L790,260 L640,290 L200,290 L100,280 Z"
        fill="url(#hullGrad)"
        stroke="#5a8aba"
        strokeWidth="1.5"
      />

      {/* Waterline stripe */}
      <path
        d="M85,260 L790,255 L785,270 L640,288 L200,288 L100,278 Z"
        fill="url(#waterlineGrad)"
        opacity="0.7"
      />

      {/* Superstructure outline */}
      <path
        d="M100,195 L100,60 L125,60 L175,60 L175,90 L120,90 L120,130 L185,130 L185,195 Z"
        fill="#5a6a7a"
        stroke="#7a9aba"
        strokeWidth="1"
        opacity="0.8"
      />

      {/* Bridge windows */}
      <rect x="175" y="95" width="3" height="30" fill="#0EA5E9" opacity="0.8" rx="1" />
      {[98, 106, 114, 122].map((y) => (
        <rect key={y} x="173" y={y} width="4" height="4" fill="#0EA5E9" opacity="0.6" rx="0.5" />
      ))}

      {/* Funnel stripes */}
      <rect x="103" y="70" width="18" height="4" fill="#0EA5E9" opacity="0.8" rx="1" />

      {/* Internal structure lines (tank separators) */}
      {[270, 415, 560].map((x) => (
        <line key={x} x1={x} y1="150" x2={x} y2="260" stroke="#5a8aba" strokeWidth="0.5" opacity="0.4" />
      ))}
      {/* Deck line */}
      <line x1="110" y1="195" x2="780" y2="195" stroke="#5a8aba" strokeWidth="0.3" opacity="0.3" strokeDasharray="4 2" />

      {/* Interactive zones */}
      {ZONE_DEFS.map((zd, i) => {
        const stats = getZoneStats(zd.zoneType);
        const isSelected = selectedZone === zd.zoneType;
        const isHovered = hoveredZone === zd.zoneType;
        const zoneColor = ZONE_TYPE_COLORS[zd.zoneType as keyof typeof ZONE_TYPE_COLORS] ?? "#6B7280";
        const zoneLabel = ZONE_TYPE_LABELS[zd.zoneType as keyof typeof ZONE_TYPE_LABELS] ?? zd.zoneType;

        return (
          <g
            key={`${zd.zoneType}-${i}`}
            className="cursor-pointer"
            onClick={() => onSelectZone(isSelected ? null : zd.zoneType)}
            onMouseEnter={() => setHoveredZone(zd.zoneType)}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {/* Zone fill */}
            <path
              d={zd.path}
              fill={zoneColor}
              opacity={isSelected ? 0.45 : isHovered ? 0.35 : 0.15}
              stroke={zoneColor}
              strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.5}
              filter={isSelected ? "url(#glow)" : undefined}
              style={{ transition: "opacity 0.3s, stroke-width 0.3s" }}
            />

            {/* Alert pulse overlay */}
            {stats.hasAlert && (
              <path
                d={zd.path}
                fill="#EF4444"
                opacity={0.6}
                data-alert="true"
                filter="url(#alertGlow)"
              />
            )}

            {/* Status LED */}
            <circle
              cx={zd.labelX}
              cy={zd.labelY - 14}
              r={4}
              fill={stats.hasAlert ? "#EF4444" : stats.maintenance > 0 ? "#F59E0B" : "#10B981"}
              stroke="#fff"
              strokeWidth="0.8"
              opacity="0.9"
            />

            {/* Zone label */}
            <text
              x={zd.labelX}
              y={zd.labelY}
              textAnchor="middle"
              fill={isSelected || isHovered ? "#fff" : zoneColor}
              fontSize={isSelected ? 9 : 7.5}
              fontWeight={isSelected ? 700 : 500}
              fontFamily="system-ui, sans-serif"
              style={{ transition: "fill 0.3s, font-size 0.3s" }}
            >
              {zoneLabel}
            </text>

            {/* Equipment count */}
            {stats.total > 0 && (
              <text
                x={zd.labelX}
                y={zd.labelY + 11}
                textAnchor="middle"
                fill={zoneColor}
                fontSize="6"
                opacity="0.7"
                fontFamily="system-ui, sans-serif"
              >
                {stats.operational}/{stats.total} equip.
              </text>
            )}
          </g>
        );
      })}

      {/* Radar and antenna */}
      <line x1="148" y1="60" x2="148" y2="45" stroke="#aaa" strokeWidth="1" />
      <circle cx="148" cy="43" r="5" fill="none" stroke="#0EA5E9" strokeWidth="0.8" opacity="0.5" />
      <circle cx="148" cy="43" r="2" fill="#0EA5E9" opacity="0.5" />
    </svg>
  );
}

// ─── Zone Detail Panel ──────────────────────────────────

function ZoneDetailPanel({
  zoneType,
  zones,
  equipment,
  onClose,
}: {
  zoneType: string;
  zones: VesselZone[];
  equipment: Equipment[];
  onClose: () => void;
}) {
  const matchingZones = zones.filter((z) => z.zone_type === zoneType);
  const zoneIds = new Set(matchingZones.map((z) => z.id));
  const zoneEquip = equipment.filter((e) => e.zone_id && zoneIds.has(e.zone_id));
  const zoneColor = ZONE_TYPE_COLORS[zoneType as keyof typeof ZONE_TYPE_COLORS] ?? "#6B7280";
  const zoneLabel = ZONE_TYPE_LABELS[zoneType as keyof typeof ZONE_TYPE_LABELS] ?? zoneType;

  const operational = zoneEquip.filter((e) => e.status === "operational").length;
  const failed = zoneEquip.filter((e) => e.status === "failed").length;
  const maintenance = zoneEquip.filter((e) => e.status === "maintenance").length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-3 right-3 w-72 max-h-[85%] overflow-y-auto rounded-xl border border-white/10 bg-[#0f1923]/95 backdrop-blur-xl shadow-2xl"
    >
      {/* Header */}
      <div className="sticky top-0 bg-[#0f1923]/95 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: zoneColor }} />
            <span className="text-sm font-bold text-white">{zoneLabel}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm">✕</button>
        </div>
        {/* Status summary */}
        <div className="flex gap-3 mt-2 text-[10px]">
          <span className="flex items-center gap-1 text-[#10B981]">
            <CheckCircle2 size={10} /> {operational} OK
          </span>
          {maintenance > 0 && (
            <span className="flex items-center gap-1 text-[#F59E0B]">
              <Wrench size={10} /> {maintenance} Mtto
            </span>
          )}
          {failed > 0 && (
            <span className="flex items-center gap-1 text-[#EF4444]">
              <AlertTriangle size={10} /> {failed} Falla
            </span>
          )}
        </div>
      </div>

      {/* Equipment list */}
      <div className="p-3 space-y-1.5">
        {zoneEquip.length === 0 ? (
          <p className="text-[10px] text-white/30 text-center py-4">Sin equipos registrados</p>
        ) : (
          zoneEquip.map((eq) => (
            <div
              key={eq.id}
              className="flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/8 px-3 py-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-white truncate">{eq.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-[#0EA5E9] font-mono">{eq.code}</span>
                  {eq.manufacturer && (
                    <span className="text-[8px] text-white/30">{eq.manufacturer}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                  style={{
                    backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}15`,
                    color: EQUIPMENT_STATUS_COLORS[eq.status],
                  }}
                >
                  {EQUIPMENT_STATUS_LABELS[eq.status]}
                </span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ─── Exported Component ─────────────────────────────────

export function VesselProfile({
  zones,
  equipment,
  fullscreenMode = false,
  onToggleFullscreen,
}: {
  zones: VesselZone[];
  equipment: Equipment[];
  fullscreenMode?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const totalEquip = equipment.length;
  const operational = equipment.filter((e) => e.status === "operational").length;
  const failed = equipment.filter((e) => e.status === "failed").length;

  return (
    <div
      className={
        fullscreenMode
          ? "fixed inset-0 z-50 bg-[#0a1520]"
          : "relative h-[450px] md:h-[500px] rounded-xl border border-[var(--border)] bg-[#0a1520] overflow-hidden"
      }
    >
      {/* SVG Vessel */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <VesselSVG
          zones={zones}
          equipment={equipment}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
        />
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-linear-to-b from-[#0a1520]/95 to-transparent">
        <div className="flex items-center gap-2">
          <Ship size={14} className="text-[#0EA5E9]" />
          <span className="text-xs font-bold text-[#0EA5E9]">PERFIL DEL BUQUE</span>
          <span className="text-[10px] text-white/40">M/V GRIXI MARINER</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10B981]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
            LIVE
          </span>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md px-2 py-1 text-[10px] text-white/60 hover:bg-white/10 transition-all"
            >
              {fullscreenMode ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 bg-linear-to-t from-[#0a1520]/95 to-transparent">
        <div className="flex items-center gap-4 text-[9px]">
          <span className="flex items-center gap-1 text-white/40"><Compass size={10} /> {zones.length} zonas</span>
          <span className="flex items-center gap-1 text-[#10B981]"><Anchor size={10} /> {operational}/{totalEquip} operativos</span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-[#EF4444]"><AlertTriangle size={10} /> {failed} fallas</span>
          )}
          <span className="flex items-center gap-1 text-white/40"><Waves size={10} /> Mar 3 — Viento 15kt NW</span>
          <span className="flex items-center gap-1 text-white/40"><ThermometerSun size={10} /> 28°C · Humedad 82%</span>
        </div>
        <div className="text-[8px] text-white/25">Click en zona para ver equipos</div>
      </div>

      {/* Zone Detail Panel */}
      <AnimatePresence>
        {selectedZone && (
          <ZoneDetailPanel
            zoneType={selectedZone}
            zones={zones}
            equipment={equipment}
            onClose={() => setSelectedZone(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
