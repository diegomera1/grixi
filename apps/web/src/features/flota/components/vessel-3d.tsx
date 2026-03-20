"use client";

import React, {
  useRef,
  useState,
  useMemo,
  Suspense,
} from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2, Minimize2, Layers, AlertTriangle,
  Anchor, Compass,
} from "lucide-react";
import * as THREE from "three";
import type { VesselZone, Equipment } from "../types";
import { ZONE_TYPE_COLORS, EQUIPMENT_STATUS_COLORS } from "../types";

// ─── Texture Hook (same pattern as warehouse-3d.tsx) ────

function useVesselTextures() {
  const [hull, deck, metal] = useLoader(THREE.TextureLoader, [
    "/textures/metal.png",
    "/textures/concrete.png",
    "/textures/wall.png",
  ]);

  useMemo(() => {
    hull.wrapS = THREE.RepeatWrapping;
    hull.wrapT = THREE.RepeatWrapping;
    hull.repeat.set(6, 3);
    deck.wrapS = THREE.RepeatWrapping;
    deck.wrapT = THREE.RepeatWrapping;
    deck.repeat.set(4, 2);
    metal.wrapS = THREE.RepeatWrapping;
    metal.wrapT = THREE.RepeatWrapping;
    metal.repeat.set(2, 2);
  }, [hull, deck, metal]);

  return { hull, deck, metal };
}

// ─── Ocean Surface ──────────────────────────────────────

function OceanSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = -3.2 + Math.sin(clock.elapsedTime * 0.4) * 0.06;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]}>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#0a2a4a" roughness={0.3} metalness={0.1} transparent opacity={0.7} />
    </mesh>
  );
}

// ─── Ship Hull ──────────────────────────────────────────

const ShipHull = React.memo(function ShipHull({
  textures,
  isSelected,
  onClick,
}: {
  textures: ReturnType<typeof useVesselTextures>;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hullShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-8, -1.5);
    shape.lineTo(-7.5, -1.8);
    shape.lineTo(5, -1.8);
    shape.quadraticCurveTo(8.5, -1.8, 10, 0);
    shape.quadraticCurveTo(8.5, 1.8, 5, 1.8);
    shape.lineTo(-7.5, 1.8);
    shape.lineTo(-8, 1.5);
    shape.lineTo(-8, -1.5);
    return shape;
  }, []);

  const extrudeSettings = useMemo(
    () => ({ depth: 2.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }),
    []
  );

  const geometry = useMemo(() => new THREE.ExtrudeGeometry(hullShape, extrudeSettings), [hullShape, extrudeSettings]);

  return (
    <group onClick={onClick} position={[0, -2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          map={textures.hull}
          color={isSelected ? "#4a7aaa" : "#3a5a7a"}
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>
      {/* Waterline stripe */}
      <mesh position={[1, 0, 0.3]}>
        <boxGeometry args={[16, 3.4, 0.06]} />
        <meshStandardMaterial color="#8B2020" roughness={0.7} />
      </mesh>
    </group>
  );
});

// ─── Superstructure ─────────────────────────────────────

const SuperstructureBlock = React.memo(function SuperstructureBlock({
  textures,
  onClick,
}: {
  textures: ReturnType<typeof useVesselTextures>;
  onClick: () => void;
}) {
  return (
    <group position={[-5.5, -0.5, 0]} onClick={onClick}>
      {/* Accommodation */}
      <mesh castShadow>
        <boxGeometry args={[2, 2.5, 2.8]} />
        <meshStandardMaterial map={textures.metal} color="#7a8a9a" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Bridge */}
      <mesh position={[0.2, 1.7, 0]} castShadow>
        <boxGeometry args={[1.5, 1, 3]} />
        <meshStandardMaterial map={textures.metal} color="#8a9aaa" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Bridge windows */}
      <mesh position={[1.0, 1.7, 0]}>
        <boxGeometry args={[0.06, 0.4, 2.6]} />
        <meshStandardMaterial color="#0EA5E9" emissive="#0EA5E9" emissiveIntensity={0.5} />
      </mesh>
      {/* Funnel */}
      <mesh position={[-0.8, 1.8, 0]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Funnel company stripe */}
      <mesh position={[-0.8, 2.2, 0]}>
        <boxGeometry args={[0.86, 0.3, 0.86]} />
        <meshStandardMaterial color="#0EA5E9" emissive="#0EA5E9" emissiveIntensity={0.3} />
      </mesh>
      {/* Radar mast */}
      <mesh position={[0.2, 2.8, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2]} />
        <meshStandardMaterial color="#aaa" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Radar disc */}
      <mesh position={[0.2, 3.3, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.05]} />
        <meshStandardMaterial color="#ccc" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
});

// ─── Cargo Tanks ────────────────────────────────────────

function CargoTanks({ textures }: { textures: ReturnType<typeof useVesselTextures> }) {
  const tanks = useMemo(() => [
    { x: -1, label: "TQ 1" },
    { x: 1.5, label: "TQ 2" },
    { x: 4, label: "TQ 3" },
    { x: 6.5, label: "TQ 4" },
  ], []);

  return (
    <group position={[0, -1.8, 0]}>
      {tanks.map((t) => (
        <group key={t.label} position={[t.x, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[2, 1.2, 2.8]} />
            <meshStandardMaterial map={textures.deck} color="#C2942A" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.2, 8]} />
            <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
          </mesh>
          <Text position={[0, 1.1, 0]} fontSize={0.15} color="#F59E0B" anchorX="center">
            {t.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ─── Engine Room Block ──────────────────────────────────

function EngineRoomBlock({ textures }: { textures: ReturnType<typeof useVesselTextures> }) {
  return (
    <group position={[-3, -2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.5, 2, 2.5]} />
        <meshStandardMaterial map={textures.metal} color="#8B3030" roughness={0.5} metalness={0.4} />
      </mesh>
      <Text position={[0, 1.4, 0]} fontSize={0.14} color="#EF4444" anchorX="center">
        SALA MÁQUINAS
      </Text>
    </group>
  );
}

// ─── Deck Piping ────────────────────────────────────────

function DeckPiping() {
  return (
    <group>
      {[-0.8, 0, 0.8].map((z) => (
        <mesh key={z} position={[2, -1.1, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 14, 6]} />
          <meshStandardMaterial color="#6a7a8a" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {[-1.1, 1.1].map((z) => (
        <mesh key={z} position={[8.5, -1.0, z]}>
          <cylinderGeometry args={[0.1, 0.12, 0.3, 8]} />
          <meshStandardMaterial color="#555" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Zone Labels with hover tooltips ────────────────────

function ZoneLabels({ zones, selectedZone, onSelect }: {
  zones: VesselZone[];
  selectedZone: string | null;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <group>
      {zones.slice(0, 8).map((zone, i) => {
        const color = ZONE_TYPE_COLORS[zone.zone_type] ?? "#6B7280";
        const isActive = selectedZone === zone.id;
        const isHovered = hovered === zone.id;
        const angle = (i / 8) * Math.PI * 0.6 - 0.3;
        const x = zone.pos_x ?? Math.cos(angle) * 5;
        const y = (zone.pos_y ?? 1) + 1.5;
        const z = zone.pos_z ?? Math.sin(angle) * 2;

        return (
          <group
            key={zone.id}
            position={[x, y, z]}
            onClick={(e) => { e.stopPropagation(); onSelect(zone.id); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(zone.id); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { setHovered(null); document.body.style.cursor = "auto"; }}
          >
            <mesh>
              <sphereGeometry args={[isActive ? 0.12 : 0.08, 8, 8]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isActive ? 1.2 : 0.4}
              />
            </mesh>
            <Text
              position={[0, 0.22, 0]}
              fontSize={isActive ? 0.13 : 0.09}
              color={isActive ? "#ffffff" : color}
              anchorX="center"
            >
              {zone.name}
            </Text>

            {/* Tooltip on hover — warehouse pattern */}
            {isHovered && (
              <Html position={[0, 0.5, 0]} center style={{ pointerEvents: "none" }}>
                <div
                  style={{
                    background: "white",
                    borderRadius: 10,
                    padding: "8px 14px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    whiteSpace: "nowrap",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                    {zone.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                    {zone.description ?? zone.zone_type}
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─── Equipment Status LEDs ──────────────────────────────

function EquipmentLEDs({ equipment }: { equipment: Equipment[] }) {
  const critical = equipment.filter((e) => e.status === "failed" || e.status === "maintenance");

  return (
    <group>
      {critical.slice(0, 6).map((eq, i) => {
        const color = EQUIPMENT_STATUS_COLORS[eq.status] ?? "#6B7280";
        const x = -6 + i * 2.5;
        return (
          <group key={eq.id} position={[x, 0.5, 2.5]}>
            <mesh>
              <sphereGeometry args={[0.06, 6, 6]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={eq.status === "failed" ? 2 : 0.8}
                toneMapped={false}
              />
            </mesh>
            {eq.status === "failed" && (
              <pointLight position={[0, 0, 0]} intensity={0.3} distance={2} color={color} decay={2} />
            )}
            <Text position={[0, 0.18, 0]} fontSize={0.07} color={color} anchorX="center">
              {eq.code}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ─── Scene (inside Suspense) ────────────────────────────

function VesselScene({ zones, equipment, selectedZone, onSelectZone }: {
  zones: VesselZone[];
  equipment: Equipment[];
  selectedZone: string | null;
  onSelectZone: (id: string) => void;
}) {
  const textures = useVesselTextures();

  return (
    <>
      {/* Lighting — same pattern as warehouse-3d */}
      <ambientLight intensity={0.5} color="#F0F4FF" />
      <directionalLight
        position={[12, 18, 10]}
        intensity={1.2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 12, -5]} intensity={0.4} color="#e8dcd0" />
      <hemisphereLight args={["#b1e1ff", "#0a1520", 0.5]} />

      <OceanSurface />

      <group position={[0, 0, 0]}>
        <ShipHull textures={textures} isSelected={!selectedZone} onClick={() => onSelectZone("")} />
        <SuperstructureBlock textures={textures} onClick={() => {
          const bridge = zones.find((z) => z.zone_type === "bridge");
          if (bridge) onSelectZone(bridge.id);
        }} />
        <CargoTanks textures={textures} />
        <EngineRoomBlock textures={textures} />
        <DeckPiping />
        <ZoneLabels zones={zones} selectedZone={selectedZone} onSelect={onSelectZone} />
        <EquipmentLEDs equipment={equipment} />
      </group>

      <OrbitControls
        makeDefault
        minDistance={5}
        maxDistance={25}
        enablePan
        enableZoom
        autoRotate
        autoRotateSpeed={0.3}
        maxPolarAngle={Math.PI * 0.75}
      />
    </>
  );
}

// ─── Exported Component ──────────────────────────────────

export function Vessel3D({ zones, equipment, fullscreenMode = false, onToggleFullscreen }: {
  zones: VesselZone[];
  equipment: Equipment[];
  fullscreenMode?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const selectedZoneData = zones.find((z) => z.id === selectedZone);
  const zoneEquipment = equipment.filter((e) => e.zone_id === selectedZone);

  return (
    <div className={fullscreenMode
      ? "fixed inset-0 z-50 bg-[#0f1923]"
      : "relative h-[450px] md:h-[550px] rounded-xl border border-[var(--border)] bg-[#0f1923] overflow-hidden"
    }>
      <Canvas
        camera={{ position: [8, 6, 12], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        shadows
      >
        <color attach="background" args={["#0f1923"]} />
        <fog attach="fog" args={["#0f1923", 30, 55]} />
        <Suspense fallback={null}>
          <VesselScene
            zones={zones}
            equipment={equipment}
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
          />
        </Suspense>
      </Canvas>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-linear-to-b from-[#0f1923]/90 to-transparent">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-[#0EA5E9]" />
          <span className="text-xs font-bold text-[#0EA5E9]">VISTA 3D</span>
          <span className="text-[10px] text-white/50">M/V GRIXI MARINER</span>
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
              {fullscreenMode ? "Salir" : "Expandir"}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-linear-to-t from-[#0f1923]/90 to-transparent">
        <div className="flex items-center gap-4 text-[9px] text-white/40">
          <span className="flex items-center gap-1"><Layers size={10} /> {zones.length} zonas</span>
          <span className="flex items-center gap-1"><Anchor size={10} /> {equipment.length} equipos</span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={10} />
            {equipment.filter((e) => e.status !== "operational").length} alertas
          </span>
        </div>
        <div className="text-[8px] text-white/30">Drag to rotate · Scroll to zoom · Click zones</div>
      </div>

      {/* Zone Detail Panel */}
      <AnimatePresence>
        {selectedZoneData && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-14 right-3 w-64 max-h-[60%] overflow-y-auto rounded-xl border border-white/10 bg-[#0f1923]/95 p-3 backdrop-blur-xl shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ZONE_TYPE_COLORS[selectedZoneData.zone_type] }} />
                <span className="text-xs font-bold text-white">{selectedZoneData.name}</span>
              </div>
              <button onClick={() => setSelectedZone(null)} className="text-white/40 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-[10px] text-white/50 mb-2">{selectedZoneData.description}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Equipos ({zoneEquipment.length})</p>
            <div className="space-y-1">
              {zoneEquipment.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-white truncate">{eq.name}</p>
                    <p className="text-[8px] text-[#0EA5E9]">{eq.code}</p>
                  </div>
                  <span className="shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EQUIPMENT_STATUS_COLORS[eq.status] }} />
                </div>
              ))}
              {zoneEquipment.length === 0 && (
                <p className="text-[9px] text-white/30 py-2 text-center">Sin equipos en esta zona</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
