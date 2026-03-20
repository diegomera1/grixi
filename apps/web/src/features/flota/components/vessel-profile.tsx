"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import {
  Anchor, AlertTriangle, Wrench, CheckCircle2,
  Compass, Waves, Ship, ThermometerSun,
  Maximize2, Minimize2, Wind,
  Navigation,
} from "lucide-react";
import type { VesselZone, Equipment } from "../types";
import {
  ZONE_TYPE_COLORS, ZONE_TYPE_LABELS,
  EQUIPMENT_STATUS_COLORS, EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_CRITICALITY_COLORS,
} from "../types";
import type { MarineWeather } from "../hooks/use-maritime-data";

// ─── Zone shape definitions (SVG paths, viewBox 0 0 960 400) ────

type ZoneDef = {
  zoneType: string;
  path: string;
  labelX: number;
  labelY: number;
  label?: string;
};

const ZONE_DEFS: ZoneDef[] = [
  // Bridge (top of superstructure)
  { zoneType: "bridge", path: "M145,90 L195,90 L195,125 L145,125 Z", labelX: 170, labelY: 111 },
  // Accommodation (middle superstructure)
  { zoneType: "accommodation", path: "M130,125 L205,125 L205,185 L130,185 Z", labelX: 167, labelY: 158 },
  // Funnel
  { zoneType: "funnel", path: "M120,58 L150,58 L150,90 L120,90 Z", labelX: 135, labelY: 77 },
  // Engine room (aft, below deck)
  { zoneType: "engine_room", path: "M130,195 L230,195 L230,270 L135,270 Z", labelX: 180, labelY: 240 },
  // Steering gear (far aft)
  { zoneType: "steering_gear", path: "M90,205 L130,195 L135,270 L95,265 Z", labelX: 113, labelY: 240 },
  // Pump room
  { zoneType: "pump_room", path: "M230,195 L300,195 L300,270 L230,270 Z", labelX: 265, labelY: 240 },
  // Cargo tanks port
  { zoneType: "cargo_tank", path: "M300,157 L450,157 L450,270 L300,270 Z", labelX: 375, labelY: 218, label: "T1-T2" },
  // Cargo tanks starboard
  { zoneType: "cargo_tank", path: "M450,157 L600,157 L600,270 L450,270 Z", labelX: 525, labelY: 218, label: "T3-T4" },
  // Main deck
  { zoneType: "main_deck", path: "M205,135 L700,135 L700,157 L205,157 Z", labelX: 450, labelY: 149 },
  // Ballast tank (double bottom)
  { zoneType: "ballast_tank", path: "M220,270 L680,270 L670,298 L230,298 Z", labelX: 450, labelY: 287 },
  // Forecastle (bow area)
  { zoneType: "forecastle", path: "M700,125 L830,182 L830,215 L700,157 Z", labelX: 760, labelY: 175 },
  // Upper deck machinery
  { zoneType: "upper_deck_machinery", path: "M600,157 L700,157 L700,270 L600,270 Z", labelX: 650, labelY: 218 },
];

// ─── Vessel SVG Profile ────────────────────────────

function VesselSVG({
  zones,
  equipment,
  selectedZone,
  onSelectZone,
  weather,
}: {
  zones: VesselZone[];
  equipment: Equipment[];
  selectedZone: string | null;
  onSelectZone: (zoneType: string | null) => void;
  weather?: MarineWeather;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wavesRef1 = useRef<SVGPathElement>(null);
  const wavesRef2 = useRef<SVGPathElement>(null);
  const radarRef = useRef<SVGCircleElement>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Wave animations with GSAP
  useEffect(() => {
    if (!wavesRef1.current || !wavesRef2.current) return;
    const tl1 = gsap.timeline({ repeat: -1, yoyo: true });
    tl1.to(wavesRef1.current, {
      attr: { d: "M0,320 C120,305 240,335 360,320 C480,305 600,335 720,320 C840,305 960,320 960,320 L960,400 L0,400 Z" },
      duration: 3,
      ease: "sine.inOut",
    });
    const tl2 = gsap.timeline({ repeat: -1, yoyo: true });
    tl2.to(wavesRef2.current, {
      attr: { d: "M0,330 C100,340 200,320 300,330 C400,340 500,320 600,330 C700,340 800,320 960,335 L960,400 L0,400 Z" },
      duration: 4,
      ease: "sine.inOut",
    });
    // Radar spin
    if (radarRef.current) {
      gsap.to(radarRef.current, { rotation: 360, duration: 3, repeat: -1, ease: "none", transformOrigin: "center" });
    }
    return () => { tl1.kill(); tl2.kill(); };
  }, []);

  // Alert zone pulse
  useEffect(() => {
    if (!svgRef.current) return;
    const els = svgRef.current.querySelectorAll("[data-alert='true']");
    els.forEach((el) => {
      gsap.to(el, { opacity: 0.3, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
  }, [zones, equipment]);

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
      viewBox="0 40 960 360"
      className="w-full h-full"
      style={{ filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.4))" }}
    >
      <defs>
        <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c3d6e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#041525" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="hullGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a7a9a" />
          <stop offset="35%" stopColor="#4a6a8a" />
          <stop offset="100%" stopColor="#2a3a4a" />
        </linearGradient>
        <linearGradient id="superGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a8a9a" />
          <stop offset="100%" stopColor="#5a6a7a" />
        </linearGradient>
        <linearGradient id="deckGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a5a6a" />
          <stop offset="100%" stopColor="#3a4a5a" />
        </linearGradient>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1828" />
          <stop offset="100%" stopColor="#0c2540" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="alertGlow"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="softGlow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Sky gradient */}
      <rect x="0" y="40" width="960" height="280" fill="url(#skyGrad)" />
      {/* Stars */}
      {[{x:50,y:60,o:0.3},{x:180,y:55,o:0.5},{x:320,y:72,o:0.4},{x:500,y:48,o:0.6},{x:680,y:65,o:0.35},{x:820,y:58,o:0.55},{x:900,y:75,o:0.45},{x:420,y:52,o:0.3},{x:750,y:70,o:0.5}].map((s,i)=>(
        <circle key={i} cx={s.x} cy={s.y} r={0.8} fill="white" opacity={s.o} />
      ))}

      {/* Ocean waves — dual layers for depth */}
      <path
        ref={wavesRef1}
        d="M0,320 C120,310 240,330 360,320 C480,310 600,330 720,320 C840,310 960,320 960,320 L960,400 L0,400 Z"
        fill="url(#oceanGrad)"
      />
      <path
        ref={wavesRef2}
        d="M0,330 C100,335 200,325 300,330 C400,335 500,325 600,330 C700,335 800,325 960,335 L960,400 L0,400 Z"
        fill="#061a2e"
        opacity="0.7"
      />

      {/* ═══ HULL ═══ */}
      <path
        d="M90,270 L90,205 L100,185 L120,157 L130,135 L700,135 L830,182 L850,215 L840,270 L670,300 L230,300 L110,285 Z"
        fill="url(#hullGrad)"
        stroke="#6a9aca"
        strokeWidth="1"
      />
      {/* Hull plate lines */}
      {[180, 225, 270].map((y) => (
        <line key={`hl-${y}`} x1="110" y1={y} x2="840" y2={y} stroke="#5a8aba" strokeWidth="0.3" opacity="0.2" />
      ))}
      {/* Waterline */}
      <path
        d="M95,268 L840,266 L835,280 L670,298 L230,298 L110,283 Z"
        fill="#8B2020"
        opacity="0.7"
      />
      {/* Hull rivets */}
      {[200,300,400,500,600,700].map((x)=>(
        <circle key={`r-${x}`} cx={x} cy={270} r={1.5} fill="#5a6a7a" opacity="0.3" />
      ))}

      {/* ═══ SUPERSTRUCTURE ═══ */}
      <path
        d="M120,195 L120,58 L150,58 L200,58 L200,90 L145,90 L145,125 L205,125 L205,195 Z"
        fill="url(#superGrad)"
        stroke="#8aAaCa"
        strokeWidth="0.8"
      />
      {/* Bridge windows row */}
      {[93,100,107,114,121].map((y)=>(
        <rect key={`bw-${y}`} x="195" y={y} width="3" height="5" fill="#0EA5E9" opacity="0.7" rx="0.5" />
      ))}
      {/* Side bridge windows */}
      {[93,100,107,114].map((y)=>(
        <rect key={`sw-${y}`} x="145" y={y} width="2" height="4" fill="#0EA5E9" opacity="0.4" rx="0.5" />
      ))}
      {/* Bridge front panoramic window */}
      <rect x="196" y="92" width="4" height="30" fill="#0EA5E9" opacity="0.8" rx="1" />
      {/* Accommodation windows */}
      {[132,142,152,162,172].map((y)=> [133,145,157,169,181,193].map((x,xi)=>(
        <rect key={`aw-${x}-${y}`} x={x} y={y} width="3" height="3" fill="#F59E0B" opacity={0.2 + (xi % 3) * 0.15} rx="0.5" />
      )))}

      {/* ═══ FUNNEL ═══ */}
      <path d="M122,60 L125,48 L145,48 L148,60" fill="#3a3a3a" stroke="#5a5a5a" strokeWidth="0.5" />
      <rect x="125" y="52" width="20" height="3" fill="#0EA5E9" opacity="0.8" rx="0.5" />
      <rect x="125" y="56" width="20" height="2" fill="#0EA5E9" opacity="0.4" rx="0.5" />
      {/* Exhaust plume */}
      <ellipse cx="135" cy="44" rx="6" ry="3" fill="white" opacity="0.04" />

      {/* ═══ RADAR & MAST ═══ */}
      <line x1="170" y1="90" x2="170" y2="55" stroke="#aaa" strokeWidth="1" />
      <line x1="170" y1="58" x2="170" y2="42" stroke="#888" strokeWidth="0.6" />
      <circle ref={radarRef} cx="170" cy="42" r="7" fill="none" stroke="#0EA5E9" strokeWidth="0.8" opacity="0.5" strokeDasharray="3 10" />
      <circle cx="170" cy="42" r="2" fill="#0EA5E9" opacity="0.6" />
      {/* Nav lights */}
      <circle cx="170" cy="52" r="1.5" fill="#EF4444" opacity="0.8" />
      <circle cx="172" cy="52" r="1.5" fill="#10B981" opacity="0.8" />

      {/* ═══ CARGO MANIFOLDS ═══ */}
      {[350,400,450,500,550].map((x)=>(
        <g key={`mf-${x}`}>
          <line x1={x} y1="157" x2={x} y2="143" stroke="#7a8a9a" strokeWidth="1.5" />
          <circle cx={x} cy="141" r="2" fill="#F59E0B" opacity="0.5" />
        </g>
      ))}

      {/* ═══ DECK PIPING ═══ */}
      {[-0.6,0,0.6].map((offset)=>(
        <line key={`pipe-${offset}`} x1="220" y1={148+offset*12} x2="700" y2={148+offset*12} stroke="#6a7a8a" strokeWidth="0.4" opacity="0.3" />
      ))}

      {/* ═══ CARGO CRANE (midships) ═══ */}
      <line x1="448" y1="135" x2="448" y2="95" stroke="#7a8a9a" strokeWidth="2" />
      <line x1="448" y1="97" x2="490" y2="110" stroke="#7a8a9a" strokeWidth="1.5" />
      <circle cx="448" cy="95" r="2" fill="#F59E0B" opacity="0.6" />

      {/* ═══ BOW DETAILS ═══ */}
      {/* Bow bulb (underwater) */}
      <ellipse cx="850" cy="240" rx="12" ry="30" fill="#3a5a7a" opacity="0.4" />
      {/* Anchor */}
      <circle cx="825" cy="180" r="1.5" fill="#aaa" />
      <line x1="825" y1="180" x2="825" y2="195" stroke="#aaa" strokeWidth="0.8" />
      {/* Bow thruster marking */}
      <circle cx="810" cy="250" r="6" fill="none" stroke="#0EA5E9" strokeWidth="0.5" opacity="0.3" />

      {/* ═══ MOORING EQUIPMENT ═══ */}
      {/* Aft */}
      <rect x="100" y="198" width="6" height="4" fill="#7a8a9a" rx="0.5" />
      <rect x="108" y="198" width="6" height="4" fill="#7a8a9a" rx="0.5" />
      {/* Forward */}
      <rect x="776" y="172" width="5" height="4" fill="#7a8a9a" rx="0.5" />
      <rect x="783" y="172" width="5" height="4" fill="#7a8a9a" rx="0.5" />

      {/* Internal tank separators */}
      {[300,450,600].map((x)=>(
        <line key={`ts-${x}`} x1={x} y1="157" x2={x} y2="270" stroke="#5a8aba" strokeWidth="0.5" opacity="0.3" />
      ))}
      {/* Deck level line */}
      <line x1="130" y1="195" x2="830" y2="195" stroke="#5a8aba" strokeWidth="0.3" opacity="0.2" strokeDasharray="4 2" />

      {/* ═══ INTERACTIVE ZONES ═══ */}
      {ZONE_DEFS.map((zd, i) => {
        const stats = getZoneStats(zd.zoneType);
        const isSelected = selectedZone === zd.zoneType;
        const isHovered = hoveredZone === zd.zoneType;
        const zoneColor = ZONE_TYPE_COLORS[zd.zoneType as keyof typeof ZONE_TYPE_COLORS] ?? "#6B7280";
        const zoneLabel = zd.label ?? (ZONE_TYPE_LABELS[zd.zoneType as keyof typeof ZONE_TYPE_LABELS] ?? zd.zoneType);

        return (
          <g
            key={`${zd.zoneType}-${i}`}
            className="cursor-pointer"
            onClick={() => onSelectZone(isSelected ? null : zd.zoneType)}
            onMouseEnter={() => setHoveredZone(zd.zoneType)}
            onMouseLeave={() => setHoveredZone(null)}
          >
            <path
              d={zd.path}
              fill={zoneColor}
              opacity={isSelected ? 0.5 : isHovered ? 0.35 : 0.12}
              stroke={zoneColor}
              strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.5}
              filter={isSelected ? "url(#glow)" : undefined}
              style={{ transition: "opacity 0.3s, stroke-width 0.3s" }}
            />
            {stats.hasAlert && (
              <path d={zd.path} fill="#EF4444" opacity={0.5} data-alert="true" filter="url(#alertGlow)" />
            )}
            <circle
              cx={zd.labelX}
              cy={zd.labelY - 14}
              r={isSelected ? 5 : 3.5}
              fill={stats.hasAlert ? "#EF4444" : stats.maintenance > 0 ? "#F59E0B" : "#10B981"}
              stroke="#fff"
              strokeWidth="0.6"
              opacity="0.9"
              filter="url(#softGlow)"
            />
            <text
              x={zd.labelX} y={zd.labelY}
              textAnchor="middle"
              fill={isSelected || isHovered ? "#fff" : zoneColor}
              fontSize={isSelected ? 9 : 7}
              fontWeight={isSelected ? 700 : 500}
              fontFamily="system-ui, sans-serif"
              style={{ transition: "fill 0.3s" }}
            >
              {zoneLabel}
            </text>
            {stats.total > 0 && (
              <text x={zd.labelX} y={zd.labelY + 10} textAnchor="middle" fill={zoneColor} fontSize="5.5" opacity="0.6" fontFamily="system-ui, sans-serif">
                {stats.operational}/{stats.total}
              </text>
            )}
          </g>
        );
      })}

      {/* ═══ VESSEL NAME ═══ */}
      <text x="450" y="285" textAnchor="middle" fill="#6a9aca" fontSize="8" fontWeight="600" fontFamily="system-ui, sans-serif" opacity="0.5">
        {weather?.description ? `${weather.description} · Bf ${weather.beaufortScale}` : "MV GRIXI PACÍFICO"}
      </text>
    </svg>
  );
}

// ─── Zone Detail Panel ──────────────────────────

function ZoneDetailPanel({ zoneType, zones, equipment, onClose }: {
  zoneType: string; zones: VesselZone[]; equipment: Equipment[]; onClose: () => void;
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
      className="absolute top-3 right-3 w-72 max-h-[85%] overflow-y-auto rounded-xl border border-white/10 bg-[#0c1e3a]/95 backdrop-blur-xl shadow-2xl"
    >
      <div className="sticky top-0 bg-[#0c1e3a]/95 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: zoneColor }} />
            <span className="text-sm font-bold text-white">{zoneLabel}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm transition-colors">✕</button>
        </div>
        <div className="flex gap-3 mt-2 text-[10px]">
          <span className="flex items-center gap-1 text-[#10B981]"><CheckCircle2 size={10} /> {operational} OK</span>
          {maintenance > 0 && <span className="flex items-center gap-1 text-[#F59E0B]"><Wrench size={10} /> {maintenance}</span>}
          {failed > 0 && <span className="flex items-center gap-1 text-[#EF4444]"><AlertTriangle size={10} /> {failed}</span>}
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {zoneEquip.length === 0 ? (
          <p className="text-[10px] text-white/30 text-center py-4">Sin equipos registrados</p>
        ) : zoneEquip.map((eq) => (
          <div key={eq.id} className="flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/8 px-3 py-2 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white truncate">{eq.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-[#0EA5E9] font-mono">{eq.code}</span>
                {eq.manufacturer && <span className="text-[8px] text-white/30">{eq.manufacturer}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}15`, color: EQUIPMENT_STATUS_COLORS[eq.status] }}>
                {EQUIPMENT_STATUS_LABELS[eq.status]}
              </span>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Exported Component ──────────────────────────

export function VesselProfile({ zones, equipment, weather, fullscreenMode = false, onToggleFullscreen }: {
  zones: VesselZone[];
  equipment: Equipment[];
  weather?: MarineWeather;
  fullscreenMode?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const totalEquip = equipment.length;
  const operational = equipment.filter((e) => e.status === "operational").length;
  const failed = equipment.filter((e) => e.status === "failed").length;

  const w = weather;

  return (
    <div className={fullscreenMode
      ? "fixed inset-0 z-50 bg-[#0a1520]"
      : "relative h-[480px] md:h-[520px] rounded-xl border border-white/10 bg-[#0a1520] overflow-hidden"
    }>
      <div className="absolute inset-0 flex items-center justify-center px-2">
        <VesselSVG zones={zones} equipment={equipment} selectedZone={selectedZone} onSelectZone={setSelectedZone} weather={weather} />
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-linear-to-b from-[#0a1520]/95 to-transparent">
        <div className="flex items-center gap-2">
          <Ship size={14} className="text-[#0EA5E9]" />
          <span className="text-xs font-bold text-[#0EA5E9]">PERFIL INTERACTIVO</span>
          <span className="text-[10px] text-white/40">MV GRIXI PACÍFICO</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10B981]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
            LIVE
          </span>
          {onToggleFullscreen && (
            <button onClick={onToggleFullscreen} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md px-2 py-1 text-[10px] text-white/60 hover:bg-white/10 transition-all">
              {fullscreenMode ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5 bg-linear-to-t from-[#0a1520]/95 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[9px]">
            <span className="flex items-center gap-1 text-white/40"><Compass size={10} /> {zones.length} zonas</span>
            <span className="flex items-center gap-1 text-[#10B981]"><Anchor size={10} /> {operational}/{totalEquip}</span>
            {failed > 0 && <span className="flex items-center gap-1 text-[#EF4444]"><AlertTriangle size={10} /> {failed} fallas</span>}
          </div>
          {w && (
            <div className="flex items-center gap-3 text-[9px]">
              <span className="flex items-center gap-1 text-white/40"><Wind size={10} /> {w.windSpeed}kt {w.windDir}</span>
              <span className="flex items-center gap-1 text-white/40"><Waves size={10} /> {w.waveHeight}m</span>
              <span className="flex items-center gap-1 text-white/40"><ThermometerSun size={10} /> {w.airTemp}°C</span>
              <span className="flex items-center gap-1 text-white/40"><Navigation size={10} /> Bf {w.beaufortScale}</span>
            </div>
          )}
          <div className="text-[8px] text-white/25">Click en zona para ver equipos</div>
        </div>
      </div>

      <AnimatePresence>
        {selectedZone && (
          <ZoneDetailPanel zoneType={selectedZone} zones={zones} equipment={equipment} onClose={() => setSelectedZone(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
