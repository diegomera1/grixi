"use client";

import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float, Line, useTexture } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2, Minimize2, Layers, AlertTriangle,
  Anchor, Compass,
} from "lucide-react";
import * as THREE from "three";
import type { VesselZone, Equipment } from "../types";
import { ZONE_TYPE_COLORS, EQUIPMENT_STATUS_COLORS } from "../types";

// ── Holographic Ship Scene ──────────────────────

function HolographicGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame(({ clock }) => {
    if (gridRef.current) {
      gridRef.current.position.y = -4;
      (gridRef.current.material as THREE.Material).opacity = 0.15 + Math.sin(clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[40, 40, "#0EA5E9", "#0EA5E9"]}
      position={[0, -4, 0]}
    />
  );
}

// Floating particles for holographic effect
function HoloParticles() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    // Deterministic pseudo-random for ESLint purity
    let seed = 7;
    const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };
    const arr = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      arr[i * 3] = (rand() - 0.5) * 30;
      arr[i * 3 + 1] = (rand() - 0.5) * 15;
      arr[i * 3 + 2] = (rand() - 0.5) * 20;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (points.current) {
      points.current.rotation.y = clock.elapsedTime * 0.02;
      (points.current.material as THREE.PointsMaterial).opacity =
        0.3 + Math.sin(clock.elapsedTime) * 0.1;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#0EA5E9" transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

// Scanline effect plane
function ScanLine() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const y = ((clock.elapsedTime * 0.8) % 8) - 4;
      meshRef.current.position.y = y;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30, 0.03]} />
      <meshBasicMaterial color="#0EA5E9" transparent opacity={0.4} />
    </mesh>
  );
}

// Hull shape with metal texture
function ShipHull({ isSelected, onClick }: { isSelected: boolean; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);
  const hullTexRaw = useTexture("/fleet/texture-hull-paint.png");
  const rustTexRaw = useTexture("/fleet/texture-rust-metal.png");

  // Configure textures — Three.js requires direct prop mutation
  const hullTexture = useMemo(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    hullTexRaw.wrapS = hullTexRaw.wrapT = THREE.RepeatWrapping;
    hullTexRaw.repeat.set(4, 2);
    return hullTexRaw;
  }, [hullTexRaw]);
  const rustTexture = useMemo(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    rustTexRaw.wrapS = rustTexRaw.wrapT = THREE.RepeatWrapping;
    rustTexRaw.repeat.set(3, 1.5);
    return rustTexRaw;
  }, [rustTexRaw]);

  useFrame(({ clock }) => {
    if (edgeRef.current) {
      (edgeRef.current.material as THREE.LineBasicMaterial).opacity =
        0.6 + Math.sin(clock.elapsedTime * 2) * 0.15;
    }
  });

  const hullShape = useMemo(() => {
    const shape = new THREE.Shape();
    // Tanker hull outline (top-down)
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
    () => ({ depth: 2.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 }),
    []
  );

  const geometry = useMemo(() => new THREE.ExtrudeGeometry(hullShape, extrudeSettings), [hullShape, extrudeSettings]);
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group onClick={onClick} position={[0, -2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          map={isSelected ? hullTexture : rustTexture}
          color={isSelected ? "#6aafe6" : "#4a6a8a"}
          roughness={0.65}
          metalness={0.5}
        />
      </mesh>
      <lineSegments ref={edgeRef} geometry={edgeGeometry}>
        <lineBasicMaterial color="#0EA5E9" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}

// Superstructure (bridge + accommodation)
function Superstructure({ onClick }: { onClick: () => void }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child) => {
        if ((child as THREE.LineSegments).isLineSegments) {
          ((child as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity =
            0.5 + Math.sin(clock.elapsedTime * 1.5) * 0.2;
        }
      });
    }
  });

  const deckTexRaw = useTexture("/fleet/texture-deck-surface.png");
  const deckTex = useMemo(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    deckTexRaw.wrapS = deckTexRaw.wrapT = THREE.RepeatWrapping;
    deckTexRaw.repeat.set(2, 2);
    return deckTexRaw;
  }, [deckTexRaw]);

  return (
    <group ref={groupRef} position={[-5.5, -0.5, 0]} onClick={onClick}>
      {/* Main accommodation */}
      <TexturedBox size={[2, 2.5, 2.8]} position={[0, 0, 0]} color="#8a8a9a" tex={deckTex} />
      {/* Bridge */}
      <TexturedBox size={[1.5, 1, 3]} position={[0.2, 1.7, 0]} color="#5a7a8a" tex={deckTex} />
      {/* Funnel */}
      <TexturedBox size={[0.8, 1.5, 0.8]} position={[-0.8, 1.5, 0]} color="#6a6a6a" tex={deckTex} />
      {/* Radar mast */}
      <mesh position={[0.2, 2.8, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.2]} />
        <meshStandardMaterial color="#0EA5E9" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.2, 3.3, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.05]} />
        <meshStandardMaterial color="#06B6D4" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Textured box helper (solid with texture)
function TexturedBox({ size, position, color, tex }: { size: [number, number, number]; position: [number, number, number]; color: string; tex: THREE.Texture }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(...size), [size]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshStandardMaterial map={tex} color={color} roughness={0.6} metalness={0.5} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#0EA5E9" transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}

// Holographic box helper (wireframe for labels)
function HoloBox({ size, position, color }: { size: [number, number, number]; position: [number, number, number]; color: string }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(...size), [size]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial color={color} transparent opacity={0.08} roughness={0.2} metalness={0.9} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

// Cargo tank areas
function CargoTanks() {
  const tanks = useMemo(() => [
    { pos: [-1, -1.2, -1.2] as [number, number, number], label: "1P" },
    { pos: [1, -1.2, -1.2] as [number, number, number], label: "2P" },
    { pos: [3, -1.2, -1.2] as [number, number, number], label: "3P" },
    { pos: [5, -1.2, -1.2] as [number, number, number], label: "4P" },
    { pos: [-1, -1.2, 1.2] as [number, number, number], label: "1S" },
    { pos: [1, -1.2, 1.2] as [number, number, number], label: "2S" },
    { pos: [3, -1.2, 1.2] as [number, number, number], label: "3S" },
    { pos: [5, -1.2, 1.2] as [number, number, number], label: "4S" },
  ], []);

  return (
    <group>
      {tanks.map((tank) => (
        <group key={tank.label} position={tank.pos}>
          <HoloBox size={[1.6, 1.8, 1.8]} position={[0, 0, 0]} color="#F59E0B" />
          <Text position={[0, 0.5, 0]} fontSize={0.2} color="#F59E0B" anchorX="center" anchorY="middle">
            {tank.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// Engine room equipment with textures
function EngineRoom() {
  const engineTexRaw = useTexture("/fleet/texture-engine-metal.png");
  const floorTexRaw = useTexture("/fleet/texture-floor-grating.png");
  const engineTex = useMemo(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    engineTexRaw.wrapS = engineTexRaw.wrapT = THREE.RepeatWrapping;
    engineTexRaw.repeat.set(2, 2);
    return engineTexRaw;
  }, [engineTexRaw]);
  const floorTex = useMemo(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    floorTexRaw.wrapS = floorTexRaw.wrapT = THREE.RepeatWrapping;
    floorTexRaw.repeat.set(1, 1);
    return floorTexRaw;
  }, [floorTexRaw]);

  return (
    <group position={[-3, -2.5, 0]}>
      {/* Main Engine — textured block */}
      <TexturedBox size={[2, 1.8, 1.5]} position={[0, 0.9, 0]} color="#aa5030" tex={engineTex} />
      <Float speed={2} rotationIntensity={0} floatIntensity={0.3}>
        <Text position={[0, 2.2, 0]} fontSize={0.15} color="#EF4444" anchorX="center">
          MOTOR PRINCIPAL
        </Text>
      </Float>
      {/* Generators — metallic */}
      <TexturedBox size={[0.8, 0.7, 0.6]} position={[1.8, 0.5, -0.5]} color="#5a8a9a" tex={floorTex} />
      <TexturedBox size={[0.8, 0.7, 0.6]} position={[1.8, 0.5, 0.5]} color="#5a8a9a" tex={floorTex} />
      <Text position={[1.8, 1.2, 0]} fontSize={0.1} color="#06B6D4" anchorX="center">
        GEN AUX
      </Text>
    </group>
  );
}

// Deck piping and manifold
function DeckPiping() {
  const points: [number, number, number][] = useMemo(() => [
    [-3, -0.8, 0],
    [0, -0.8, 0],
    [3, -0.8, 0],
    [6, -0.8, 0],
    [8, -0.8, 0],
  ], []);

  return (
    <group>
      <Line points={points} color="#10B981" lineWidth={1} transparent opacity={0.4} />
      {/* Manifold */}
      <mesh position={[3, -0.6, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.3]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// Zone highlight labels
function ZoneLabels({ zones, selectedZone, onSelect }: {
  zones: VesselZone[];
  selectedZone: string | null;
  onSelect: (id: string) => void;
}) {
  const keyZones = useMemo(() => zones.filter((z) =>
    ["bridge", "engine_room", "pump_room", "steering_gear", "bow_thruster"].includes(z.zone_type)
  ), [zones]);

  return (
    <group>
      {keyZones.map((zone) => {
        const color = ZONE_TYPE_COLORS[zone.zone_type] || "#0EA5E9";
        const isSelected = selectedZone === zone.id;
        const scale = isSelected ? 1.3 : 1;
        return (
          <group key={zone.id} position={[zone.pos_z / 12, zone.pos_y / 5, zone.pos_x / 10]}>
            <Float speed={1.5} floatIntensity={isSelected ? 0.5 : 0.2}>
              <Text
                fontSize={0.12 * scale}
                color={color}
                anchorX="center"
                anchorY="bottom"
                onClick={() => onSelect(zone.id)}
                outlineWidth={0.005}
                outlineColor="black"
              >
                {zone.name}
              </Text>
            </Float>
            {/* Indicator dot */}
            <mesh position={[0, -0.15, 0]} onClick={() => onSelect(zone.id)}>
              <sphereGeometry args={[0.06 * scale]} />
              <meshBasicMaterial color={color} transparent opacity={isSelected ? 1 : 0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Main 3D Scene ───────────────────────────────

function VesselScene({ zones, equipment, selectedZone, onSelectZone }: {
  zones: VesselZone[];
  equipment: Equipment[];
  selectedZone: string | null;
  onSelectZone: (id: string) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#0EA5E9" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#8B5CF6" />

      <HolographicGrid />
      <HoloParticles />
      <ScanLine />

      <group position={[0, 0, 0]}>
        <ShipHull isSelected={!selectedZone} onClick={() => onSelectZone("")} />
        <Superstructure onClick={() => {
          const bridge = zones.find((z) => z.zone_type === "bridge");
          if (bridge) onSelectZone(bridge.id);
        }} />
        <CargoTanks />
        <EngineRoom />
        <DeckPiping />
        <ZoneLabels zones={zones} selectedZone={selectedZone} onSelect={onSelectZone} />
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

// ── Exported Component ──────────────────────────

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
      ? "fixed inset-0 z-50 bg-black"
      : "relative h-[450px] md:h-[550px] rounded-xl border border-[var(--border)] bg-black overflow-hidden"
    }>
      {/* Canvas */}
      <Canvas
        camera={{ position: [8, 6, 12], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#030712"]} />
        <fog attach="fog" args={["#030712", 20, 40]} />
        <VesselScene
          zones={zones}
          equipment={equipment}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
        />
      </Canvas>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#030712]/90 to-transparent">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-[#0EA5E9]" />
          <span className="text-xs font-bold text-[#0EA5E9]">HOLOGRAPHIC VIEW</span>
          <span className="text-[10px] text-[var(--text-muted)]">M/V GRIXI MARINER</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10B981]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
            LIVE
          </span>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-md px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-all"
            >
              {fullscreenMode ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              {fullscreenMode ? "Salir" : "Expandir"}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-4 text-[9px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Layers size={10} />
            {zones.length} zonas
          </span>
          <span className="flex items-center gap-1">
            <Anchor size={10} />
            {equipment.length} equipos
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={10} />
            {equipment.filter((e) => e.status !== "operational").length} alertas
          </span>
        </div>
        <div className="text-[8px] text-[var(--text-muted)]">
          Drag to rotate · Scroll to zoom · Click zones
        </div>
      </div>

      {/* Zone Detail Panel */}
      <AnimatePresence>
        {selectedZoneData && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-14 right-3 w-64 max-h-[60%] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 p-3 backdrop-blur-xl shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ZONE_TYPE_COLORS[selectedZoneData.zone_type] }}
                />
                <span className="text-xs font-bold text-[var(--text-primary)]">{selectedZoneData.name}</span>
              </div>
              <button onClick={() => setSelectedZone(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">✕</button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">{selectedZoneData.description}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Equipos ({zoneEquipment.length})
            </p>
            <div className="space-y-1">
              {zoneEquipment.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between rounded-md bg-[var(--bg-muted)]/50 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-[var(--text-primary)] truncate">{eq.name}</p>
                    <p className="text-[8px] text-[#0EA5E9]">{eq.code}</p>
                  </div>
                  <span
                    className="shrink-0 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: EQUIPMENT_STATUS_COLORS[eq.status] }}
                  />
                </div>
              ))}
              {zoneEquipment.length === 0 && (
                <p className="text-[9px] text-[var(--text-muted)] py-2 text-center">Sin equipos en esta zona</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
