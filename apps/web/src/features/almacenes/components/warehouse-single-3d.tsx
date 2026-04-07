"use client";

import React, { useState, useMemo, useRef, useCallback, memo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils/cn";

// ─── Color Palette ──────────────────────────────────────
const HOLO_COLORS: Record<string, { base: string; glow: string; edge: string; hex: number }> = {
  standard:      { base: "#4f46e5", glow: "#818cf8", edge: "#a5b4fc", hex: 0x6366f1 },
  cold_storage:  { base: "#0891b2", glow: "#22d3ee", edge: "#67e8f9", hex: 0x22d3ee },
  cross_docking: { base: "#d97706", glow: "#fbbf24", edge: "#fde68a", hex: 0xfbbf24 },
};

// ─── Types ──────────────────────────────────────────────
type Position = {
  id: string;
  row_number: number;
  column_number: number;
  status: string;
  max_weight: number;
  inventory: {
    id: string;
    product_name: string;
    product_sku: string;
    category: string;
    image_url: string | null;
    lot_number: string | null;
    batch_code: string | null;
    quantity: number;
    entry_date: string | null;
    expiry_date: string | null;
    supplier: string | null;
    status: string;
  } | null;
};

type Rack = {
  id: string;
  code: string;
  rack_type: string;
  rows: number;
  columns: number;
  aisle: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  dimensions: { width: number; height: number; depth: number };
  rack_positions: Position[];
};

type Warehouse = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  dimensions: { width: number; depth: number; height: number };
};

export type WarehouseSingle3DProps = {
  warehouse: Warehouse;
  racks: Rack[];
  onRackSelect: (rack: Rack) => void;
  selectedRackId?: string | null;
  className?: string;
};

// ─── Shared geometries ──────────────────────────────────
const RACK_GEO = {
  post: new THREE.BoxGeometry(0.04, 1, 0.04),
  shelf: new THREE.BoxGeometry(1, 0.015, 0.4),
  box: new THREE.BoxGeometry(0.2, 0.14, 0.25),
};

const BOX_COLORS: Record<string, number> = {
  occupied: 0x22c55e,
  active: 0x22c55e,
  expired: 0xef4444,
  quarantine: 0xa855f7,
  reserved: 0x3b82f6,
  blocked: 0xf97316,
};

// ─── Holographic Floor ──────────────────────────────────
const HoloFloor = memo(function HoloFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0e1225" roughness={0.92} metalness={0.05} />
      </mesh>
      <gridHelper args={[80, 40, "#1e2340", "#151933"]} />
      <gridHelper args={[80, 160, "#13172e", "#11152a"]} position={[0, 0.001, 0]} />
    </group>
  );
});

// ─── Scan Line ──────────────────────────────────────────
const ScanLine = memo(function ScanLine() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * 0.06) % 1;
    ref.current.position.z = -30 + t * 60;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(t * Math.PI) * 0.015;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <planeGeometry args={[80, 0.3]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={0.03} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
});

// ─── Particles ──────────────────────────────────────────
const Particles = memo(function Particles() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 200;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += 0.003;
      if (arr[i * 3 + 1] > 8) arr[i * 3 + 1] = 0;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.rotation.y = clock.elapsedTime * 0.005;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#6366f1" size={0.04} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
});

// ─── Single Rack 3D Component ───────────────────────────
const Rack3D = memo(function Rack3D({
  rack,
  pos,
  tint,
  isSelected,
  isHovered,
  onHover,
  onClick,
}: {
  rack: Rack;
  pos: [number, number, number];
  tint: number;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const cols = rack.columns;
  const rows = rack.rows;
  const colW = 0.28;
  const rowH = 0.35;
  const rW = cols * colW;
  const rH = rows * rowH + 0.1;
  const rD = 0.4;

  const total = rows * cols;
  const occupied = rack.rack_positions.filter(p => p.status === "occupied").length;
  const fillPct = total > 0 ? occupied / total : 0;
  const isActive = isSelected || isHovered;

  useFrame(() => {
    if (!ref.current) return;
    const target = isActive ? 1.06 : 1;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
  });

  const postColor = isActive ? 0xa5b4fc : 0x4338ca;
  const shelfColor = isActive ? 0xc7d2fe : 0x6366f1;

  return (
    <group
      ref={ref}
      position={pos}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Glow on floor */}
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <circleGeometry args={[Math.max(rW, rD) * 0.8, 32]} />
          <meshBasicMaterial color={isSelected ? "#a5b4fc" : "#818cf8"} transparent opacity={0.12} depthWrite={false} />
        </mesh>
      )}

      {/* Posts */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([xD, zD], i) => (
        <mesh key={`p${i}`} geometry={RACK_GEO.post} position={[xD * rW / 2, rH / 2, zD * rD / 2]} scale={[1, rH, 1]}>
          <meshStandardMaterial color={postColor} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Shelves */}
      {Array.from({ length: rows + 1 }, (_, i) => {
        const y = (i / rows) * rH;
        return (
          <mesh key={`sh${i}`} position={[0, y, 0]} scale={[rW * 0.98, 1, rD * 0.95]}>
            <boxGeometry args={[1, 0.012, 1]} />
            <meshStandardMaterial color={shelfColor} metalness={0.5} roughness={0.4} transparent opacity={0.6} />
          </mesh>
        );
      })}

      {/* Boxes */}
      {rack.rack_positions.map((p) => {
        if (p.status === "empty" && !p.inventory) return null;
        const bx = ((p.column_number - 1) / Math.max(cols - 1, 1) - 0.5) * rW * 0.85;
        const by = ((p.row_number - 1) / Math.max(rows - 1, 1)) * rH + rowH * 0.35;
        const bColor = BOX_COLORS[p.inventory?.status || p.status] || BOX_COLORS.occupied;

        return (
          <mesh key={p.id} position={[bx, by, 0]} geometry={RACK_GEO.box}>
            <meshStandardMaterial color={bColor} emissive={bColor} emissiveIntensity={isActive ? 0.25 : 0.1} metalness={0.2} roughness={0.6} />
          </mesh>
        );
      })}

      {/* Rack label on hover */}
      {isActive && (
        <Text fontSize={0.14} color="#ffffff" anchorX="center" anchorY="bottom" position={[0, rH + 0.15, rD / 2 + 0.1]} outlineWidth={0.006} outlineColor="#000000">
          {rack.code} · {Math.round(fillPct * 100)}%
        </Text>
      )}

      {/* Selection highlight */}
      {isSelected && (
        <Line
          points={[
            [-rW / 2 - 0.05, 0, -rD / 2 - 0.05],
            [rW / 2 + 0.05, 0, -rD / 2 - 0.05],
            [rW / 2 + 0.05, 0, rD / 2 + 0.05],
            [-rW / 2 - 0.05, 0, rD / 2 + 0.05],
            [-rW / 2 - 0.05, 0, -rD / 2 - 0.05],
          ]}
          color="#a5b4fc"
          lineWidth={2}
          transparent
          opacity={0.7}
        />
      )}
    </group>
  );
});

// ─── Camera Controller ──────────────────────────────────
function CameraFly({ target }: { target: THREE.Vector3 | null }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!target) return;
    const goal = target.clone().add(new THREE.Vector3(3, 2.5, 3));
    camera.position.lerp(goal, 0.04);
  });
  return null;
}

// ─── Scene Content ──────────────────────────────────────
function SceneContent({
  warehouse,
  racks,
  onRackSelect,
  selectedRackId,
}: {
  warehouse: Warehouse;
  racks: Rack[];
  onRackSelect: (rack: Rack) => void;
  selectedRackId: string | null;
}) {
  const [hoveredRack, setHoveredRack] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);

  const palette = HOLO_COLORS[warehouse.type] || HOLO_COLORS.standard;

  // Layout racks in a grid
  const rackCols = useMemo(() => Math.max(Math.ceil(Math.sqrt(racks.length * 1.4)), 1), [racks.length]);
  const spacing = 2.2;

  const getRackPos = useCallback(
    (idx: number): [number, number, number] => {
      const c = idx % rackCols;
      const r = Math.floor(idx / rackCols);
      const gridW = (rackCols - 1) * spacing;
      const rackRows = Math.ceil(racks.length / rackCols);
      const gridD = (rackRows - 1) * spacing;
      return [-gridW / 2 + c * spacing, 0.01, -gridD / 2 + r * spacing];
    },
    [rackCols, racks.length]
  );

  // Calculate building dimensions
  const rackRows = Math.ceil(racks.length / rackCols);
  const gridW = (rackCols - 1) * spacing;
  const gridD = (rackRows - 1) * spacing;
  const pad = 2.5;
  const W = Math.max(gridW + pad * 2, 5);
  const D = Math.max(gridD + pad * 2, 5);
  const H = 4.5;

  const totalPositions = racks.reduce((s, r) => s + r.rack_positions.length, 0);
  const occupiedPositions = racks.reduce((s, r) => s + r.rack_positions.filter(p => p.status === "occupied").length, 0);
  const occupancy = totalPositions > 0 ? Math.round((occupiedPositions / totalPositions) * 100) : 0;
  const occColor = occupancy > 85 ? "#ef4444" : occupancy > 60 ? "#fbbf24" : "#10b981";

  const handleRackClick = useCallback((rack: Rack, idx: number) => {
    onRackSelect(rack);
    const pos = getRackPos(idx);
    setCameraTarget(new THREE.Vector3(pos[0], 1.5, pos[2]));
  }, [onRackSelect, getRackPos]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 15, 8]} intensity={0.3} color="#e0e7ff" />
      <hemisphereLight color="#1e1b4b" groundColor="#0c0c18" intensity={0.2} />

      <HoloFloor />
      <ScanLine />
      <Particles />

      {/* Building wireframe */}
      <group>
        {/* Floor surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[W, D]} />
          <meshBasicMaterial color={palette.base} transparent opacity={0.15} depthWrite={false} />
        </mesh>

        {/* Edge wireframe — bottom rectangle */}
        <Line
          points={[[-W / 2, 0.01, -D / 2], [W / 2, 0.01, -D / 2], [W / 2, 0.01, D / 2], [-W / 2, 0.01, D / 2], [-W / 2, 0.01, -D / 2]]}
          color={palette.edge}
          lineWidth={2}
          transparent
          opacity={0.6}
        />

        {/* 4 vertical corners */}
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([xD, zD], i) => (
          <Line
            key={`ve${i}`}
            points={[[xD * W / 2, 0.01, zD * D / 2], [xD * W / 2, H, zD * D / 2]]}
            color={palette.edge}
            lineWidth={1.5}
            transparent
            opacity={0.3}
          />
        ))}

        {/* Top edge wireframe (roof) */}
        <Line
          points={[[-W / 2, H, -D / 2], [W / 2, H, -D / 2], [W / 2, H, D / 2], [-W / 2, H, D / 2], [-W / 2, H, -D / 2]]}
          color={palette.edge}
          lineWidth={1}
          transparent
          opacity={0.2}
        />

        {/* Back wall translucent */}
        <mesh position={[0, H / 2, -D / 2]}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial color={palette.base} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {/* Side walls */}
        <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[D, H]} />
          <meshBasicMaterial color={palette.base} transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[D, H]} />
          <meshBasicMaterial color={palette.base} transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {/* Label above */}
        <group position={[0, H + 0.8, 0]}>
          <mesh position={[0, 0, -0.003]}>
            <planeGeometry args={[Math.max(warehouse.name.length * 0.14, 2.5) + 0.5, 0.7]} />
            <meshBasicMaterial color="#0c1029" transparent opacity={0.92} depthWrite={false} />
          </mesh>
          <Text fontSize={0.18} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0.08, 0]}>
            {warehouse.name}
          </Text>
          <Text fontSize={0.1} color={occColor} anchorX="center" anchorY="middle" position={[0, -0.14, 0]}>
            {`${occupancy}% ocupado · ${racks.length} racks · ${totalPositions} posiciones`}
          </Text>
        </group>

        {/* Interior light */}
        <pointLight position={[0, H / 2, 0]} color={palette.glow} intensity={0.8} distance={12} decay={2} />
      </group>

      {/* Racks */}
      {racks.map((rack, i) => (
        <Rack3D
          key={rack.id}
          rack={rack}
          pos={getRackPos(i)}
          tint={palette.hex}
          isSelected={rack.id === selectedRackId}
          isHovered={hoveredRack === rack.id}
          onHover={(h) => setHoveredRack(h ? rack.id : null)}
          onClick={() => handleRackClick(rack, i)}
        />
      ))}

      {/* Camera */}
      <CameraFly target={cameraTarget} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={3}
        maxDistance={30}
        target={[0, 1.5, 0]}
      />
    </>
  );
}

// ─── Loading Fallback ───────────────────────────────────
function LoadingFallback() {
  return (
    <group>
      <ambientLight intensity={0.3} />
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial color="#818cf8" wireframe />
      </mesh>
    </group>
  );
}

// ─── Error Boundary ─────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Main Export ────────────────────────────────────────
export function WarehouseSingle3D({
  warehouse,
  racks,
  onRackSelect,
  selectedRackId,
  className,
}: WarehouseSingle3DProps) {
  const cameraDistance = Math.max(racks.length * 0.5 + 4, 8);

  return (
    <div className={cn("relative w-full h-full min-h-[500px]", className)}>
      <ErrorBoundary
        fallback={
          <div className="flex h-full items-center justify-center bg-[#0e1225] rounded-xl">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Error en la escena 3D</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white"
              >
                Recargar
              </button>
            </div>
          </div>
        }
      >
        <Canvas
          camera={{ position: [cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance * 0.7], fov: 50 }}
          dpr={[1, 1.5]}
          style={{ background: "#0a0e1a", borderRadius: 12 }}
          onCreated={({ gl }) => gl.setClearColor(0x0a0e1a)}
          fallback={
            <div className="flex h-full items-center justify-center bg-[#0a0e1a] rounded-xl">
              <p className="text-sm text-slate-500">WebGL no disponible</p>
            </div>
          }
        >
          <Suspense fallback={<LoadingFallback />}>
            <SceneContent
              warehouse={warehouse}
              racks={racks}
              onRackSelect={onRackSelect}
              selectedRackId={selectedRackId || null}
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
