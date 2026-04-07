"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Warehouse, MapPin, Box, X as XIcon, Layers, ChevronRight, Package, Activity, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { fetchAllWarehousesOverview } from "../actions/stock-hierarchy-actions";
import type { WarehouseOverview, MiniRack as MiniRackData } from "../actions/stock-hierarchy-actions";

// ─── Color Palette ────────────────────────────────────────
const HOLO_COLORS: Record<string, { base: string; glow: string; edge: string; hex: number }> = {
  standard:     { base: "#4f46e5", glow: "#818cf8", edge: "#a5b4fc", hex: 0x6366f1 },
  cold_storage: { base: "#0891b2", glow: "#22d3ee", edge: "#67e8f9", hex: 0x22d3ee },
  cross_docking:{ base: "#d97706", glow: "#fbbf24", edge: "#fde68a", hex: 0xfbbf24 },
};

// ─── Seeded deterministic random ──────────────────────────
function srand(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}




// ─── Grid Floor ─────────────────────────────────────────
const HoloFloor = memo(function HoloFloor() {
  return (
    <group>
      {/* Main floor surface — dark slate, not black */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0e1225" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Primary grid — subtle indigo lines */}
      <gridHelper args={[200, 100, "#1e2340", "#151933"]} position={[0, 0, 0]} />
      {/* Secondary fine grid overlay */}
      <gridHelper args={[200, 400, "#13172e", "#11152a"]} position={[0, 0.001, 0]} />
      {/* Center accent glow on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshBasicMaterial color="#4f46e5" transparent opacity={0.018} depthWrite={false} />
      </mesh>
    </group>
  );
});

// ─── Ambient Particles ──────────────────────────────────
const HoloParticles = memo(function HoloParticles() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 300;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (srand(i * 127.1 + 311.7) - 0.5) * 120;
      pos[i * 3 + 1] = srand(i * 269.5 + 183.3) * 10 + 0.5;
      pos[i * 3 + 2] = (srand(i * 419.2 + 571.7) - 0.5) * 120;
      // Alternate between indigo and cyan
      const isCyan = srand(i * 997.3) > 0.5;
      colors[i * 3]     = isCyan ? 0.13 : 0.39;
      colors[i * 3 + 1] = isCyan ? 0.83 : 0.4;
      colors[i * 3 + 2] = isCyan ? 0.93 : 0.95;
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.008;
    // Gentle float
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.15) * 0.2;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.06}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
});

// ─── Scan Line (sweeps across scene) ────────────────────
const ScanLine = memo(function ScanLine() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime * 0.08) % 1);
    ref.current.position.z = -60 + t * 120;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.025 + Math.sin(t * Math.PI) * 0.015;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <planeGeometry args={[200, 0.3]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={0.03} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
});



// ─── Shared rack geometries (created once) ────────────────
const RACK_GEO = {
  post: new THREE.BoxGeometry(0.025, 1, 0.025),
  shelf: new THREE.BoxGeometry(1, 0.008, 0.35),
  beam: new THREE.BoxGeometry(1, 0.012, 0.015),
  box: new THREE.BoxGeometry(0.18, 0.12, 0.22),
  baseplate: new THREE.BoxGeometry(1, 0.012, 0.4),
};

// Status → box color
const BOX_STATUS_COLORS: Record<string, number> = {
  occupied: 0x22c55e,
  active: 0x22c55e,
  expired: 0xef4444,
  quarantine: 0xa855f7,
  reserved: 0x3b82f6,
  blocked: 0xf97316,
};

// ─── Mini Rack (detailed miniature) ───────────────────────
const RackUnit = memo(function RackUnit({ rack, pos, tint, isHovered, onHover, onClick }: {
  rack: MiniRackData;
  pos: [number, number, number];
  tint: number;
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cols = rack.columns;
  const rows = rack.rows;

  // Proportional sizing — wider for more columns, taller for more rows
  const colW = 0.22;
  const rowH = 0.3;
  const rW = cols * colW;
  const rH = rows * rowH + 0.08;
  const rD = 0.32;

  const total = rows * cols;
  const occupied = rack.rack_positions.filter(p => p.status === "occupied" || p.su_code).length;
  const fillPct = total > 0 ? occupied / total : 0;

  // Subtle hover animation — scale up slightly
  useFrame(() => {
    if (!groupRef.current) return;
    const target = isHovered ? 1.08 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
  });

  // Post color
  const postColor = isHovered ? 0xa5b4fc : 0x4338ca;
  const shelfColor = isHovered ? 0xc7d2fe : 0x6366f1;

  return (
    <group
      ref={groupRef}
      position={pos}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Floor selection glow */}
      {isHovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[rW + 0.4, rD + 0.4]} />
          <meshBasicMaterial color={tint} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}

      {/* Base plate */}
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[rW + 0.06, 0.012, rD + 0.06]} />
        <meshBasicMaterial color={isHovered ? 0x818cf8 : 0x312e81} transparent opacity={0.6} />
      </mesh>

      {/* 4 corner posts — metallic uprights */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([xD, zD], i) => (
        <mesh
          key={`p${i}`}
          geometry={RACK_GEO.post}
          position={[(xD * rW) / 2, rH / 2, (zD * rD) / 2]}
          scale={[1, rH, 1]}
        >
          <meshBasicMaterial color={postColor} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Horizontal shelves at each level */}
      {Array.from({ length: rows + 1 }, (_, i) => {
        const y = 0.012 + (i / rows) * (rH - 0.02);
        return (
          <group key={`shelf${i}`}>
            {/* Shelf surface */}
            <mesh position={[0, y, 0]} scale={[rW / 1, 1, rD / 0.35]}>
              <boxGeometry args={[1, 0.006, 0.35]} />
              <meshBasicMaterial color={shelfColor} transparent opacity={isHovered ? 0.4 : 0.2} />
            </mesh>
            {/* Front beam */}
            <mesh position={[0, y, rD / 2]} scale={[rW / 1, 1, 1]}>
              <boxGeometry args={[1, 0.01, 0.012]} />
              <meshBasicMaterial color={postColor} transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}

      {/* Inventory boxes — one per occupied position */}
      {rack.rack_positions.map((p) => {
        if (p.status === "empty" && !p.su_code) return null;

        const cw = rW / cols;
        const ch = (rH - 0.02) / rows;
        const cx = (p.column_number - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.012 + (p.row_number - 1) * ch + ch * 0.38;
        const boxW = cw * 0.72;
        const boxH = ch * 0.52;
        const boxD = rD * 0.65;

        const boxColor = BOX_STATUS_COLORS[p.status] || 0x22c55e;

        return (
          <mesh key={p.id} position={[cx, cy, 0]}>
            <boxGeometry args={[boxW, boxH, boxD]} />
            <meshBasicMaterial
              color={boxColor}
              transparent
              opacity={isHovered ? 0.85 : 0.6}
            />
          </mesh>
        );
      })}

      {/* Rack code label — shown on hover */}
      {isHovered && (
        <Text
          fontSize={0.11}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          position={[0, rH + 0.12, 0.2]}
          outlineWidth={0.008}
          outlineColor="#000000"
        >
          {rack.code} · {Math.round(fillPct * 100)}%
        </Text>
      )}
    </group>
  );
});

// ─── Holographic Warehouse Building ───────────────────────
const HolographicBuilding = memo(function HolographicBuilding({
  warehouse,
  position: bPos,
  isSelected,
  isHovered,
  onHover,
  onClick,
  onRackSelect,
}: {
  warehouse: WarehouseOverview;
  position: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
  onRackSelect: (rack: MiniRackData) => void;
}) {
  const palette = HOLO_COLORS[warehouse.type] || HOLO_COLORS.standard;
  const [hoveredRack, setHoveredRack] = useState<string | null>(null);

  // Layout: arrange racks in a grid inside the building
  const rackCols = Math.max(Math.ceil(Math.sqrt(warehouse.rackCount * 1.4)), 1);
  const rackRows = Math.max(Math.ceil(warehouse.rackCount / rackCols), 1);
  const spacing = 1.8;
  const gridW = (rackCols - 1) * spacing;
  const gridD = (rackRows - 1) * spacing;
  const pad = 2.0;
  const W = Math.max(gridW + pad * 2, 4);
  const D = Math.max(gridD + pad * 2, 4);
  const H = 3.8;

  const getRackPos = useCallback(
    (idx: number): [number, number, number] => {
      const c = idx % rackCols;
      const r = Math.floor(idx / rackCols);
      return [-gridW / 2 + c * spacing, 0.01, -gridD / 2 + r * spacing];
    },
    [rackCols, gridW, gridD]
  );

  const isActive = isSelected || isHovered;
  const edgeOpacity = isSelected ? 0.8 : isHovered ? 0.55 : 0.2;
  const occColor = warehouse.occupancy > 85 ? "#ef4444" : warehouse.occupancy > 60 ? "#fbbf24" : "#10b981";

  return (
    <group
      position={bPos}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={() => { onHover(false); }}
    >
      {/* ── Floor surface ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial
          color={isActive ? palette.base : "#141833"}
          transparent
          opacity={isActive ? 0.25 : 0.15}
          depthWrite={false}
        />
      </mesh>

      {/* ── Edge wireframe (bottom rectangle) ── */}
      <Line
        points={[
          [-W / 2, 0.01, -D / 2],
          [W / 2, 0.01, -D / 2],
          [W / 2, 0.01, D / 2],
          [-W / 2, 0.01, D / 2],
          [-W / 2, 0.01, -D / 2],
        ]}
        color={palette.edge}
        lineWidth={isActive ? 2.5 : 1.2}
        transparent
        opacity={edgeOpacity}
      />

      {/* ── 4 vertical corner edges ── */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([xD, zD], i) => (
        <Line
          key={`ve${i}`}
          points={[
            [xD * W / 2, 0.01, zD * D / 2],
            [xD * W / 2, H, zD * D / 2],
          ]}
          color={palette.edge}
          lineWidth={isActive ? 1.8 : 0.7}
          transparent
          opacity={edgeOpacity * 0.5}
        />
      ))}

      {/* ── Top edge wireframe (roof outline) ── */}
      <Line
        points={[
          [-W / 2, H, -D / 2],
          [W / 2, H, -D / 2],
          [W / 2, H, D / 2],
          [-W / 2, H, D / 2],
          [-W / 2, H, -D / 2],
        ]}
        color={palette.edge}
        lineWidth={isActive ? 1.5 : 0.5}
        transparent
        opacity={edgeOpacity * 0.3}
      />

      {/* ── Back wall (translucent panel) ── */}
      <mesh position={[0, H / 2, -D / 2]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial
          color={palette.base}
          transparent
          opacity={isActive ? 0.08 : 0.035}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Side walls (translucent) ── */}
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshBasicMaterial color={palette.base} transparent opacity={isActive ? 0.05 : 0.02} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshBasicMaterial color={palette.base} transparent opacity={isActive ? 0.05 : 0.02} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* ── Racks inside — clickable individually ── */}
      {warehouse.racks.map((r, i) => (
        <RackUnit
          key={r.id}
          rack={r}
          pos={getRackPos(i)}
          tint={palette.hex}
          isHovered={hoveredRack === r.id}
          onHover={(h) => setHoveredRack(h ? r.id : null)}
          onClick={() => onRackSelect(r)}
        />
      ))}

      {/* ── Label ── */}
      <group position={[0, H + 0.6, 0]}>
        <mesh position={[0, 0, -0.003]}>
          <planeGeometry args={[Math.max(warehouse.name.length * 0.12, 2) + 0.4, 0.6]} />
          <meshBasicMaterial color="#0c1029" transparent opacity={0.92} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[Math.max(warehouse.name.length * 0.12, 2) + 0.48, 0.68]} />
          <meshBasicMaterial color={palette.base} transparent opacity={isActive ? 0.5 : 0.15} depthWrite={false} />
        </mesh>
        <Text
          fontSize={0.16}
          color={isActive ? "#ffffff" : palette.glow}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.06, 0]}
        >
          {warehouse.name}
        </Text>
        <Text
          fontSize={0.08}
          color={occColor}
          anchorX="center"
          anchorY="middle"
          position={[0, -0.12, 0]}
        >
          {`${warehouse.occupancy}% · ${warehouse.rackCount} racks · ${warehouse.totalPositions} pos`}
        </Text>
      </group>

      {/* ── Point light — always on with varying intensity ── */}
      <pointLight
        position={[0, H / 2, 0]}
        color={palette.glow}
        intensity={isSelected ? 1.8 : isHovered ? 1.0 : 0.3}
        distance={isActive ? 12 : 6}
        decay={2}
      />
    </group>
  );
});

// ─── Camera Smooth Fly ────────────────────────────────────
function CameraFly({ target, dist }: { target: THREE.Vector3; dist: number }) {
  const { camera } = useThree();
  const ready = useRef(false);

  useFrame(() => {
    const offset = new THREE.Vector3(dist * 0.55, dist * 0.4, dist * 0.55);
    const goal = target.clone().add(offset);

    if (!ready.current) {
      camera.position.copy(goal);
      camera.lookAt(target);
      ready.current = true;
      return;
    }
    camera.position.lerp(goal, 0.035);
  });

  return null;
}

// ─── Calculate building footprint (must match HolographicBuilding logic) ───
function getBuildingSize(w: WarehouseOverview): { W: number; D: number } {
  const rackCols = Math.max(Math.ceil(Math.sqrt(w.rackCount * 1.4)), 1);
  const rackRows = Math.max(Math.ceil(w.rackCount / rackCols), 1);
  const spacing = 1.8;
  const gridW = (rackCols - 1) * spacing;
  const gridD = (rackRows - 1) * spacing;
  const pad = 2.0;
  return {
    W: Math.max(gridW + pad * 2, 4),
    D: Math.max(gridD + pad * 2, 4),
  };
}

// ─── 3D Scene ─────────────────────────────────────────────
function OverviewScene({
  warehouses,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onRackSelect,
}: {
  warehouses: WarehouseOverview[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onRackSelect: (rack: MiniRackData) => void;
}) {
  // Calculate building sizes and positions in a horizontal line with proper gaps
  const positions = useMemo(() => {
    const GAP = 4; // gap between buildings
    const sizes = warehouses.map(w => getBuildingSize(w));
    const result: [number, number, number][] = [];

    // Calculate total width
    let totalWidth = 0;
    for (let i = 0; i < sizes.length; i++) {
      totalWidth += sizes[i].W;
      if (i < sizes.length - 1) totalWidth += GAP;
    }

    // Place buildings in a horizontal line, centered on origin
    let cursor = -totalWidth / 2;
    for (let i = 0; i < sizes.length; i++) {
      const x = cursor + sizes[i].W / 2;
      cursor += sizes[i].W + GAP;
      result.push([x, 0, 0]);
    }

    return result;
  }, [warehouses]);

  // Center of all buildings
  const sceneCenter = useMemo(() => {
    if (positions.length === 0) return new THREE.Vector3(0, 1, 4);
    const avgX = positions.reduce((s, p) => s + p[0], 0) / positions.length;
    return new THREE.Vector3(avgX, 1, 4);
  }, [positions]);

  const camTarget = useMemo(() => {
    if (selectedId) {
      const idx = warehouses.findIndex(w => w.id === selectedId);
      if (idx >= 0) {
        const p = positions[idx];
        return new THREE.Vector3(p[0], 1.8, p[2]);
      }
    }
    return sceneCenter;
  }, [selectedId, warehouses, positions, sceneCenter]);

  const camDist = selectedId ? 12 : Math.max(30, positions.length * 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrlRef = useRef<any>(null);

  useEffect(() => {
    if (ctrlRef.current) {
      ctrlRef.current.target.lerp(camTarget, 0.08);
      ctrlRef.current.update();
    }
  });

  return (
    <>
      {/* Lighting — richer ambient scene */}
      <ambientLight intensity={0.45} color="#c7d2fe" />
      <hemisphereLight color="#e0e7ff" groundColor="#1e1b4b" intensity={0.5} />
      <directionalLight position={[25, 30, 20]} intensity={0.8} color="#e0e7ff" />
      <directionalLight position={[-20, 22, -15]} intensity={0.35} color="#a5b4fc" />
      <directionalLight position={[0, 10, 30]} intensity={0.15} color="#22d3ee" />

      {/* Fog — softer, not pitch black */}
      <fog attach="fog" args={["#0c1029", 50, 130]} />

      <HoloFloor />
      <HoloParticles />
      <ScanLine />

      {/* Render each warehouse building */}
      {warehouses.map((w, i) => (
        <HolographicBuilding
          key={w.id}
          warehouse={w}
          position={positions[i] || [0, 0, 0]}
          isSelected={selectedId === w.id}
          isHovered={hoveredId === w.id}
          onHover={(h) => onHover(h ? w.id : null)}
          onClick={() => onSelect(selectedId === w.id ? null : w.id)}
          onRackSelect={onRackSelect}
        />
      ))}

      <CameraFly target={camTarget} dist={camDist} />
      <OrbitControls
        ref={ctrlRef}
        target={camTarget}
        enablePan
        enableZoom
        minDistance={5}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate={!selectedId}
        autoRotateSpeed={0.2}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
      />
    </>
  );
}

// ─── Rack Detail Panel (HTML overlay) ─────────────────────
function RackDetailPanel({ rack, onClose }: { rack: MiniRackData; onClose: () => void }) {
  const allPositions = rack.rack_positions;
  const filled = allPositions.filter(p => p.su_code || p.status === "occupied");
  const total = rack.rows * rack.columns;
  const pct = total > 0 ? Math.round((filled.length / total) * 100) : 0;

  // Count statuses
  const statusCounts: Record<string, number> = {};
  for (const p of allPositions) {
    const st = p.status || "empty";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    occupied: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Ocupado" },
    empty: { bg: "bg-zinc-500/15", text: "text-zinc-500", label: "Vacío" },
    reserved: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Reservado" },
    expired: { bg: "bg-red-500/15", text: "text-red-400", label: "Vencido" },
    quarantine: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Cuarentena" },
    blocked: { bg: "bg-orange-500/15", text: "text-orange-400", label: "Bloqueado" },
    active: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Activo" },
  };

  const gridColors: Record<string, string> = {
    occupied: "#22c55e",
    active: "#22c55e",
    empty: "#27272a",
    reserved: "#3b82f6",
    expired: "#ef4444",
    quarantine: "#a855f7",
    blocked: "#f97316",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="absolute top-4 right-4 w-[310px] max-h-[calc(100%-32px)] bg-[#0a0d1e]/95 backdrop-blur-2xl border border-indigo-500/20 rounded-2xl shadow-2xl shadow-indigo-500/10 z-30 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Box size={14} className="text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white font-mono">{rack.code}</span>
            <p className="text-[9px] text-indigo-300/50">{rack.rows}×{rack.columns} posiciones</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
          <XIcon size={14} />
        </button>
      </div>

      {/* KPIs */}
      <div className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-white/3 px-2 py-2 text-center">
            <p className={cn("text-lg font-black tabular-nums leading-none", pct > 85 ? "text-red-400" : pct > 60 ? "text-amber-400" : "text-emerald-400")}>{pct}%</p>
            <p className="text-[7px] text-zinc-500 mt-1 uppercase tracking-widest">Ocupación</p>
          </div>
          <div className="rounded-lg bg-white/3 px-2 py-2 text-center">
            <p className="text-lg font-black tabular-nums leading-none text-cyan-400">{filled.length}</p>
            <p className="text-[7px] text-zinc-500 mt-1 uppercase tracking-widest">Ocupadas</p>
          </div>
          <div className="rounded-lg bg-white/3 px-2 py-2 text-center">
            <p className="text-lg font-black tabular-nums leading-none text-zinc-400">{total - filled.length}</p>
            <p className="text-[7px] text-zinc-500 mt-1 uppercase tracking-widest">Vacías</p>
          </div>
        </div>

        {/* Occupancy bar */}
        <div className="mt-2 h-1 rounded-full bg-zinc-800/50 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(statusCounts)
            .filter(([k]) => k !== "empty")
            .map(([status, count]) => {
              const cfg = statusColors[status] || statusColors.occupied;
              return (
                <span key={status} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-semibold", cfg.bg, cfg.text)}>
                  {cfg.label}: {count}
                </span>
              );
            })}
        </div>
      </div>

      {/* Visual grid map */}
      <div className="px-4 py-2">
        <p className="text-[8px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">Mapa de posiciones</p>
        <div
          className="grid gap-[2px] rounded-lg overflow-hidden p-1.5 bg-white/2"
          style={{ gridTemplateColumns: `repeat(${rack.columns}, 1fr)` }}
        >
          {Array.from({ length: rack.rows * rack.columns }, (_, idx) => {
            const row = Math.floor(idx / rack.columns) + 1;
            const col = (idx % rack.columns) + 1;
            const pos = allPositions.find(p => p.row_number === row && p.column_number === col);
            const status = pos?.status || "empty";
            return (
              <div
                key={idx}
                className="aspect-square rounded-[2px] transition-colors"
                style={{ backgroundColor: gridColors[status] || "#27272a", opacity: status === "empty" ? 0.3 : 0.8 }}
                title={`F${row} C${col}: ${statusColors[status]?.label || status}`}
              />
            );
          })}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1.5 border-t border-white/5 pt-2">
        <p className="text-[8px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1">
          Inventario · {filled.length} item{filled.length !== 1 ? "s" : ""}
        </p>
        {filled.length === 0 && (
          <div className="flex flex-col items-center py-6 text-zinc-600">
            <Package size={20} className="mb-2 opacity-30" />
            <p className="text-[10px]">Sin inventario en este rack</p>
          </div>
        )}
        {filled.map((p) => {
          const st = p.status || "occupied";
          const stCfg = statusColors[st] || statusColors.occupied;
          return (
            <div key={p.id} className="rounded-xl bg-white/3 border border-white/4 px-3 py-2.5 hover:bg-indigo-500/5 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("inline-flex items-center rounded px-1 py-0.5 text-[7px] font-bold uppercase", stCfg.bg, stCfg.text)}>
                    {stCfg.label}
                  </span>
                  {p.su_code && (
                    <span className="text-[9px] font-mono text-cyan-400 font-medium">{p.su_code}</span>
                  )}
                </div>
                {p.su_quantity != null && (
                  <span className="text-[10px] text-emerald-400 font-bold tabular-nums">{p.su_quantity} UN</span>
                )}
              </div>
              {p.product_name && (
                <p className="text-[10px] text-white/80 truncate leading-snug">{p.product_name}</p>
              )}
              {!p.product_name && !p.su_code && (
                <p className="text-[10px] text-white/40 italic">Posición ocupada (sin detalle)</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[8px] text-zinc-500 font-mono">F{p.row_number} C{p.column_number}</span>
                {p.product_sku && <span className="text-[8px] text-zinc-400 font-mono">{p.product_sku}</span>}
                {p.lot_number && <span className="text-[8px] text-amber-500/60 font-mono">Lote: {p.lot_number}</span>}
                {p.su_type && <span className="text-[8px] text-indigo-400/50 font-mono">{p.su_type}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Warehouse Detail Panel (HTML overlay) ────────────────
function WarehouseDetailPanel({
  warehouse,
  onClose,
  onSelectRack,
}: {
  warehouse: WarehouseOverview;
  onClose: () => void;
  onSelectRack: (r: MiniRackData) => void;
}) {
  const palette = HOLO_COLORS[warehouse.type] || HOLO_COLORS.standard;
  const occPct = warehouse.occupancy;
  const occClass = occPct > 85 ? "text-red-400" : occPct > 60 ? "text-amber-400" : "text-emerald-400";
  const occBar = occPct > 85 ? "bg-red-500" : occPct > 60 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="absolute top-4 left-4 w-[270px] max-h-[calc(100%-32px)] bg-[#0a0d1e]/95 backdrop-blur-2xl border border-indigo-500/20 rounded-2xl shadow-2xl shadow-indigo-500/10 z-30 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: palette.glow, boxShadow: `0 0 8px ${palette.glow}60` }} />
            <h3 className="text-sm font-bold text-white tracking-tight">{warehouse.name}</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
            <XIcon size={12} />
          </button>
        </div>
        {warehouse.location && (
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 mb-3">
            <MapPin size={9} className="text-zinc-500" /> {warehouse.location}
          </div>
        )}
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Ocupación", value: `${occPct}%`, cls: occClass },
            { label: "Racks", value: warehouse.rackCount, cls: "text-indigo-400" },
            { label: "Posiciones", value: warehouse.totalPositions, cls: "text-cyan-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-white/3 px-2 py-2 text-center">
              <p className={cn("text-base font-black tabular-nums leading-none", kpi.cls)}>{kpi.value}</p>
              <p className="text-[7px] text-zinc-500 mt-1 uppercase tracking-widest">{kpi.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 h-1 rounded-full bg-zinc-800/50 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", occBar)} style={{ width: `${occPct}%` }} />
        </div>
      </div>

      {/* Rack list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <p className="text-[8px] font-semibold text-zinc-500 uppercase tracking-[0.15em] px-1 mb-2">Racks</p>
        {warehouse.racks.map((r) => {
          const occ = r.rows * r.columns > 0 ? Math.round((r.rack_positions.filter(p => p.su_code).length / (r.rows * r.columns)) * 100) : 0;
          return (
            <button
              key={r.id}
              onClick={() => onSelectRack(r)}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2 hover:bg-indigo-500/8 transition-all text-left group"
            >
              <div className="flex items-center gap-2">
                <Layers size={10} className="text-indigo-500/60" />
                <span className="text-[10px] font-mono font-bold text-indigo-200">{r.code}</span>
                <span className="text-[8px] text-zinc-600">{r.rows}×{r.columns}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", occ > 85 ? "bg-red-500" : occ > 60 ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${occ}%` }}
                  />
                </div>
                <span className="text-[8px] text-zinc-500 tabular-nums w-6 text-right">{occ}%</span>
                <ChevronRight size={10} className="text-zinc-700 group-hover:text-indigo-400 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Smart Search Overlay ─────────────────────────────────
type SearchResult = {
  type: "warehouse" | "rack" | "product" | "lot" | "unit";
  label: string;
  sub: string;
  warehouseId: string;
  rack?: MiniRackData;
};

function SmartSearch3D({
  warehouses,
  onSelectWarehouse,
  onSelectRack,
}: {
  warehouses: WarehouseOverview[];
  onSelectWarehouse: (id: string) => void;
  onSelectRack: (rack: MiniRackData, warehouseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Build flat index of all searchable items
  const allItems = useMemo((): SearchResult[] => {
    const items: SearchResult[] = [];
    for (const w of warehouses) {
      items.push({ type: "warehouse", label: w.name, sub: `${w.type} · ${w.rackCount} racks`, warehouseId: w.id });
      for (const r of w.racks) {
        items.push({ type: "rack", label: r.code, sub: `${w.name} · ${r.rows}×${r.columns}`, warehouseId: w.id, rack: r });
        for (const p of r.rack_positions) {
          if (p.product_name) {
            items.push({ type: "product", label: p.product_name, sub: `${p.product_sku || ""} · ${r.code} · F${p.row_number}C${p.column_number}`, warehouseId: w.id, rack: r });
          }
          if (p.lot_number) {
            items.push({ type: "lot", label: p.lot_number, sub: `${p.product_name || r.code} · F${p.row_number}C${p.column_number}`, warehouseId: w.id, rack: r });
          }
          if (p.su_code) {
            items.push({ type: "unit", label: p.su_code, sub: `${p.su_type || "SU"} · ${p.product_name || ""} · ${r.code}`, warehouseId: w.id, rack: r });
          }
        }
      }
    }
    return items;
  }, [warehouses]);

  // Filter + deduplicate
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    return allItems
      .filter(item => {
        const match = item.label.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q);
        if (!match) return false;
        const key = `${item.type}:${item.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [allItems, query]);

  // Auto-focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const typeConfig: Record<string, { icon: typeof Warehouse; color: string; label: string }> = {
    warehouse: { icon: Warehouse, color: "text-indigo-400", label: "Almacén" },
    rack: { icon: Layers, color: "text-blue-400", label: "Rack" },
    product: { icon: Package, color: "text-emerald-400", label: "Producto" },
    lot: { icon: Box, color: "text-amber-400", label: "Lote" },
    unit: { icon: Box, color: "text-cyan-400", label: "Unidad" },
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a0d1e]/75 backdrop-blur-2xl border border-white/6 text-zinc-400 hover:text-white hover:border-indigo-500/30 transition-all group"
      >
        <Search size={12} className="text-indigo-400" />
        <span className="text-[9px] font-medium hidden sm:inline">Buscar</span>
        <kbd className="hidden sm:inline text-[8px] text-zinc-600 bg-white/5 rounded px-1 py-0.5 font-mono">⌘K</kbd>
      </button>

      {/* Search modal overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-start justify-center pt-[12%]"
            onClick={() => setOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Search panel */}
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[380px] max-w-[90vw] bg-[#0a0d1e]/98 backdrop-blur-3xl border border-indigo-500/20 rounded-2xl shadow-2xl shadow-indigo-900/30 overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
                <Search size={14} className="text-indigo-400 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar almacén, rack, producto, lote, unidad..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-zinc-500 hover:text-white">
                    <XIcon size={12} />
                  </button>
                )}
                <kbd className="text-[8px] text-zinc-600 bg-white/5 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-[320px] overflow-y-auto">
                {query.trim() && results.length === 0 && (
                  <div className="flex flex-col items-center py-8 text-zinc-600">
                    <Search size={20} className="mb-2 opacity-30" />
                    <p className="text-[10px]">Sin resultados para &quot;{query}&quot;</p>
                  </div>
                )}

                {!query.trim() && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[10px] text-zinc-500">Escribe para buscar por nombre, código, SKU, lote...</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                      {Object.entries(typeConfig).map(([key, cfg]) => (
                        <span key={key} className={cn("inline-flex items-center gap-1 rounded-md bg-white/3 px-2 py-1 text-[8px] font-medium", cfg.color)}>
                          <cfg.icon size={8} /> {cfg.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {results.map((item, i) => {
                  const cfg = typeConfig[item.type] || typeConfig.rack;
                  return (
                    <button
                      key={`${item.type}-${item.label}-${i}`}
                      onClick={() => {
                        onSelectWarehouse(item.warehouseId);
                        if (item.rack) {
                          setTimeout(() => onSelectRack(item.rack!, item.warehouseId), 50);
                        }
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-500/8 transition-colors text-left group"
                    >
                      <div className={cn("w-7 h-7 rounded-lg bg-white/3 flex items-center justify-center shrink-0", cfg.color)}>
                        <cfg.icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[7px] font-bold uppercase rounded px-1 py-0.5 bg-white/3", cfg.color)}>{cfg.label}</span>
                          <span className="text-[10px] font-semibold text-white truncate">{item.label}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 truncate mt-0.5">{item.sub}</p>
                      </div>
                      <ChevronRight size={10} className="text-zinc-700 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-4 py-2 border-t border-white/5 text-center">
                  <p className="text-[8px] text-zinc-600">{results.length} resultado{results.length !== 1 ? "s" : ""}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── HUD Stats Overlay ────────────────────────────────────
function HudStats({ warehouses }: { warehouses: WarehouseOverview[] }) {
  const totR = warehouses.reduce((s, w) => s + w.rackCount, 0);
  const totP = warehouses.reduce((s, w) => s + w.totalPositions, 0);
  const totO = warehouses.reduce((s, w) => s + w.occupiedPositions, 0);
  const avgOcc = totP > 0 ? Math.round((totO / totP) * 100) : 0;
  const occCls = avgOcc > 85 ? "text-red-400" : avgOcc > 60 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-[#0a0d1e]/75 backdrop-blur-2xl border border-white/6 shadow-xl">
      {[
        { icon: Warehouse, value: warehouses.length, label: "almacenes", cls: "text-indigo-400" },
        { icon: Layers, value: totR, label: "racks", cls: "text-blue-400" },
        { icon: Box, value: totP.toLocaleString(), label: "posiciones", cls: "text-cyan-400" },
        { icon: Activity, value: `${avgOcc}%`, label: "ocupación", cls: occCls },
      ].map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <div className="w-px h-4 bg-white/6" />}
          <div className="flex items-center gap-1.5">
            <s.icon size={11} className={s.cls} />
            <span className={cn("text-[10px] font-bold tabular-nums", s.cls)}>{s.value}</span>
            <span className="text-[9px] text-zinc-500">{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function WarehouseOverview3D({ initialSelectedId }: { initialSelectedId?: string | null } = {}) {
  const [warehouses, setWarehouses] = useState<WarehouseOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedRack, setSelectedRack] = useState<MiniRackData | null>(null);

  // Sync external initialSelectedId changes
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setSelectedRack(null);
    }
  }, [initialSelectedId]);

  useEffect(() => {
    fetchAllWarehousesOverview()
      .then((data) => {
        console.log("[WarehouseOverview3D] Loaded", data.length, "warehouses");
        setWarehouses(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[WarehouseOverview3D] Fetch error:", err);
        setError(err?.message || "Error al cargar almacenes");
        setLoading(false);
      });
  }, []);

  const selected = useMemo(
    () => warehouses.find(w => w.id === selectedId) || null,
    [warehouses, selectedId]
  );

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-140px)] rounded-2xl bg-[#060914] border border-indigo-500/10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
            <div className="absolute inset-1 border-2 border-transparent border-b-cyan-400/30 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "2s" }} />
            <div className="absolute inset-3 border border-indigo-400/10 rounded-full" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-indigo-300/80 tracking-wide">Inicializando Vista Holográfica</p>
            <p className="text-[10px] text-zinc-600 mt-1">Cargando almacenes y topología de racks...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || warehouses.length === 0) {
    return (
      <div className="w-full h-[300px] rounded-2xl bg-[#060914] border border-indigo-500/10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Warehouse size={32} className="text-indigo-500/30" />
          <p className="text-sm text-indigo-300/60">{error || "No se encontraron almacenes"}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchAllWarehousesOverview().then(d => { setWarehouses(d); setLoading(false); }).catch(e => { setError(e?.message); setLoading(false); }); }}
            className="text-xs text-brand hover:text-brand-light transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] rounded-2xl bg-[#0c1029] border border-indigo-500/10 overflow-hidden shadow-2xl shadow-indigo-900/20">
      {/* WebGL Canvas */}
      <Canvas
        camera={{ position: [24, 18, 24], fov: 42, near: 0.1, far: 250 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false, depth: true }}
        shadows={false}
        onCreated={({ gl: renderer }) => {
          console.log("[WarehouseOverview3D] Canvas created, renderer:", renderer.info.render);
        }}
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-[#0c1029]">
            <p className="text-xs text-indigo-400/50">WebGL no disponible</p>
          </div>
        }
      >
        <color attach="background" args={["#0c1029"]} />
        <Suspense fallback={null}>
          <OverviewScene
            warehouses={warehouses}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={(id) => { setSelectedId(id); setSelectedRack(null); }}
            onHover={setHoveredId}
            onRackSelect={setSelectedRack}
          />
        </Suspense>
      </Canvas>

      {/* Vignette — softer */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 60%, rgba(12,16,41,0.6) 100%)"
      }} />

      {/* Top HUD */}
      <HudStats warehouses={warehouses} />

      {/* Smart Search */}
      <SmartSearch3D
        warehouses={warehouses}
        onSelectWarehouse={(id) => { setSelectedId(id); setSelectedRack(null); }}
        onSelectRack={(rack) => setSelectedRack(rack)}
      />

      {/* Bottom warehouse nav */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#0a0d1e]/75 backdrop-blur-2xl border border-white/6">
        {warehouses.map((w) => {
          const p = HOLO_COLORS[w.type] || HOLO_COLORS.standard;
          const active = selectedId === w.id;
          return (
            <button
              key={w.id}
              onClick={() => { setSelectedId(active ? null : w.id); setSelectedRack(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-medium transition-all",
                active ? "text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/3"
              )}
              style={active ? {
                backgroundColor: p.base + "20",
                border: `1px solid ${p.base}40`,
                boxShadow: `0 0 12px ${p.base}15`,
              } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full transition-colors" style={{ backgroundColor: active ? p.glow : "#3f3f46" }} />
              {w.name.length > 16 ? w.name.slice(0, 16) + "…" : w.name}
            </button>
          );
        })}
      </div>

      {/* Detail Panels */}
      <AnimatePresence>
        {selected && !selectedRack && (
          <WarehouseDetailPanel
            key="whp"
            warehouse={selected}
            onClose={() => setSelectedId(null)}
            onSelectRack={setSelectedRack}
          />
        )}
        {selectedRack && (
          <RackDetailPanel
            key="rkp"
            rack={selectedRack}
            onClose={() => setSelectedRack(null)}
          />
        )}
      </AnimatePresence>

      {/* Help text */}
      {!selectedId && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 text-[9px] text-zinc-600 font-medium tracking-wide">
          Selecciona un almacén · Arrastra para rotar · Scroll para zoom
        </div>
      )}
    </div>
  );
}
