"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Line, OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Warehouse, MapPin, Box, X as XIcon, Layers, ChevronRight, Package, Activity, Search, Hash, Tag, Maximize, Minimize, Camera, RotateCcw, Eye, Ruler, Gauge, Grid3X3, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils/cn";
import { fetchAllWarehousesOverview } from "../actions/stock-hierarchy-actions";
import type { WarehouseOverview, MiniRack as MiniRackData, MiniRackPosition } from "../actions/stock-hierarchy-actions";

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




// ─── Grid Floor — Concrete Texture ─────────────────────────────
const ConcreteFloor = memo(function ConcreteFloor({ isDark = true, showGrid = true }: { isDark?: boolean; showGrid?: boolean }) {
  const rawTexture = useTexture("/textures/concrete-floor.png");
  
  // Clone and configure tiling (avoid mutating hook return value)
  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20);
    t.anisotropy = 16;
    t.needsUpdate = true;
    return t;
  }, [rawTexture]);

  return (
    <group>
      {/* Main textured floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          map={texture}
          color={isDark ? "#3a3e50" : "#d0d4de"}
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>
      {/* Subtle grid lines — warehouse floor markings */}
      {showGrid && <gridHelper args={[200, 100, isDark ? "#1e2340" : "#b5b9c6", isDark ? "#151933" : "#c5c9d3"]} position={[0, 0, 0]} />}
      {/* Center accent glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshBasicMaterial color={isDark ? "#4f46e5" : "#818cf8"} transparent opacity={isDark ? 0.015 : 0.025} depthWrite={false} />
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
const RackUnit = memo(function RackUnit({ rack, pos, tint, isHovered, onHover, onClick, onBoxClick }: {
  rack: MiniRackData;
  pos: [number, number, number];
  tint: number;
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
  onBoxClick?: (position: MiniRackPosition, rackCode: string) => void;
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

      {/* Inventory boxes — one per occupied position — CLICKABLE */}
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
          <mesh
            key={p.id}
            position={[cx, cy, 0]}
            onClick={(e) => { e.stopPropagation(); onBoxClick?.(p, rack.code); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}
          >
            <boxGeometry args={[boxW, boxH, boxD]} />
            <meshStandardMaterial
              color={boxColor}
              transparent
              opacity={isHovered ? 0.9 : 0.7}
              emissive={boxColor}
              emissiveIntensity={isHovered ? 0.15 : 0.05}
              roughness={0.6}
              metalness={0.1}
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
  onBoxClick,
}: {
  warehouse: WarehouseOverview;
  position: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
  onRackSelect: (rack: MiniRackData) => void;
  onBoxClick?: (position: MiniRackPosition, rackCode: string) => void;
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

      {/* ── Selection glow — unmistakable highlight when selected ── */}
      {isSelected && (
        <>
          {/* Point light fills the area with the warehouse's color */}
          <pointLight
            position={[0, H * 0.6, 0]}
            color={palette.glow}
            intensity={3}
            distance={W + D}
            decay={2}
          />
          {/* Bright floor highlight beam */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[W + 0.6, D + 0.6]} />
            <meshBasicMaterial
              color={palette.glow}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

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
          onBoxClick={onBoxClick}
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
  onBoxClick,
  focusedRack,
  isDark = true,
  showGrid = true,
}: {
  warehouses: WarehouseOverview[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onRackSelect: (rack: MiniRackData) => void;
  onBoxClick?: (position: MiniRackPosition, rackCode: string) => void;
  focusedRack?: MiniRackData | null;
  isDark?: boolean;
  showGrid?: boolean;
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

  // Compute rack-level camera if a rack is focused
  const rackWorldPos = useMemo(() => {
    if (!focusedRack || !selectedId) return null;
    const wIdx = warehouses.findIndex(w => w.id === selectedId);
    if (wIdx < 0) return null;
    const w = warehouses[wIdx];
    const bPos = positions[wIdx];
    const rIdx = w.racks.findIndex(r => r.id === focusedRack.id);
    if (rIdx < 0) return null;

    const rackCols = Math.max(Math.ceil(Math.sqrt(w.rackCount * 1.4)), 1);
    const spacing = 1.8;
    const gridW = (rackCols - 1) * spacing;
    const rackRows = Math.max(Math.ceil(w.rackCount / rackCols), 1);
    const gridD = (rackRows - 1) * spacing;
    const c = rIdx % rackCols;
    const r = Math.floor(rIdx / rackCols);
    const rx = -gridW / 2 + c * spacing + bPos[0];
    const rz = -gridD / 2 + r * spacing + bPos[2];
    return new THREE.Vector3(rx, 1.2, rz);
  }, [focusedRack, selectedId, warehouses, positions]);

  const camTarget = useMemo(() => {
    if (rackWorldPos) return rackWorldPos;
    if (selectedId) {
      const idx = warehouses.findIndex(w => w.id === selectedId);
      if (idx >= 0) {
        const p = positions[idx];
        return new THREE.Vector3(p[0], 1.8, p[2]);
      }
    }
    return sceneCenter;
  }, [rackWorldPos, selectedId, warehouses, positions, sceneCenter]);

  const camDist = rackWorldPos ? 4 : selectedId ? 12 : Math.max(30, positions.length * 8);

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
      {/* Lighting */}
      <ambientLight intensity={isDark ? 0.45 : 0.7} color={isDark ? "#c7d2fe" : "#f5f5ff"} />
      <hemisphereLight color={isDark ? "#e0e7ff" : "#f8fafc"} groundColor={isDark ? "#1e1b4b" : "#cbd5e1"} intensity={isDark ? 0.5 : 0.6} />
      <directionalLight position={[25, 30, 20]} intensity={isDark ? 0.8 : 1.2} color={isDark ? "#e0e7ff" : "#f5f5ff"} />
      <directionalLight position={[-20, 22, -15]} intensity={isDark ? 0.35 : 0.5} color={isDark ? "#a5b4fc" : "#c7d2fe"} />
      <directionalLight position={[0, 10, 30]} intensity={isDark ? 0.15 : 0.3} color={isDark ? "#22d3ee" : "#67e8f9"} />

      {/* Fog */}
      <fog attach="fog" args={[isDark ? "#0c1029" : "#f0f2f7", 50, 130]} />

      <ConcreteFloor isDark={isDark} showGrid={showGrid} />
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
          onBoxClick={onBoxClick}
        />
      ))}

      <CameraFly target={camTarget} dist={camDist} />
      <OrbitControls
        ref={ctrlRef}
        target={camTarget}
        enablePan
        enableZoom
        minDistance={2}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate={!selectedId && !focusedRack}
        autoRotateSpeed={0.2}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
      />
    </>
  );
}

function RackDetailPanel({ rack, onClose, initialPosition }: { rack: MiniRackData; onClose: () => void; initialPosition?: MiniRackPosition | null }) {
  const [selectedPos, setSelectedPos] = useState<MiniRackPosition | null>(initialPosition || null);
  const allPositions = rack.rack_positions;
  const filled = allPositions.filter(p => p.su_code || p.status === "occupied");
  const total = rack.rows * rack.columns;
  const pct = total > 0 ? Math.round((filled.length / total) * 100) : 0;

  const statusConfig: Record<string, { color: string; bg: string; text: string; label: string }> = {
    occupied: { color: "#22c55e", bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Ocupado" },
    active:   { color: "#22c55e", bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Activo" },
    empty:    { color: "#27272a", bg: "bg-zinc-500/15",    text: "text-zinc-500",    label: "Vacío" },
    reserved: { color: "#3b82f6", bg: "bg-blue-500/15",    text: "text-blue-400",    label: "Reservado" },
    expired:  { color: "#ef4444", bg: "bg-red-500/15",     text: "text-red-400",     label: "Vencido" },
    quarantine:{ color: "#a855f7", bg: "bg-purple-500/15", text: "text-purple-400",  label: "Cuarentena" },
    blocked:  { color: "#f97316", bg: "bg-orange-500/15",  text: "text-orange-400",  label: "Bloqueado" },
  };

  // Count statuses for legend
  const statusCounts: Record<string, number> = {};
  for (const p of allPositions) {
    const st = p.status || "empty";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  // Build position lookup for fast access
  const posMap = useMemo(() => {
    const map = new Map<string, MiniRackPosition>();
    for (const p of allPositions) {
      map.set(`${p.row_number}-${p.column_number}`, p);
    }
    return map;
  }, [allPositions]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="absolute top-4 right-4 w-[340px] max-h-[calc(100%-32px)] bg-[#0a0d1e]/95 backdrop-blur-2xl border border-indigo-500/20 rounded-2xl shadow-2xl shadow-indigo-500/10 z-30 flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Layers size={16} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-mono tracking-tight">{rack.code}</h3>
            <p className="text-[9px] text-indigo-300/50 mt-0.5">{rack.rows} filas × {rack.columns} columnas · {total} posiciones</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
          <XIcon size={14} />
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="px-4 pt-3 pb-2 shrink-0">
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
        <div className="mt-2 h-1 rounded-full bg-zinc-800/50 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Grid Map with Axis Labels ── */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[8px] font-semibold text-zinc-500 uppercase tracking-[0.15em]">Mapa del Rack</p>
            <p className="text-[8px] text-indigo-400/70 font-medium">Selecciona una posición</p>
          </div>

          {/* Grid with row numbers on left and column numbers on top */}
          <div className="rounded-xl bg-white/2 border border-white/5 p-2">
            {/* Column headers */}
            <div className="flex mb-1" style={{ paddingLeft: 20 }}>
              {Array.from({ length: rack.columns }, (_, c) => (
                <div
                  key={`col-${c}`}
                  className="text-center text-[7px] font-bold text-indigo-400/60 tabular-nums"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  C{c + 1}
                </div>
              ))}
            </div>

            {/* Rows with labels */}
            <div className="flex flex-col gap-[3px]">
              {Array.from({ length: rack.rows }, (_, r) => {
                const row = r + 1;
                return (
                  <div key={`row-${r}`} className="flex items-center gap-[3px]">
                    {/* Row label */}
                    <div className="w-[17px] shrink-0 text-right text-[7px] font-bold text-indigo-400/60 tabular-nums pr-1">
                      F{row}
                    </div>
                    {/* Cells */}
                    {Array.from({ length: rack.columns }, (_, c) => {
                      const col = c + 1;
                      const pos = posMap.get(`${row}-${col}`);
                      const status = pos?.status || "empty";
                      const cfg = statusConfig[status] || statusConfig.empty;
                      const hasItem = pos?.su_code || status === "occupied" || status === "active";
                      const isActive = selectedPos?.id === pos?.id;

                      return (
                        <button
                          key={`${row}-${col}`}
                          onClick={() => { if (pos && hasItem) setSelectedPos(isActive ? null : pos); }}
                          disabled={!hasItem}
                          className={cn(
                            "flex-1 aspect-square rounded transition-all flex items-center justify-center relative",
                            hasItem && "cursor-pointer hover:scale-110 hover:z-10",
                            !hasItem && "cursor-default",
                            isActive && "ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#0a0d1e] scale-110 z-10"
                          )}
                          style={{
                            backgroundColor: cfg.color,
                            opacity: isActive ? 1 : status === "empty" ? 0.2 : 0.8,
                          }}
                          title={
                            hasItem
                              ? `${pos?.product_name || "Ocupado"} — F${row} C${col}${pos?.su_quantity != null ? ` · ${pos.su_quantity} UN` : ""}`
                              : `Vacío — F${row} C${col}`
                          }
                        >
                          {hasItem && (
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full transition-colors",
                              isActive ? "bg-white" : "bg-white/30"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Legend ── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {Object.entries(statusConfig)
              .filter(([key]) => key !== "active" && (statusCounts[key] || 0) > 0)
              .map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: cfg.color, opacity: key === "empty" ? 0.3 : 0.8 }} />
                  <span className="text-[7px] text-zinc-500">{cfg.label} ({statusCounts[key]})</span>
                </div>
              ))}
          </div>

          {/* ── Hint ── */}
          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
            <p className="text-[8px] text-indigo-300/60 leading-relaxed">
              Haz clic en una posición de color para ver el detalle del producto almacenado. Las posiciones grises están vacías.
            </p>
          </div>
        </div>

        {/* ── Selected Position Detail (inline, below grid) ── */}
        <AnimatePresence>
          {selectedPos && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-4 mt-2 mb-1 rounded-xl bg-indigo-500/5 border border-indigo-500/15 overflow-hidden">
                {/* Position Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-500/10">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: (statusConfig[selectedPos.status] || statusConfig.occupied).color }}
                    />
                    <span className="text-[10px] font-bold text-white">
                      F{selectedPos.row_number} C{selectedPos.column_number}
                    </span>
                    <span className={cn(
                      "text-[8px] font-bold uppercase rounded px-1.5 py-0.5",
                      (statusConfig[selectedPos.status] || statusConfig.occupied).bg,
                      (statusConfig[selectedPos.status] || statusConfig.occupied).text
                    )}>
                      {(statusConfig[selectedPos.status] || statusConfig.occupied).label}
                    </span>
                  </div>
                  {selectedPos.su_quantity != null && (
                    <span className="text-sm font-black tabular-nums text-emerald-400">{selectedPos.su_quantity} <span className="text-[8px] text-zinc-500 font-normal">UN</span></span>
                  )}
                </div>

                {/* Product detail fields */}
                {selectedPos.product_name ? (
                  <div className="px-3 py-1">
                    {[
                      { icon: Package, label: "Producto", value: selectedPos.product_name },
                      { icon: Hash, label: "SKU", value: selectedPos.product_sku },
                      { icon: Box, label: "Unidad Almacén", value: selectedPos.su_code },
                      { icon: Tag, label: "Lote", value: selectedPos.lot_number },
                      { icon: Layers, label: "Tipo UA", value: selectedPos.su_type },
                    ]
                      .filter(f => f.value)
                      .map(f => (
                        <div key={f.label} className="flex items-center gap-2 py-1.5 border-b border-white/3 last:border-0">
                          <f.icon size={10} className="shrink-0 text-indigo-400/50" />
                          <span className="text-[7px] font-semibold text-zinc-500 uppercase w-14 shrink-0">{f.label}</span>
                          <span className="text-[10px] font-medium text-white/85 truncate">{f.value}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-3">
                    <Package size={14} className="text-zinc-600" />
                    <div>
                      <p className="text-[10px] text-zinc-400">Posición ocupada</p>
                      <p className="text-[8px] text-zinc-600">Sin detalle de producto asignado</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Inventory List ── */}
        <div className="px-4 pb-3 pt-2 border-t border-white/5 mt-2">
          <p className="text-[8px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">
            Inventario · {filled.length} item{filled.length !== 1 ? "s" : ""}
          </p>
          {filled.length === 0 && (
            <div className="flex flex-col items-center py-5 text-zinc-600">
              <Package size={18} className="mb-2 opacity-30" />
              <p className="text-[10px]">Sin inventario en este rack</p>
            </div>
          )}
          <div className="space-y-1">
            {filled.map((p) => {
              const st = p.status || "occupied";
              const stCfg = statusConfig[st] || statusConfig.occupied;
              const isActive = selectedPos?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPos(isActive ? null : p)}
                  className={cn(
                    "w-full text-left rounded-lg px-2.5 py-2 transition-all group border",
                    isActive
                      ? "bg-indigo-500/10 border-indigo-500/20"
                      : "bg-white/2 border-white/3 hover:bg-indigo-500/5 hover:border-indigo-500/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: stCfg.color }} />
                      <span className="text-[9px] font-mono font-bold text-indigo-200 shrink-0">F{p.row_number}C{p.column_number}</span>
                      {p.product_name && (
                        <span className="text-[9px] text-white/70 truncate">{p.product_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.su_quantity != null && (
                        <span className="text-[9px] text-emerald-400 font-bold tabular-nums">{p.su_quantity}</span>
                      )}
                      <ChevronRight size={9} className={cn("transition-colors", isActive ? "text-indigo-400" : "text-zinc-700 group-hover:text-indigo-400")} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
  isDark = true,
  forceOpen = false,
}: {
  warehouses: WarehouseOverview[];
  onSelectWarehouse: (id: string) => void;
  onSelectRack: (rack: MiniRackData, warehouseId: string) => void;
  isDark?: boolean;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = open || forceOpen;
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

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

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
        className={cn(
          "absolute top-14 right-3 z-20 flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-2xl border transition-all group",
          isDark
            ? "bg-[#0a0d1e]/75 border-white/6 text-zinc-400 hover:text-white hover:border-indigo-500/30"
            : "bg-white/80 border-zinc-200/80 text-zinc-400 hover:text-zinc-700 hover:border-indigo-400/40 shadow-sm"
        )}
      >
        <Search size={12} className="text-indigo-400" />
        <span className="text-[9px] font-medium hidden sm:inline">Buscar</span>
        <kbd className="hidden sm:inline text-[8px] text-zinc-600 bg-white/5 rounded px-1 py-0.5 font-mono">⌘K</kbd>
      </button>

      {/* Search modal overlay */}
      <AnimatePresence>
        {isOpen && (
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
              className={cn(
                "relative w-[380px] max-w-[90vw] backdrop-blur-3xl border rounded-2xl shadow-2xl overflow-hidden",
                isDark
                  ? "bg-[#0a0d1e]/98 border-indigo-500/20 shadow-indigo-900/30"
                  : "bg-white/98 border-zinc-200 shadow-zinc-300/30"
              )}
            >
              {/* Search input */}
              <div className={cn("flex items-center gap-2.5 px-4 py-3 border-b", isDark ? "border-white/5" : "border-zinc-200")}>
                <Search size={14} className="text-indigo-400 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar almacén, rack, producto, lote, unidad..."
                  className={cn("flex-1 bg-transparent text-sm outline-none", isDark ? "text-white placeholder:text-zinc-600" : "text-zinc-900 placeholder:text-zinc-400")}
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

// ─── FPS Counter ─────────────────────────────────────────
function FpsCounter({ isDark }: { isDark: boolean }) {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    lastTime.current = performance.now();
    let raf: number;
    const loop = () => {
      frames.current++;
      const now = performance.now();
      if (now - lastTime.current >= 1000) {
        setFps(frames.current);
        frames.current = 0;
        lastTime.current = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const color = fps >= 50 ? "text-emerald-400" : fps >= 30 ? "text-amber-400" : "text-red-400";
  const bg = fps >= 50 ? "bg-emerald-500/15 border-emerald-500/20" : fps >= 30 ? "bg-amber-500/15 border-amber-500/20" : "bg-red-500/15 border-red-500/20";

  return (
    <div className={cn(
      "absolute top-14 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-2xl border",
      isDark ? bg : "bg-white/85 border-zinc-200/80"
    )}>
      <Gauge size={12} className={color} />
      <span className={cn("text-xs font-black tabular-nums", color)}>{fps}</span>
      <span className={cn("text-[8px]", isDark ? "text-zinc-500" : "text-zinc-400")}>FPS</span>
    </div>
  );
}

// ─── Guided Demo Overlay ─────────────────────────────────────
const DEMO_STEPS = [
  {
    id: "welcome",
    title: "🎬 Bienvenido al Tour 3D",
    desc: "Te mostraremos cómo funciona cada herramienta del almacén 3D. Observa cómo la escena se mueve automáticamente en cada paso.",
    action: "reset",
  },
  {
    id: "select",
    title: "📦 Seleccionar Almacén",
    desc: "Se ha seleccionado automáticamente un almacén. Observa cómo se ilumina y aparece un panel lateral con información detallada.",
    action: "select-warehouse",
  },
  {
    id: "rack",
    title: "🗄️ Explorar Rack",
    desc: "Se ha abierto un rack dentro del almacén. Puedes ver la cuadrícula de posiciones con colores según el estado: ocupado, reservado, vencido o vacío.",
    action: "select-rack",
  },
  {
    id: "box",
    title: "📋 Detalle de Material",
    desc: "Al hacer clic en una posición con producto, se despliega el detalle: nombre, SKU, lote y unidad de almacén. Prueba hacerlo tú después del tour.",
    action: "select-position",
  },
  {
    id: "search",
    title: "🔍 Búsqueda Inteligente",
    desc: "Se ha activado la búsqueda. Usa ⌘K en cualquier momento para buscar almacenes, racks, productos o SKUs. Escribe y selecciona para navegar.",
    action: "open-search",
  },
  {
    id: "fps",
    title: "⚡ Monitor de Rendimiento",
    desc: "Se ha activado el contador FPS. Este indicador te muestra los cuadros por segundo en tiempo real — verde (≥50), amarillo (≥30) o rojo (<30).",
    action: "toggle-fps",
  },
  {
    id: "grid",
    title: "🔳 Control de Cuadrícula",
    desc: "La cuadrícula del piso se ha desactivado para ver el concreto sin líneas. Puedes togglearla cuando necesites referencias de distancias.",
    action: "toggle-grid",
  },
  {
    id: "measure",
    title: "📏 Medición de Distancias",
    desc: "Se ha activado el modo de medición. Haz clic en dos puntos del almacén para calcular la distancia entre ellos. Ideal para planificación de layout.",
    action: "toggle-measure",
  },
  {
    id: "done",
    title: "✅ ¡Tour Completado!",
    desc: "Ahora conoces todas las herramientas. La vista se ha restablecido. Explora libremente: selecciona almacenes, inspecciona racks, y usa las herramientas.",
    action: "finish",
  },
];

type DemoAction =
  | { type: "reset" }
  | { type: "select-warehouse" }
  | { type: "select-rack" }
  | { type: "select-position" }
  | { type: "open-search" }
  | { type: "close-search" }
  | { type: "toggle-fps"; on: boolean }
  | { type: "toggle-grid"; on: boolean }
  | { type: "toggle-measure"; on: boolean }
  | { type: "finish" };

function GuidedDemoOverlay({
  isDark,
  onClose,
  onAction,
}: {
  isDark: boolean;
  onClose: () => void;
  onAction: (action: DemoAction) => void;
}) {
  const [step, setStep] = useState(0);
  const current = DEMO_STEPS[step];
  const isLast = step >= DEMO_STEPS.length - 1;

  // Execute action when step changes
  useEffect(() => {
    const s = DEMO_STEPS[step];
    switch (s.action) {
      case "reset":
        onAction({ type: "reset" });
        break;
      case "select-warehouse":
        onAction({ type: "select-warehouse" });
        break;
      case "select-rack":
        onAction({ type: "select-rack" });
        break;
      case "select-position":
        onAction({ type: "select-position" });
        break;
      case "open-search":
        onAction({ type: "open-search" });
        break;
      case "toggle-fps":
        onAction({ type: "toggle-fps", on: true });
        break;
      case "toggle-grid":
        onAction({ type: "toggle-grid", on: false });
        break;
      case "toggle-measure":
        onAction({ type: "toggle-measure", on: true });
        break;
      case "finish":
        onAction({ type: "finish" });
        break;
    }
    // Cleanup when leaving step
    return () => {
      switch (s.action) {
        case "open-search":
          onAction({ type: "close-search" });
          break;
        case "toggle-fps":
          onAction({ type: "toggle-fps", on: false });
          break;
        case "toggle-grid":
          onAction({ type: "toggle-grid", on: true });
          break;
        case "toggle-measure":
          onAction({ type: "toggle-measure", on: false });
          break;
      }
    };
  // eslint-disable-next-line react-compiler/react-compiler
  }, [step]);

  const handleClose = useCallback(() => {
    onAction({ type: "finish" });
    onClose();
  }, [onAction, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 pointer-events-none"
    >
      {/* Semi-transparent overlay — NOT blocking clicks on 3D behind */}
      <div className={cn("absolute inset-0", isDark ? "bg-black/30" : "bg-black/15")} />

      {/* Animated spotlight pulse indicator */}
      <motion.div
        key={`pulse-${step}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 1], opacity: [0, 0.6, 0] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-indigo-500/20 pointer-events-none"
      />

      {/* Card */}
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 30, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.12 }}
        className={cn(
          "absolute bottom-24 left-1/2 -translate-x-1/2 w-[440px] max-w-[92vw] pointer-events-auto rounded-2xl border backdrop-blur-3xl shadow-2xl overflow-hidden",
          isDark ? "bg-[#0c1029]/95 border-indigo-500/20 shadow-indigo-900/30" : "bg-white/95 border-zinc-200 shadow-zinc-300/30"
        )}
      >
        {/* Animated progress bar */}
        <div className={cn("h-1 w-full", isDark ? "bg-white/5" : "bg-zinc-100")}>
          <motion.div
            className="h-full bg-linear-to-r from-indigo-500 via-cyan-400 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / DEMO_STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest",
                isDark ? "text-indigo-400/60" : "text-indigo-500/60"
              )}>
                Demo Interactiva
              </span>
              <span className={cn(
                "text-[8px] font-bold rounded-full px-1.5 py-0.5",
                isDark ? "bg-indigo-500/15 text-indigo-400" : "bg-indigo-50 text-indigo-600"
              )}>
                {step + 1}/{DEMO_STEPS.length}
              </span>
            </div>
            <button
              onClick={handleClose}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                isDark ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              )}
            >
              <XIcon size={14} />
            </button>
          </div>

          {/* Step indicator — animated emoji */}
          <motion.h3
            key={`title-${step}`}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={cn("text-base font-bold mb-2", isDark ? "text-white" : "text-zinc-900")}
          >
            {current.title}
          </motion.h3>

          <motion.p
            key={`desc-${step}`}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={cn("text-[13px] leading-relaxed mb-5", isDark ? "text-zinc-400" : "text-zinc-500")}
          >
            {current.desc}
          </motion.p>

          {/* Action indicator */}
          {step > 0 && step < DEMO_STEPS.length - 1 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border",
                isDark ? "bg-emerald-500/8 border-emerald-500/15" : "bg-emerald-50 border-emerald-100"
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className={cn("text-[10px] font-semibold", isDark ? "text-emerald-400/80" : "text-emerald-600")}>
                Acción ejecutada automáticamente — observa los cambios en la escena
              </span>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                step === 0 ? "opacity-30 cursor-not-allowed" : "",
                isDark ? "text-zinc-400 hover:text-white hover:bg-white/5" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              )}
            >
              ← Anterior
            </button>

            <div className="flex gap-1.5">
              {DEMO_STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: i === step ? 1.4 : 1,
                    backgroundColor: i === step ? "#818cf8" : i < step ? "#818cf880" : (isDark ? "#ffffff15" : "#e5e7eb"),
                  }}
                  className="w-1.5 h-1.5 rounded-full"
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={handleClose}
                className="rounded-lg bg-linear-to-r from-emerald-500 to-cyan-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 active:scale-95"
              >
                ¡Listo! ✓
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-linear-to-r from-indigo-500 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 active:scale-95"
              >
                Siguiente →
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function WarehouseOverview3D({ initialSelectedId, singleWarehouseId }: { initialSelectedId?: string | null; singleWarehouseId?: string | null } = {}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const [warehouses, setWarehouses] = useState<WarehouseOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedRack, setSelectedRack] = useState<MiniRackData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFps, setShowFps] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showDemo, setShowDemo] = useState(false);
  const [demoSearchOpen, setDemoSearchOpen] = useState(false);
  const [distanceMeasuring, setDistanceMeasuring] = useState(false);
  const [clickedPosition, setClickedPosition] = useState<MiniRackPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetchAllWarehousesOverview()
      .then((data) => {
        setWarehouses(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Error al cargar almacenes");
        setLoading(false);
      });
  }, []);

  // When singleWarehouseId is provided, filter to only that warehouse
  const displayWarehouses = useMemo(() => {
    if (!singleWarehouseId) return warehouses;
    return warehouses.filter(w => w.id === singleWarehouseId);
  }, [warehouses, singleWarehouseId]);

  // Auto-select single warehouse when in focused mode
  const effectiveSelectedId = singleWarehouseId || selectedId;

  const selected = useMemo(
    () => displayWarehouses.find(w => w.id === effectiveSelectedId) || null,
    [displayWarehouses, effectiveSelectedId]
  );

  // ── Box Click: auto-select warehouse + rack when clicking a box in 3D
  const handleBoxClick = useCallback((position: MiniRackPosition, rackCode: string) => {
    for (const w of displayWarehouses) {
      const rack = w.racks.find(r => r.code === rackCode);
      if (rack) {
        setSelectedId(w.id);
        setSelectedRack(rack);
        setClickedPosition(position);
        break;
      }
    }
  }, [displayWarehouses]);

  // ── Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const h = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Screenshot
  const takeScreenshot = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `grixi-3d-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, []);

  // ── Reset
  const resetView = useCallback(() => {
    setSelectedId(null);
    setSelectedRack(null);
    setHoveredId(null);
  }, []);

  // ── Interactive Demo Actions
  const handleDemoAction = useCallback((action: DemoAction) => {
    switch (action.type) {
      case "reset":
      case "finish":
        setSelectedId(null);
        setSelectedRack(null);
        setHoveredId(null);
        setClickedPosition(null);
        setShowFps(false);
        setShowGrid(true);
        setDistanceMeasuring(false);
        setDemoSearchOpen(false);
        break;
      case "select-warehouse": {
        // Auto-select first warehouse
        const first = displayWarehouses[0];
        if (first) {
          setSelectedId(first.id);
          setSelectedRack(null);
          setClickedPosition(null);
        }
        break;
      }
      case "select-rack": {
        // Select first warehouse + its first rack
        const w = displayWarehouses[0];
        if (w && w.racks.length > 0) {
          setSelectedId(w.id);
          setSelectedRack(w.racks[0]);
          setClickedPosition(null);
        }
        break;
      }
      case "select-position": {
        // Select first warehouse + rack + first occupied position
        const w2 = displayWarehouses[0];
        if (w2 && w2.racks.length > 0) {
          const rack = w2.racks[0];
          setSelectedId(w2.id);
          setSelectedRack(rack);
          const occupied = rack.rack_positions.find(p => p.product_name);
          if (occupied) setClickedPosition(occupied);
        }
        break;
      }
      case "open-search":
        setDemoSearchOpen(true);
        break;
      case "close-search":
        setDemoSearchOpen(false);
        break;
      case "toggle-fps":
        setShowFps(action.on);
        break;
      case "toggle-grid":
        setShowGrid(action.on);
        break;
      case "toggle-measure":
        setDistanceMeasuring(action.on);
        break;
    }
  }, [displayWarehouses]);

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-220px)] min-h-[400px] rounded-2xl bg-[#060914] border border-indigo-500/10 flex items-center justify-center">
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

  // ── Theme tokens ──
  const bgBase = isDark ? "#0c1029" : "#f0f2f7";
  const borderClr = isDark ? "border-indigo-500/10" : "border-zinc-200";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden",
        isDark ? "shadow-2xl shadow-indigo-900/20" : "shadow-lg shadow-zinc-300/30",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none"
          : cn("h-[calc(100vh-220px)] min-h-[400px] rounded-2xl", borderClr, "border")
      )}
      style={{ backgroundColor: bgBase }}
    >
      {/* WebGL Canvas */}
      <Canvas
        camera={{ position: [24, 18, 24], fov: 42, near: 0.1, far: 250 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false, depth: true, preserveDrawingBuffer: true }}
        shadows={false}
        onCreated={({ gl: renderer }) => {
          canvasRef.current = renderer.domElement;
        }}
        fallback={
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgBase }}>
            <p className={cn("text-xs", isDark ? "text-indigo-400/50" : "text-zinc-400")}>WebGL no disponible</p>
          </div>
        }
      >
        <color attach="background" args={[bgBase]} />
        <Suspense fallback={null}>
          <OverviewScene
            warehouses={displayWarehouses}
            selectedId={effectiveSelectedId}
            hoveredId={hoveredId}
            onSelect={(id) => { setSelectedId(id); setSelectedRack(null); }}
            onHover={setHoveredId}
            onRackSelect={setSelectedRack}
            onBoxClick={handleBoxClick}
            focusedRack={selectedRack}
            isDark={isDark}
            showGrid={showGrid}
          />
        </Suspense>
      </Canvas>

      {/* Vignette */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 60%, rgba(12,16,41,0.6) 100%)"
        }} />
      )}

      {/* ── Top Bar: HUD left + Toolbar right ── */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-start justify-between pointer-events-none">
        {/* HUD Stats (left) */}
        <div className={cn(
          "pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-xl backdrop-blur-2xl border shadow-lg",
          isDark ? "bg-[#0a0d1e]/75 border-white/6 shadow-black/20" : "bg-white/80 border-zinc-200/80 shadow-zinc-200/40"
        )}>
          {[
            { icon: Warehouse, value: displayWarehouses.length, label: "almacenes", cls: isDark ? "text-indigo-400" : "text-indigo-600" },
            { icon: Layers, value: displayWarehouses.reduce((s, w) => s + w.rackCount, 0), label: "racks", cls: isDark ? "text-blue-400" : "text-blue-600" },
            { icon: Box, value: displayWarehouses.reduce((s, w) => s + w.totalPositions, 0).toLocaleString(), label: "posiciones", cls: isDark ? "text-cyan-400" : "text-cyan-600" },
            { icon: Activity, value: (() => { const tp = displayWarehouses.reduce((s, w) => s + w.totalPositions, 0); const to = displayWarehouses.reduce((s, w) => s + w.occupiedPositions, 0); return tp > 0 ? `${Math.round((to / tp) * 100)}%` : "0%"; })(), label: "ocupación", cls: (() => { const tp = displayWarehouses.reduce((s, w) => s + w.totalPositions, 0); const to = displayWarehouses.reduce((s, w) => s + w.occupiedPositions, 0); const avg = tp > 0 ? Math.round((to / tp) * 100) : 0; return avg > 85 ? (isDark ? "text-red-400" : "text-red-600") : avg > 60 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-emerald-400" : "text-emerald-600"); })() },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className={cn("w-px h-4", isDark ? "bg-white/6" : "bg-zinc-200")} />}
              <div className="flex items-center gap-1.5">
                <s.icon size={11} className={s.cls} />
                <span className={cn("text-[10px] font-bold tabular-nums", s.cls)}>{s.value}</span>
                <span className={cn("text-[9px]", isDark ? "text-zinc-500" : "text-zinc-400")}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Toolbar (right) */}
        <div className={cn(
          "pointer-events-auto flex items-center gap-0.5 px-1.5 py-1 rounded-xl backdrop-blur-2xl border shadow-lg",
          isDark ? "bg-[#0a0d1e]/85 border-white/6 shadow-black/20" : "bg-white/85 border-zinc-200/80 shadow-zinc-200/40"
        )}>
          <button onClick={resetView} title="Reset vista" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", isDark ? "text-zinc-500 hover:bg-white/5 hover:text-zinc-300" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600")}>
            <RotateCcw size={13} />
            <span className="text-[6px] font-semibold leading-none">Reset</span>
          </button>
          <div className={cn("w-px h-5", isDark ? "bg-white/6" : "bg-zinc-200")} />
          <button onClick={toggleFullscreen} title="Pantalla completa" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", isDark ? "text-zinc-500 hover:bg-indigo-500/15 hover:text-indigo-400" : "text-zinc-400 hover:bg-indigo-50 hover:text-indigo-600")}>
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
            <span className="text-[6px] font-semibold leading-none">{isFullscreen ? "Salir" : "Full"}</span>
          </button>
          <button onClick={takeScreenshot} title="Capturar pantalla" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", isDark ? "text-zinc-500 hover:bg-cyan-500/15 hover:text-cyan-400" : "text-zinc-400 hover:bg-cyan-50 hover:text-cyan-600")}>
            <Camera size={13} />
            <span className="text-[6px] font-semibold leading-none">Foto</span>
          </button>
          <div className={cn("w-px h-5", isDark ? "bg-white/6" : "bg-zinc-200")} />
          {/* Demo tutorial */}
          <button onClick={() => setShowDemo(true)} title="Tutorial interactivo" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", isDark ? "text-zinc-500 hover:bg-amber-500/15 hover:text-amber-400" : "text-zinc-400 hover:bg-amber-50 hover:text-amber-600")}>
            <Play size={13} />
            <span className="text-[6px] font-semibold leading-none">Demo</span>
          </button>
          <div className={cn("w-px h-5", isDark ? "bg-white/6" : "bg-zinc-200")} />
          {/* FPS Counter */}
          <button onClick={() => setShowFps(f => !f)} title="Rendimiento FPS" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", showFps ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/20" : isDark ? "text-zinc-500 hover:bg-emerald-500/15 hover:text-emerald-400" : "text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600")}>
            <Gauge size={13} />
            <span className="text-[6px] font-semibold leading-none">FPS</span>
          </button>
          {/* Grid toggle */}
          <button onClick={() => setShowGrid(g => !g)} title="Mostrar cuadrícula" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", showGrid ? (isDark ? "text-indigo-400" : "text-indigo-600") : (isDark ? "text-zinc-600" : "text-zinc-300"))}>
            <Grid3X3 size={13} />
            <span className="text-[6px] font-semibold leading-none">Grid</span>
          </button>
          {/* Ruler */}
          <button onClick={() => setDistanceMeasuring(d => !d)} title="Medir distancias" className={cn("flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg transition-all active:scale-95", distanceMeasuring ? "bg-red-500/20 text-red-400 border border-red-400/20" : isDark ? "text-zinc-500 hover:bg-red-500/15 hover:text-red-400" : "text-zinc-400 hover:bg-red-50 hover:text-red-600")}>
            <Ruler size={13} />
            <span className="text-[6px] font-semibold leading-none">Medir</span>
          </button>
          {selectedRack && (
            <>
              <div className={cn("w-px h-5", isDark ? "bg-white/6" : "bg-zinc-200")} />
              <button onClick={() => setSelectedRack(null)} title="Vista general" className="flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-400/20 transition-all active:scale-95">
                <Eye size={13} />
                <span className="text-[6px] font-semibold leading-none">Vista</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* FPS Counter overlay */}
      {showFps && <FpsCounter isDark={isDark} />}

      {/* Distance measuring HUD */}
      {distanceMeasuring && (
        <div className={cn(
          "absolute left-1/2 top-14 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-md border",
          isDark ? "bg-red-500/20 border-red-500/30" : "bg-red-50/90 border-red-200"
        )}>
          <Ruler size={12} className="text-red-400" />
          <span className={cn("text-[10px] font-semibold", isDark ? "text-red-300" : "text-red-600")}>Haz clic en 2 puntos para medir distancia</span>
          <button onClick={() => setDistanceMeasuring(false)} className={cn("rounded px-2 py-0.5 text-[8px] font-bold transition-colors", isDark ? "bg-white/10 text-red-300 hover:bg-white/20" : "bg-red-100 text-red-600 hover:bg-red-200")}>Cerrar</button>
        </div>
      )}

      <SmartSearch3D
        warehouses={displayWarehouses}
        onSelectWarehouse={(id) => { setSelectedId(id); setSelectedRack(null); }}
        onSelectRack={(rack) => setSelectedRack(rack)}
        isDark={isDark}
        forceOpen={demoSearchOpen}
      />

      {/* Guided Demo Overlay */}
      <AnimatePresence>
        {showDemo && (
          <GuidedDemoOverlay
            isDark={isDark}
            onClose={() => setShowDemo(false)}
            onAction={handleDemoAction}
          />
        )}
      </AnimatePresence>

      {/* Bottom warehouse nav — hidden in single warehouse mode */}
      {!singleWarehouseId && <div className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-2xl border",
        isDark ? "bg-[#0a0d1e]/75 border-white/6" : "bg-white/80 border-zinc-200/80 shadow-lg shadow-zinc-200/20"
      )}>
        {displayWarehouses.map((w) => {
          const p = HOLO_COLORS[w.type] || HOLO_COLORS.standard;
          const active = effectiveSelectedId === w.id;
          return (
            <button
              key={w.id}
              onClick={() => { setSelectedId(active ? null : w.id); setSelectedRack(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-medium transition-all",
                active
                  ? (isDark ? "text-white" : "text-zinc-900")
                  : (isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/3" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100")
              )}
              style={active ? {
                backgroundColor: p.base + (isDark ? "20" : "15"),
                border: `1px solid ${p.base}${isDark ? "40" : "30"}`,
                boxShadow: `0 0 12px ${p.base}15`,
              } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full transition-colors" style={{ backgroundColor: active ? p.glow : (isDark ? "#3f3f46" : "#d1d5db") }} />
              {w.name.length > 16 ? w.name.slice(0, 16) + "…" : w.name}
            </button>
          );
        })}
      </div>}

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
            key={`rkp-${selectedRack.code}`}
            rack={selectedRack}
            onClose={() => { setSelectedRack(null); setClickedPosition(null); }}
            initialPosition={clickedPosition}
          />
        )}
      </AnimatePresence>

      {/* Help text */}
      {!effectiveSelectedId && (
        <div className={cn("absolute bottom-16 left-1/2 -translate-x-1/2 z-10 text-[9px] font-medium tracking-wide", isDark ? "text-zinc-600" : "text-zinc-400")}>
          Selecciona un almacén · Arrastra para rotar · Scroll para zoom · Click en cajas para detalle · ⌘K buscar
        </div>
      )}
    </div>
  );
}
