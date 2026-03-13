"use client";

import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls, Text, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  RotateCcw, Camera, Maximize, Minimize, Eye, Ruler, Search, QrCode,
  Sparkles, MoreVertical, X as XIcon, GraduationCap,
} from "lucide-react";
import { BoxDetailDrawer } from "./box-detail-drawer";
import { WarehouseSearch } from "./warehouse-search";
import type { SearchableItem } from "./warehouse-search";
import { RackPanel } from "./rack-panel";
import { ProductLocator } from "./product-locator";
import { getAIWarehouseRecommendations } from "../actions/ai-warehouse-action";
import { getWarehouseAdvancedData, getAllWarehouses } from "../actions/warehouse-advanced-actions";
import {
  IoTSensors3D,
  Operators3D,
  RackAlerts3D,
  HeatMapOverlay,
  StockAgingOverlay,
  ABCClassification,
  HazardousZones,
  ColdStorageFog,
  PickingPath3D,
  DockArea3D,
  CrossDockingFlow,
  ARLabels3D,
  CycleCountOverlay,
} from "./warehouse-3d-overlays";
import {
  ViewModeToolbar,
  IoTDashboardPanel,
  LaborPanel,
  WaveManagementPanel,
  AlertFeed,
  CapacityPlanningPanel,
  SlottingOptimizerPanel,
  GuidedTourOverlay,
  WarehouseComparisonPanel,
} from "./warehouse-3d-hud";

// ─── Types ──────────────────────────────────────────────

type Position = {
  id: string;
  row_number: number;
  column_number: number;
  status: string;
  inventory: {
    id: string;
    product_name: string;
    product_sku: string;
    category: string;
    image_url: string | null;
    quantity: number;
    lot_number: string | null;
    batch_code: string | null;
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
  dimensions: { width: number; depth: number; height: number };
};

type SelectedBox = {
  inventory: Position["inventory"];
  rackCode: string;
  row: number;
  col: number;
} | null;

type Props = {
  racks: Rack[];
  warehouse: Warehouse;
  onRackSelect: (rack: Rack) => void;
};

// ─── Constants ──────────────────────────────────────────

const STATUS_COLORS: Record<string, number> = {
  occupied: 0x22c55e,
  empty: 0xd4d4d8,
  reserved: 0x3b82f6,
  blocked: 0xef4444,
  expired: 0xf97316,
  quarantine: 0xa855f7,
  active: 0x22c55e,
};
const STATUS_HEX: Record<string, string> = {
  occupied: "#22C55E",
  reserved: "#3B82F6",
  blocked: "#EF4444",
  expired: "#F97316",
  quarantine: "#A855F7",
};
const STATUS_LABELS: Record<string, string> = {
  occupied: "Ocupado",
  reserved: "Reservado",
  blocked: "Bloqueado",
  expired: "Vencido",
  quarantine: "Cuarentena",
};

// ─── Category texture mapping ───────────────────────────

const CATEGORY_TEXTURE_MAP: Record<string, string> = {
  "Componentes Electrónicos": "electronics",
  "Material de Empaque": "packaging",
  "Materias Primas": "raw",
  "Productos Químicos": "chemical",
  "Productos Terminados": "finished",
  "Repuestos Mecánicos": "mechanical",
};

const CATEGORY_COLORS: Record<string, number> = {
  electronics: 0x22c55e,
  packaging: 0xfbbf24,
  raw: 0xef4444,
  chemical: 0xfbbf24,
  finished: 0x22c55e,
  mechanical: 0x9ca3af,
};

// ─── Texture Hook ───────────────────────────────────────

function useWarehouseTextures() {
  const [concrete, metal, wall, cardboard, wood, electronics, packaging, raw, chemical, finished, mechanical] = useLoader(
    THREE.TextureLoader,
    [
      "/textures/concrete.png",
      "/textures/metal.png",
      "/textures/wall.png",
      "/textures/cardboard.png",
      "/textures/wood.png",
      "/textures/electronics.png",
      "/textures/packaging.png",
      "/textures/raw.png",
      "/textures/chemical.png",
      "/textures/finished.png",
      "/textures/mechanical.png",
    ]
  );

  useMemo(() => {
    concrete.wrapS = THREE.RepeatWrapping;
    concrete.wrapT = THREE.RepeatWrapping;
    concrete.repeat.set(8, 5);
    wall.wrapS = THREE.RepeatWrapping;
    wall.wrapT = THREE.RepeatWrapping;
    wall.repeat.set(10, 2);
    metal.wrapS = THREE.RepeatWrapping;
    metal.wrapT = THREE.RepeatWrapping;
    metal.repeat.set(1, 3);
    wood.wrapS = THREE.RepeatWrapping;
    wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(2, 2);
    cardboard.wrapS = THREE.RepeatWrapping;
    cardboard.wrapT = THREE.RepeatWrapping;
    cardboard.repeat.set(1, 1);
  }, [concrete, metal, wall, cardboard, wood]);

  return {
    concrete, metal, wall, cardboard, wood,
    categoryTextures: { electronics, packaging, raw, chemical, finished, mechanical } as Record<string, THREE.Texture>,
  };
}

// ─── Animated Forklift ──────────────────────────────────

const FORKLIFT_PATHS: [number, number][][] = [
  // Forklift 1: patrols aisle 1 (z ≈ -7)
  [[-10, -8.5], [-4, -8.5], [2, -8.5], [6, -8.5], [10, -8.5], [10, -5.5], [6, -5.5], [2, -5.5], [-4, -5.5], [-10, -5.5]],
  // Forklift 2: patrols aisle 2 (z ≈ -2.5)
  [[-10, -4], [-4, -4], [2, -4], [8, -4], [8, -1], [2, -1], [-4, -1], [-10, -1]],
  // Forklift 3: patrols aisle 3 (z ≈ 2)
  [[-10, 0.5], [-2, 0.5], [6, 0.5], [10, 0.5], [10, 3.5], [6, 3.5], [-2, 3.5], [-10, 3.5]],
];

const FORKLIFT_COLORS = ["#F59E0B", "#3B82F6", "#10B981"];
const BOX_COLORS = [0x22c55e, 0x3b82f6, 0xf97316, 0xa855f7, 0xef4444];

function AnimatedForklift({
  pathIndex,
  active,
  metalTex,
}: {
  pathIndex: number;
  active: boolean;
  metalTex: THREE.Texture;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const currentWaypoint = useRef(0);
  const forkHeight = useRef(0.12);
  const carryingBox = useRef(true);
  const boxColor = useRef(BOX_COLORS[0]);
  const beaconRef = useRef<THREE.Mesh>(null);

  const path = FORKLIFT_PATHS[pathIndex % FORKLIFT_PATHS.length];
  const color = FORKLIFT_COLORS[pathIndex % FORKLIFT_COLORS.length];

  // Initial position
  useEffect(() => {
    if (groupRef.current) {
      const start = path[0];
      groupRef.current.position.set(start[0], 0, start[1]);
    }
  }, [path]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Beacon rotation
    if (beaconRef.current) {
      beaconRef.current.rotation.y += delta * 6;
    }

    if (!active) {
      // Park at starting position
      const start = path[0];
      groupRef.current.position.x += (start[0] - groupRef.current.position.x) * delta * 2;
      groupRef.current.position.z += (start[1] - groupRef.current.position.z) * delta * 2;
      forkHeight.current += (0.12 - forkHeight.current) * delta * 3;
      return;
    }

    // Move along path
    const speed = 1.5;
    progress.current += delta * speed;

    const fromIdx = currentWaypoint.current;
    const toIdx = (fromIdx + 1) % path.length;
    const from = path[fromIdx];
    const to = path[toIdx];

    const segLen = Math.sqrt(
      (to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2
    );
    const t = Math.min(progress.current / segLen, 1);

    // Interpolate position
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[1] + (to[1] - from[1]) * t;
    groupRef.current.position.x = x;
    groupRef.current.position.z = z;

    // Face direction of travel
    const angle = Math.atan2(to[0] - from[0], to[1] - from[1]);
    const currentRot = groupRef.current.rotation.y;
    groupRef.current.rotation.y += (angle - currentRot) * delta * 5;

    // Fork animation: raise when moving, lower at waypoints
    const targetForkH = t > 0.3 && t < 0.7 ? 0.5 : 0.12;
    forkHeight.current += (targetForkH - forkHeight.current) * delta * 4;

    // Toggle box at each waypoint
    if (t >= 1) {
      progress.current = 0;
      currentWaypoint.current = toIdx;
      carryingBox.current = !carryingBox.current;
      boxColor.current = BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)];
    }
  });

  const fh = forkHeight.current;

  return (
    <group ref={groupRef}>
      {/* ── Body / Engine compartment ────── */}
      <mesh position={[0, 0.3, -0.2]} castShadow>
        <boxGeometry args={[0.8, 0.35, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* Counterweight (back) */}
      <mesh position={[0, 0.25, -0.65]} castShadow>
        <boxGeometry args={[0.75, 0.3, 0.15]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ── Cab / overhead guard ────── */}
      <mesh position={[0, 0.7, -0.25]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.7]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Cab pillars */}
      {[[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.05], [0.3, 0.05]].map(
        ([px, pz], i) => (
          <mesh key={`pillar-${i}`} position={[px, 0.55, pz]}>
            <boxGeometry args={[0.03, 0.35, 0.03]} />
            <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.3} />
          </mesh>
        )
      )}

      {/* Seat */}
      <mesh position={[0, 0.45, -0.3]}>
        <boxGeometry args={[0.3, 0.08, 0.25]} />
        <meshStandardMaterial color="#1F2937" roughness={0.9} />
      </mesh>
      {/* Seat back */}
      <mesh position={[0, 0.55, -0.45]}>
        <boxGeometry args={[0.28, 0.2, 0.05]} />
        <meshStandardMaterial color="#1F2937" roughness={0.9} />
      </mesh>

      {/* ── Mast (vertical rails) ────── */}
      {[-0.12, 0.12].map((px, i) => (
        <mesh key={`mast-${i}`} position={[px, 0.55, 0.5]}>
          <boxGeometry args={[0.035, 1.0, 0.035]} />
          <meshStandardMaterial
            map={metalTex}
            color="#64748B"
            metalness={0.75}
            roughness={0.2}
          />
        </mesh>
      ))}
      {/* Mast crossbar */}
      <mesh position={[0, 0.95, 0.5]}>
        <boxGeometry args={[0.28, 0.025, 0.025]} />
        <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* ── Forks (move up/down) ────── */}
      {[-0.12, 0.12].map((px, i) => (
        <mesh key={`fk-${i}`} position={[px, fh, 0.85]}>
          <boxGeometry args={[0.05, 0.03, 0.7]} />
          <meshStandardMaterial
            map={metalTex}
            color="#6B7280"
            metalness={0.75}
            roughness={0.2}
          />
        </mesh>
      ))}
      {/* Fork backplate */}
      <mesh position={[0, fh + 0.1, 0.5]}>
        <boxGeometry args={[0.3, 0.22, 0.025]} />
        <meshStandardMaterial color="#64748B" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ── Carried box ────── */}
      {carryingBox.current && (
        <mesh position={[0, fh + 0.15, 0.85]} castShadow>
          <boxGeometry args={[0.3, 0.2, 0.35]} />
          <meshStandardMaterial
            color={boxColor.current}
            roughness={0.7}
          />
        </mesh>
      )}

      {/* ── Wheels ────── */}
      {/* Front (larger, steering) */}
      {[-0.35, 0.35].map((px, i) => (
        <mesh
          key={`fw-${i}`}
          position={[px, 0.1, 0.35]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.1, 0.1, 0.07, 12]} />
          <meshStandardMaterial color="#111827" roughness={0.95} />
        </mesh>
      ))}
      {/* Rear (smaller) */}
      {[-0.3, 0.3].map((px, i) => (
        <mesh
          key={`rw-${i}`}
          position={[px, 0.08, -0.55]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
          <meshStandardMaterial color="#111827" roughness={0.95} />
        </mesh>
      ))}

      {/* ── Warning beacon (flashing) ────── */}
      <mesh ref={beaconRef} position={[0, 0.78, -0.25]}>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 8]} />
        <meshStandardMaterial
          color="#F59E0B"
          emissive={active ? "#F59E0B" : "#000"}
          emissiveIntensity={active ? 0.6 : 0}
          toneMapped={false}
        />
      </mesh>
      {active && (
        <pointLight
          position={[0, 0.85, -0.25]}
          intensity={0.3}
          distance={3}
          color="#F59E0B"
          decay={2}
        />
      )}
    </group>
  );
}

// ─── Warehouse Building ─────────────────────────────────

// ─── Dust Particles (disabled for performance) ──────────

function DustParticles() {
  return null;
}

// ─── Warehouse Building ─────────────────────────────────

function WarehouseBuilding({ textures, rackCount = 16, maxRackWidth = 2.5 }: { textures: ReturnType<typeof useWarehouseTextures>; rackCount?: number; maxRackWidth?: number }) {
  // ── Calculate building size FROM the actual rack grid footprint ──
  // Mirror the exact same spacing formula used by getRackPosition
  const xSpacing = maxRackWidth + 0.5;  // rack width + 0.5m walkway  
  const zSpacing = 0.5 + 1.8;           // rack depth (0.5) + 1.8m aisle
  const cols = Math.ceil(Math.sqrt(rackCount * 1.5));
  const rows = Math.ceil(rackCount / cols);
  const gridW = (cols - 1) * xSpacing;
  const gridD = (rows - 1) * zSpacing;
  
  // Building = grid footprint + margin each side
  const margin = 2.5;
  const W = gridW + margin * 2;
  const D = gridD + margin * 2;
  const H = 5.5;

  return (
    <group>
      {/* ── Floor ────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial
          map={textures.concrete}
          roughness={0.85}
          metalness={0.02}
        />
      </mesh>

      {/* ── Back wall ────── */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial
          map={textures.wall}
          roughness={0.8}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Side walls ────── */}
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={textures.wall} roughness={0.8} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={textures.wall} roughness={0.8} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Columns ────── */}
      {[-W / 2 + 0.2, W / 2 - 0.2].map((x) =>
        Array.from({ length: 3 }, (_, j) => (
          <mesh key={`col-${x}-${j}`} position={[x, H / 2, -D / 2 + 3 + j * (D / 3)]}>
            <boxGeometry args={[0.3, H, 0.3]} />
            <meshStandardMaterial color="#78716C" metalness={0.5} roughness={0.35} />
          </mesh>
        ))
      )}

      {/* ── Industrial Gate ────── */}
      <group position={[0, 0, D / 2]}>
        <mesh position={[-2.2, H / 2 - 0.5, 0]}>
          <boxGeometry args={[0.15, H - 1, 0.15]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[2.2, H / 2 - 0.5, 0]}>
          <boxGeometry args={[0.15, H - 1, 0.15]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, H - 1.5, 0]}>
          <boxGeometry args={[4.2, 0.15, 0.03]} />
          <meshStandardMaterial color="#9CA3AF" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}




// ─── Single Rack (textured) ─────────────────────────────

const Rack3D = React.memo(function Rack3D({
  rack,
  onSelect,
  isSelected,
  onBoxClick,
  position: rackPosition,
}: {
  rack: Rack;
  onSelect: () => void;
  isSelected: boolean;
  onBoxClick?: (pos: Position, rackCode: string) => void;
  position: [number, number, number];
}) {
  const [hovered, setHovered] = useState(false);

  const [px, , pz] = rackPosition;

  // Consistent sizing: 5 cols × 4 rows standard
  const rW = rack.columns * 0.5;
  const rH = rack.rows * 0.45 + 0.3;
  const rD = 0.5;

  const isActive = hovered || isSelected;

  // No useFrame — static rack for performance

  const occupiedCount = rack.rack_positions.filter(
    (p) => p.status === "occupied"
  ).length;
  const totalSlots = rack.rows * rack.columns;
  const occupancy = totalSlots > 0 ? occupiedCount / totalSlots : 0;

  return (
    <group
      position={[px, 0, pz]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Selection glow on floor */}
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[rW + 0.6, rD + 0.6]} />
          <meshBasicMaterial
            color={isSelected ? 0x6366f1 : 0x818cf8}
            transparent
            opacity={0.18}
          />
        </mesh>
      )}

      {/* Base plate */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[rW + 0.1, 0.03, rD + 0.1]} />
        <meshStandardMaterial
          color={isActive ? 0x818cf8 : 0x94a3b8}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>

      {/* 4 upright posts — NO bolt holes */}
      {[-1, 1].map((xD) =>
        [-1, 1].map((zD) => (
          <mesh
            key={`post-${xD}-${zD}`}
            position={[(xD * rW) / 2, rH / 2, (zD * rD) / 2]}
          >
            <boxGeometry args={[0.04, rH, 0.04]} />
            <meshStandardMaterial
              color={isActive ? 0x818cf8 : 0x3730a3}
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>
        ))
      )}

      {/* Shelves — simple beams + flat shelf, NO wire grids */}
      {Array.from({ length: rack.rows + 1 }, (_, i) => {
        const y = 0.03 + (i / rack.rows) * (rH - 0.03);
        return (
          <group key={`lvl-${i}`}>
            <mesh position={[0, y, rD / 2]}>
              <boxGeometry args={[rW + 0.04, 0.04, 0.03]} />
              <meshStandardMaterial color={isActive ? 0xa5b4fc : 0x4338ca} metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[0, y, -rD / 2]}>
              <boxGeometry args={[rW + 0.04, 0.04, 0.03]} />
              <meshStandardMaterial color={isActive ? 0xa5b4fc : 0x4338ca} metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[0, y + 0.018, 0]}>
              <boxGeometry args={[rW, 0.012, rD - 0.04]} />
              <meshStandardMaterial color={isActive ? 0xc7d2fe : 0xd1d5db} metalness={0.3} roughness={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* Inventory boxes — ONE mesh per item, NO pallets, NO labels */}
      {rack.rack_positions.map((pos) => {
        if (pos.status === "empty" && !pos.inventory) return null;

        const cw = rW / rack.columns;
        const ch = (rH - 0.03) / rack.rows;
        const cx = (pos.column_number - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.03 + (pos.row_number - 1) * ch + ch * 0.35;

        const st =
          pos.inventory?.status === "expired" ? "expired"
          : pos.inventory?.status === "quarantine" ? "quarantine"
          : pos.status;

        if (st === "empty") return null;

        const category = pos.inventory?.category || "";
        const texKey = CATEGORY_TEXTURE_MAP[category] || "finished";
        const catColor = CATEGORY_COLORS[texKey] || 0xd4a574;

        const isExpired = st === "expired";
        const isQuarantine = st === "quarantine";
        const isReserved = st === "reserved";
        const baseColor = isExpired ? 0xef4444 : isQuarantine ? 0xa855f7 : isReserved ? 0x3b82f6 : catColor;

        const itemW = cw * 0.7;
        const itemH = ch * 0.45;
        const itemD = rD * 0.55;

        return (
          <mesh
            key={pos.id}
            position={[cx, cy, 0]}
            onClick={(e) => { e.stopPropagation(); onBoxClick?.(pos, rack.code); }}
          >
            <boxGeometry args={[itemW, itemH, itemD]} />
            <meshStandardMaterial
              color={baseColor}
              roughness={0.75}
              metalness={isExpired ? 0.1 : 0.05}
            />
          </mesh>
        );
      })}

      {/* Rack code label — only one Text per rack */}
      <Text
        position={[0, rH + 0.15, 0]}
        fontSize={0.15}
        color={isActive ? "#4338CA" : "#64748B"}
        anchorX="center"
        anchorY="middle"
      >
        {rack.code}
      </Text>

      {/* Tooltip on hover */}
      {hovered && (
        <Html
          position={[0, rH + 0.45, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 10,
              padding: "8px 14px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
              whiteSpace: "nowrap",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
              Rack {rack.code}
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${occupancy * 100}%`, height: "100%", background: occupancy > 0.8 ? "#F59E0B" : "#22C55E", borderRadius: 2 }} />
              </div>
              <span>{Math.round(occupancy * 100)}%</span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span>{occupiedCount}/{totalSlots}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── Camera Fly-To ──────────────────────────────────────

function CameraController({ target }: { target: THREE.Vector3 | null }) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 1.5, 0));

  useFrame((_, delta) => {
    if (!target) return;
    targetRef.current.lerp(target, delta * 3);
    const ideal = targetRef.current.clone().add(new THREE.Vector3(3, 3, 3));
    camera.position.lerp(ideal, delta * 2);
    camera.lookAt(targetRef.current);
  });

  return null;
}

// ─── Scene ──────────────────────────────────────────────

// ─── FPS Controls ───────────────────────────────────────

function FPSControls({ active }: { active: boolean }) {
  const { camera, gl } = useThree();
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});
  const savedPos = useRef(new THREE.Vector3());
  const savedQuat = useRef(new THREE.Quaternion());

  useEffect(() => {
    if (!active) return;
    // Save original camera state to restore on exit
    savedPos.current.copy(camera.position);
    savedQuat.current.copy(camera.quaternion);
    // Start at a nice fly position
    camera.position.set(0, 6, 14);
    camera.lookAt(0, 2, 0);
    euler.current.setFromQuaternion(camera.quaternion);

    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      // Prevent page scroll on arrow keys / space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      euler.current.y -= e.movementX * 0.002;
      euler.current.x -= e.movementY * 0.002;
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    const onClick = () => { gl.domElement.requestPointerLock(); };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    gl.domElement.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      gl.domElement.removeEventListener("click", onClick);
      if (document.pointerLockElement) document.exitPointerLock();
      keys.current = {};
      // Restore original camera
      camera.position.copy(savedPos.current);
      camera.quaternion.copy(savedQuat.current);
    };
  }, [active, camera, gl]);

  useFrame((_, delta) => {
    if (!active) return;
    const speed = 8 * delta;

    // Get camera directions for fly movement
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();

    velocity.current.set(0, 0, 0);

    // WASD + Arrow keys — fly in the direction you're looking
    if (keys.current["KeyW"] || keys.current["ArrowUp"]) velocity.current.addScaledVector(forward, speed);
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) velocity.current.addScaledVector(forward, -speed);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) velocity.current.addScaledVector(right, -speed);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) velocity.current.addScaledVector(right, speed);

    // Q/E or Space/Shift for vertical movement
    if (keys.current["KeyE"] || keys.current["Space"]) velocity.current.y += speed;
    if (keys.current["KeyQ"] || keys.current["ShiftLeft"] || keys.current["ShiftRight"]) velocity.current.y -= speed;

    // Shift = boost speed
    if (keys.current["ShiftLeft"] || keys.current["ShiftRight"]) {
      velocity.current.multiplyScalar(1.8);
    }

    camera.position.add(velocity.current);
    // Clamp minimum height to prevent going underground
    camera.position.y = Math.max(0.3, camera.position.y);
  });

  return null;
}

// ─── MiniMap (2D Canvas, outside Canvas) ────────────────

function MiniMap({ racks, visible }: { racks: Rack[]; visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const W = 140, H = 100;
    cv.width = W; cv.height = H;
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, W - 10, H - 10);

    racks.forEach((rack, i) => {
      const racksPerAisle = Math.ceil(racks.length / 4);
      const aisleIdx = Math.floor(i / racksPerAisle);
      const posInAisle = i % racksPerAisle;
      const col = Math.floor(posInAisle / 2);
      const side = posInAisle % 2 === 0 ? 0 : 8;

      const mx = 20 + col * 18;
      const my = 15 + aisleIdx * 22 + side;

      const occ = rack.rack_positions.filter(p => p.status === "occupied").length;
      const total = rack.rack_positions.length;
      const ratio = total > 0 ? occ / total : 0;

      ctx.fillStyle = ratio > 0.7 ? "#10B981" : ratio > 0.3 ? "#F59E0B" : "#94A3B8";
      ctx.fillRect(mx, my, 12, 5);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "4px sans-serif";
      ctx.fillText(rack.code, mx, my - 1);
    });

    ctx.fillStyle = "#64748B";
    ctx.font = "5px sans-serif";
    ctx.fillText("MiniMapa", 5, H - 3);
  }, [racks]);

  return (
    <div
      className={`absolute right-3 top-3 overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10 transition-all duration-200 ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <canvas ref={canvasRef} style={{ width: 140, height: 100 }} />
    </div>
  );
}

// ─── Distance Measurement Tool ──────────────────────────

function DistanceTool({ active }: { active: boolean }) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);

  useEffect(() => {
    if (!active) setPoints([]);
  }, [active]);

  const handleClick = useCallback(
    (e: THREE.Event) => {
      if (!active) return;
      const pt = (e as unknown as { point: THREE.Vector3 }).point;
      setPoints((prev) => {
        if (prev.length >= 2) return [pt];
        return [...prev, pt.clone()];
      });
    },
    [active]
  );

  const distance = points.length === 2
    ? points[0].distanceTo(points[1]).toFixed(2)
    : null;

  const midpoint = points.length === 2
    ? new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5)
    : null;

  if (!active) return null;

  return (
    <group>
      {/* Click plane (invisible) */}
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        visible={false}
      >
        <planeGeometry args={[60, 40]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Point markers */}
      {points.map((pt, i) => (
        <mesh key={`dp-${i}`} position={pt}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
      ))}

      {/* Line between points */}
      {points.length === 2 && (
        <Line
          points={[points[0], points[1]]}
          color="#EF4444"
          lineWidth={2}
        />
      )}

      {/* Distance label */}
      {midpoint && distance && (
        <Html position={midpoint} center style={{ pointerEvents: "none" }}>
          <div className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg whitespace-nowrap">
            {distance}m
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Floating 3D Dashboard ──────────────────────────────

function FloatingDashboard({ racks }: { racks: Rack[] }) {
  const total = racks.reduce((s, r) => s + r.rack_positions.length, 0);
  const occupied = racks.reduce(
    (s, r) => s + r.rack_positions.filter((p) => p.status !== "empty").length, 0
  );
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  // Wall-mounted on back wall, at eye-level
  return (
    <group position={[-12.8, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
      {/* Metal frame */}
      <mesh>
        <boxGeometry args={[2.6, 1.5, 0.06]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Screen bezel */}
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[2.4, 1.3]} />
        <meshBasicMaterial color="#0F172A" />
      </mesh>

      {/* LED indicator */}
      <mesh position={[1.1, -0.65, 0.04]}>
        <circleGeometry args={[0.02, 8]} />
        <meshBasicMaterial color="#22C55E" />
      </mesh>

      {/* Title */}
      <Text position={[0, 0.5, 0.04]} fontSize={0.09} color="#94A3B8" anchorX="center" anchorY="middle">
        OCUPACIÓN EN TIEMPO REAL
      </Text>

      {/* Overall percentage — big */}
      <Text
        position={[0, 0.32, 0.04]}
        fontSize={0.16}
        color={pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981"}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {pct}% OCUPADO — {occupied}/{total}
      </Text>

      {/* Rack bars — horizontal, compact */}
      {racks.slice(0, 6).map((rack, i) => {
        const rTotal = rack.rack_positions.length;
        const rOcc = rack.rack_positions.filter((p) => p.status !== "empty").length;
        const ratio = rTotal > 0 ? rOcc / rTotal : 0;
        const y = 0.14 - i * 0.14;
        const barW = 1.4;

        return (
          <group key={rack.id} position={[-0.35, y, 0.04]}>
            {/* Rack code */}
            <Text position={[-0.55, 0, 0]} fontSize={0.055} color="#94A3B8" anchorX="right" anchorY="middle">
              {rack.code}
            </Text>
            {/* BG */}
            <mesh position={[barW / 2, 0, 0]}>
              <planeGeometry args={[barW, 0.06]} />
              <meshBasicMaterial color="#1E293B" />
            </mesh>
            {/* Fill */}
            {ratio > 0 && (
              <mesh position={[(barW * ratio) / 2, 0, 0.001]}>
                <planeGeometry args={[barW * ratio, 0.06]} />
                <meshBasicMaterial color={ratio > 0.8 ? "#EF4444" : ratio > 0.5 ? "#F59E0B" : "#10B981"} />
              </mesh>
            )}
            {/* % label */}
            <Text position={[barW + 0.08, 0, 0]} fontSize={0.045} color="#CBD5E1" anchorX="left" anchorY="middle">
              {Math.round(ratio * 100)}%
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ─── Scene Content ──────────────────────────────────────

function SceneContent({
  racks,
  selectedRackId,
  onRackSelect,
  cameraTarget,
  simulating,
  onBoxClick,
  fpsMode,
  distanceMeasuring,
  viewMode,
  toggles,
  sensors,
  operators,
  pickingPath,
  countedRacks,
  warehouseType,
}: {
  racks: Rack[];
  selectedRackId: string | null;
  onRackSelect: (rack: Rack) => void;
  cameraTarget: THREE.Vector3 | null;
  simulating: boolean;
  onBoxClick?: (pos: Position, rackCode: string) => void;
  fpsMode?: boolean;
  distanceMeasuring?: boolean;
  viewMode?: string;
  toggles?: Record<string, boolean>;
  sensors?: { id: string; sensor_type: string; label: string; position_x: number; position_y: number; position_z: number; current_value: number; unit: string; status: string; min_threshold: number | null; max_threshold: number | null }[];
  operators?: { id: string; name: string; role: string; avatar_color: string; current_zone: string | null; current_task: string | null; position_x: number; position_z: number; tasks_completed_today: number; items_picked_today: number }[];
  pickingPath?: [number, number, number][];
  countedRacks?: Set<string>;
  warehouseType?: string;
}) {
  const textures = useWarehouseTextures();

  const getRackPosition = useCallback((index: number): [number, number, number] => {
    const totalRacks = racks.length;
    
    // Find the widest rack to prevent overlap
    const maxRackWidth = Math.max(...racks.map(r => r.columns * 0.5));
    const maxRackDepth = 0.5; // rD is always 0.5
    
    // Spacing = widest rack + aisle gap
    const xSpacing = maxRackWidth + 0.5;  // rack width + 0.5m walkway
    const zSpacing = maxRackDepth + 1.8;  // rack depth + 1.8m aisle for walking
    
    // Calculate grid dimensions — slightly more columns than rows for wide layout
    const cols = Math.ceil(Math.sqrt(totalRacks * 1.5));
    const rows = Math.ceil(totalRacks / cols);
    
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    const totalW = (cols - 1) * xSpacing;
    const totalD = (rows - 1) * zSpacing;
    
    return [
      -totalW / 2 + col * xSpacing,
      0,
      -totalD / 2 + row * zSpacing
    ];
  }, [racks]);

  return (
    <>
      <ambientLight intensity={0.5} color="#F0F4FF" />
      <directionalLight
        position={[12, 18, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={40}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight position={[-8, 14, -8]} intensity={0.4} color="#E0E7FF" />
      <hemisphereLight color="#F8FAFC" groundColor="#D1D5DB" intensity={0.5} />

      <WarehouseBuilding textures={textures} rackCount={racks.length} maxRackWidth={Math.max(...racks.map(r => r.columns * 0.5))} />

      {racks.map((rack, i) => (
        <Rack3D
          key={rack.id}
          rack={rack}
          isSelected={rack.id === selectedRackId}
          onSelect={() => onRackSelect(rack)}
          onBoxClick={onBoxClick}
          position={getRackPosition(i)}
        />
      ))}
      {cameraTarget && <CameraController target={cameraTarget} />}

      {!fpsMode && (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={3}
          maxDistance={28}
          target={[0, 1.5, 0]}
        />
      )}
      {fpsMode && <FPSControls active={fpsMode} />}
      <DistanceTool active={distanceMeasuring || false} />
      <FloatingDashboard racks={racks} />

      {/* ── Advanced Overlays ────────────────────────── */}
      {toggles?.iot && sensors && <IoTSensors3D sensors={sensors} />}
      {toggles?.operators && operators && <Operators3D operators={operators} />}
      {toggles?.alerts && <RackAlerts3D racks={racks} getRackPosition={getRackPosition} />}
      {toggles?.labels && <ARLabels3D racks={racks} getRackPosition={getRackPosition} active />}
      {toggles?.dock && <DockArea3D active />}
      {toggles?.crossdock && <CrossDockingFlow active />}
      {toggles?.coldFog && <ColdStorageFog active warehouseType={warehouseType || "general"} />}

      {/* View mode overlays */}
      <HeatMapOverlay racks={racks} getRackPosition={getRackPosition} active={viewMode === "heatmap"} />
      <StockAgingOverlay racks={racks} getRackPosition={getRackPosition} active={viewMode === "aging"} />
      <ABCClassification racks={racks} getRackPosition={getRackPosition} active={viewMode === "abc"} />
      <HazardousZones active={viewMode === "hazardous"} />
      <CycleCountOverlay racks={racks} getRackPosition={getRackPosition} active={viewMode === "cycle_count"} countedRacks={countedRacks || new Set()} />

      {/* Picking path */}
      <PickingPath3D path={pickingPath || []} active={(pickingPath || []).length > 0} />
    </>
  );
}

// ─── Loading Fallback ───────────────────────────────────

function LoadingFallback() {
  return (
    <group>
      <ambientLight intensity={0.5} />
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial color="#818CF8" wireframe />
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

export function Warehouse3DScene({
  racks: initialRacks,
  warehouse,
  onRackSelect,
}: Props) {
  const [racks, setRacks] = useState(initialRacks);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [selectedBox, setSelectedBox] = useState<SelectedBox>(null);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fpsMode, setFpsMode] = useState(false);
  const [minimapHover, setMinimapHover] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [distanceMeasuring, setDistanceMeasuring] = useState(false);
  const [locatorOpen, setLocatorOpen] = useState(false);
  const [aiRecs, setAiRecs] = useState<{ recommendations: { type: string; title: string; description: string; impactLevel: string; rackCode: string; productSku?: string }[]; summary: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  // Advanced features state
  const [viewMode, setViewMode] = useState<"normal" | "heatmap" | "aging" | "abc" | "hazardous" | "cycle_count">("normal");
  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>({ alerts: false, iot: false, operators: false, labels: false, dock: false, crossdock: false, coldFog: false });
  const [sensors, setSensors] = useState<{ id: string; sensor_type: string; label: string; position_x: number; position_y: number; position_z: number; current_value: number; unit: string; status: string; min_threshold: number | null; max_threshold: number | null }[]>([]);
  const [operators, setOperators] = useState<{ id: string; name: string; role: string; avatar_color: string; current_zone: string | null; current_task: string | null; position_x: number; position_z: number; tasks_completed_today: number; items_picked_today: number }[]>([]);
  const [pickingOrders, setPickingOrders] = useState<{ id: string; order_number: string; wave_id: string | null; status: string; priority: string; total_items: number; picked_items: number; estimated_time_min: number | null; items: { sku: string; qty: number; picked: boolean }[] }[]>([]);
  const [pickingPath, setPickingPath] = useState<[number, number, number][]>([]);
  const [allWarehouses, setAllWarehouses] = useState<{ id: string; name: string; type: string }[]>([]);
  const [iotPanelOpen, setIotPanelOpen] = useState(false);
  const [laborPanelOpen, setLaborPanelOpen] = useState(false);
  const [wavePanelOpen, setWavePanelOpen] = useState(false);
  const [alertFeedOpen, setAlertFeedOpen] = useState(false);
  const [capacityPanelOpen, setCapacityPanelOpen] = useState(false);
  const [slottingPanelOpen, setSlottingPanelOpen] = useState(false);
  const [guidedTourActive, setGuidedTourActive] = useState(false);
  const [warehouseNavOpen, setWarehouseNavOpen] = useState(false);
  const [countedRacks, setCountedRacks] = useState<Set<string>>(new Set());
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setRacks(initialRacks);
  }, [initialRacks]);

  // Fetch advanced data (IoT, operators, orders)
  useEffect(() => {
    const fetchAdvanced = async () => {
      try {
        const [advanced, warehouses] = await Promise.all([
          getWarehouseAdvancedData(warehouse.id),
          getAllWarehouses(),
        ]);
        setSensors(advanced.sensors);
        setOperators(advanced.operators);
        setPickingOrders(advanced.pickingOrders);
        setAllWarehouses(warehouses);
      } catch (err) {
        console.error("Error loading advanced data:", err);
      }
    };
    fetchAdvanced();
    // Live IoT simulation: drift sensor values every 30s
    const iotInterval = setInterval(() => {
      setSensors((prev) =>
        prev.map((s) => ({
          ...s,
          current_value: s.current_value + (Math.random() - 0.5) * 1.5,
          status:
            s.current_value > (s.max_threshold || Infinity) || s.current_value < (s.min_threshold || -Infinity)
              ? "alarm"
              : Math.abs(s.current_value - (s.max_threshold || 0)) < 3
              ? "warning"
              : "active",
        }))
      );
    }, 30000);
    return () => clearInterval(iotInterval);
  }, [warehouse.id]);

  const handleToggleFeature = useCallback((key: string) => {
    setFeatureToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleActivatePicking = useCallback((orderId: string) => {
    // Generate a demo picking path through racks
    const racksPerAisle = Math.ceil(racks.length / 4);
    const path: [number, number, number][] = [
      [0, 0.3, 8], // Start at staging
    ];
    // Pick 3-4 random rack positions
    for (let i = 0; i < Math.min(4, racks.length); i++) {
      const rackIdx = Math.floor(Math.random() * racks.length);
      const aisleIdx = Math.floor(rackIdx / racksPerAisle);
      const posInAisle = rackIdx % racksPerAisle;
      const col = Math.floor(posInAisle / 2);
      const side = posInAisle % 2 === 0 ? -1 : 1;
      path.push([-10 + col * 3.2, 0.3, -7 + aisleIdx * 4.5 + side * 1.2]);
    }
    path.push([0, 0.3, 8]); // Return to staging
    setPickingPath(path);
  }, [racks.length]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      if (e.key === "Escape" && fpsMode) setFpsMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fpsMode]);

  // Build searchable items from racks
  const searchItems = useMemo<SearchableItem[]>(() => {
    const items: SearchableItem[] = [];
    racks.forEach((rack, i) => {
      const racksPerAisle = Math.ceil(racks.length / 4);
      const aisleIdx = Math.floor(i / racksPerAisle);
      const posInAisle = i % racksPerAisle;
      const side = posInAisle % 2 === 0 ? -1 : 1;
      const col = Math.floor(posInAisle / 2);
      const posX = col * 4 - 8 + side * 0.75;
      const posZ = aisleIdx * 5 - 6;

      rack.rack_positions.forEach((pos) => {
        if (!pos.inventory) return;
        items.push({
          positionId: pos.id,
          rackCode: rack.code,
          rackId: rack.id,
          row: pos.row_number,
          col: pos.column_number,
          productName: pos.inventory.product_name,
          productSku: pos.inventory.product_sku,
          category: pos.inventory.category,
          quantity: pos.inventory.quantity,
          status: pos.inventory.status || pos.status,
          posX,
          posY: 1.5,
          posZ,
        });
      });
    });
    return items;
  }, [racks]);

  const handleSearchSelect = useCallback((item: SearchableItem) => {
    setCameraTarget(new THREE.Vector3(item.posX, item.posY, item.posZ));
    setSelectedRackId(item.rackId);
  }, []);

  const takeScreenshot = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `almacen-${warehouse.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, [warehouse.name]);

  // Locator items for product search
  const locatorItems = useMemo(() => {
    return racks.flatMap((rack, i) => {
      const racksPerAisle = Math.ceil(racks.length / 4);
      const aisleIdx = Math.floor(i / racksPerAisle);
      const posInAisle = i % racksPerAisle;
      const side = posInAisle % 2 === 0 ? -1 : 1;
      const col = Math.floor(posInAisle / 2);

      return rack.rack_positions
        .filter((pos) => pos.inventory)
        .map((pos) => ({
          positionId: pos.id,
          productName: pos.inventory!.product_name,
          productSku: pos.inventory!.product_sku,
          category: pos.inventory!.category,
          quantity: pos.inventory!.quantity,
          rackCode: rack.code,
          row: pos.row_number,
          col: pos.column_number,
          status: pos.inventory!.status || pos.status,
          supplier: pos.inventory!.supplier || null,
          lotNumber: pos.inventory!.lot_number || null,
          expiryDate: pos.inventory!.expiry_date || null,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          _posX: -10 + col * 3.2,
          _posZ: -7 + aisleIdx * 4.5 + side * 1.2,
        }));
    });
  }, [racks, warehouse]);

  // Handle locate from product locator
  const handleLocateProduct = useCallback((item: { positionId: string; rackCode: string; _posX?: number; _posZ?: number }) => {
    const extItem = item as typeof locatorItems[0];
    if (extItem._posX !== undefined) {
      setCameraTarget(new THREE.Vector3(extItem._posX, 1.5, extItem._posZ));
    }
    const rack = racks.find((r) => r.code === item.rackCode);
    if (rack) {
      setSelectedRackId(rack.id);
      setSelectedRack(rack);
    }
    setLocatorOpen(false);
  }, [racks]);

  // Load AI recommendations
  const handleLoadAI = useCallback(async () => {
    setAiLoading(true);
    setAiPanelOpen(true);

    const summaries = racks.map((rack) => ({
      code: rack.code,
      type: rack.rack_type,
      totalPositions: rack.rows * rack.columns,
      occupiedPositions: rack.rack_positions.filter((p) => p.status !== "empty").length,
      products: rack.rack_positions
        .filter((p) => p.inventory)
        .map((p) => {
          const inv = p.inventory!;
          const entryDate = inv.entry_date ? new Date(inv.entry_date) : new Date();
          const expiryDate = inv.expiry_date ? new Date(inv.expiry_date) : null;
          return {
            name: inv.product_name,
            sku: inv.product_sku,
            category: inv.category,
            quantity: inv.quantity,
            daysInStock: Math.floor((Date.now() - entryDate.getTime()) / 86400000),
            daysUntilExpiry: expiryDate ? Math.floor((expiryDate.getTime() - Date.now()) / 86400000) : null,
            status: inv.status,
          };
        }),
    }));

    try {
      const result = await getAIWarehouseRecommendations(warehouse.name, summaries);
      setAiRecs(result);
    } catch (err) {
      console.error("AI error:", err);
      setAiRecs({ recommendations: [], summary: "Error al cargar recomendaciones." });
    } finally {
      setAiLoading(false);
    }
  }, [racks, warehouse.name]);

  // Fullscreen
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
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Force Canvas to re-render at correct dimensions
      setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleSimulation = useCallback(() => {
    if (simulating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSimulating(false);
      setRacks(initialRacks);
    } else {
      setSimulating(true);
      intervalRef.current = setInterval(() => {
        setRacks((prev) =>
          prev.map((rack) => ({
            ...rack,
            rack_positions: rack.rack_positions.map((pos) => {
              if (Math.random() > 0.12) return pos;
              const statuses = [
                "occupied",
                "empty",
                "reserved",
                "expired",
                "quarantine",
              ];
              const ns =
                statuses[Math.floor(Math.random() * statuses.length)];
              if (ns === "empty")
                return { ...pos, status: ns, inventory: null };
              const categories = ["Componentes Electrónicos", "Material de Empaque", "Materias Primas", "Productos Químicos", "Productos Terminados", "Repuestos Mecánicos"];
              return {
                ...pos,
                status: ns,
                inventory: {
                  id: pos.inventory?.id || `sim-${Math.random().toString(36).slice(2)}`,
                  product_name: `Producto ${Math.floor(Math.random() * 100)}`,
                  product_sku: `SKU-${Math.floor(Math.random() * 9000 + 1000)}`,
                  category: categories[Math.floor(Math.random() * categories.length)],
                  image_url: null,
                  quantity: Math.floor(Math.random() * 500 + 10),
                  lot_number: `LOT-${Math.floor(Math.random() * 900 + 100)}`,
                  batch_code: `BATCH-${Math.floor(Math.random() * 99 + 1)}`,
                  entry_date: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
                  expiry_date: ns === "expired" ? new Date(Date.now() - 86400000).toISOString() : new Date(Date.now() + Math.random() * 180 * 86400000).toISOString(),
                  supplier: `Proveedor ${Math.floor(Math.random() * 10 + 1)}`,
                  status: ns === "expired" ? "expired" : ns === "quarantine" ? "quarantine" : "active",
                },
              };
            }),
          }))
        );
      }, 1800);
    }
  }, [simulating, initialRacks]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleRackSelect = useCallback(
    (rack: Rack) => {
      setSelectedRackId(rack.id);
      setSelectedRack(rack);
      onRackSelect(rack);
      const rIdx = initialRacks.indexOf(rack);
      const racksPerAisle = Math.ceil(initialRacks.length / 4);
      const aisleIdx = Math.floor(rIdx / racksPerAisle);
      const posInAisle = rIdx % racksPerAisle;
      const aisleZ = -7 + aisleIdx * 4.5;
      const side = posInAisle % 2 === 0 ? -1 : 1;
      const col = Math.floor(posInAisle / 2);
      const px = -10 + col * 3.2;
      const pz = aisleZ + side * 1.2;
      setCameraTarget(new THREE.Vector3(px, 1.2, pz));
    },
    [onRackSelect, initialRacks]
  );

  // Stats
  const occupiedTotal = racks.reduce(
    (s, r) =>
      s + r.rack_positions.filter((p) => p.status === "occupied").length,
    0
  );
  const totalPositions = racks.reduce(
    (s, r) => s + r.rack_positions.length,
    0
  );
  const reservedTotal = racks.reduce(
    (s, r) =>
      s + r.rack_positions.filter((p) => p.status === "reserved").length,
    0
  );
  const expiredTotal = racks.reduce(
    (s, r) =>
      s +
      r.rack_positions.filter(
        (p) =>
          p.status === "expired" || p.inventory?.status === "expired"
      ).length,
    0
  );
  const occupancyPct =
    totalPositions > 0
      ? Math.round((occupiedTotal / totalPositions) * 100)
      : 0;

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[calc(100vh-12rem)] min-h-[400px] rounded-xl border border-slate-200'}`}>
      <ErrorBoundary
        fallback={
          <div className="flex h-full items-center justify-center bg-slate-50 p-8">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                Error en la escena 3D
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Recargar
              </button>
            </div>
          </div>
        }
      >
        <Canvas
          camera={{ position: [16, 10, 16], fov: 50 }}
          dpr={[1, 1.25]}
          style={{ background: "#E8EDF3" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0xe8edf3);
            canvasRef.current = gl.domElement;
          }}
          fallback={
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">WebGL no disponible</p>
            </div>
          }
        >
          <Suspense fallback={<LoadingFallback />}>
            <SceneContent
              racks={racks}
              selectedRackId={selectedRackId}
              onRackSelect={handleRackSelect}
              cameraTarget={cameraTarget}
              simulating={simulating}
              onBoxClick={(pos, rackCode) => {
                setSelectedBox({
                  inventory: pos.inventory,
                  rackCode,
                  row: pos.row_number,
                  col: pos.column_number,
                });
              }}
              fpsMode={fpsMode}
              distanceMeasuring={distanceMeasuring}
              viewMode={viewMode}
              toggles={featureToggles}
              sensors={sensors}
              operators={operators}
              pickingPath={pickingPath}
              countedRacks={countedRacks}
              warehouseType={warehouse.type}
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      {/* ── HUD ──────────── */}
      <div className="absolute left-2 md:left-3 top-2 md:top-3 flex flex-col gap-1.5 max-w-[60%] md:max-w-none">
        <div className="flex items-center gap-2 rounded-lg bg-white/95 px-2 md:px-3 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] md:text-[12px] font-bold text-slate-800 truncate">
            {warehouse.name}
          </span>
          <span className="text-[9px] md:text-[10px] text-slate-400 shrink-0 hidden sm:inline">
            {racks.length} racks · {totalPositions} pos
          </span>
        </div>
        <button
          onClick={toggleSimulation}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition-all ${
            simulating
              ? "bg-red-500 text-white ring-1 ring-red-600/30 hover:bg-red-600"
              : "bg-white/95 text-slate-700 ring-1 ring-black/5 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
        >
          {simulating ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              Detener Demo
            </>
          ) : (
            <>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Simular en Vivo
            </>
          )}
        </button>
      </div>

      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <div className="rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <span className="text-[9px] text-slate-400">
            🖱 Rotar · ⚡ Zoom · Click rack
          </span>
        </div>
        <div className="rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[18px] font-black tabular-nums text-slate-800">
                {occupancyPct}%
              </p>
              <p className="text-[8px] font-medium uppercase tracking-wider text-slate-400">
                Ocupación
              </p>
            </div>
            <div className="h-8 w-8">
              <svg viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={
                    occupancyPct > 80
                      ? "#F59E0B"
                      : occupancyPct > 50
                      ? "#22C55E"
                      : "#3B82F6"
                  }
                  strokeWidth="3"
                  strokeDasharray={`${occupancyPct}, 100`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 hidden md:flex gap-1.5">
        {[
          {
            label: "Ocupados",
            value: occupiedTotal,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Reservados",
            value: reservedTotal,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Vencidos",
            value: expiredTotal,
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
          {
            label: "Total",
            value: totalPositions,
            color: "text-slate-600",
            bg: "bg-slate-100",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-lg ${s.bg} px-2.5 py-1.5 shadow-md ring-1 ring-black/5`}
          >
            <p
              className={`text-[12px] font-bold tabular-nums ${s.color}`}
            >
              {s.value}
            </p>
            <p className="text-[8px] font-medium text-slate-400">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 hidden md:flex items-center gap-3 rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-black/5">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: STATUS_HEX[key] }}
            />
            <span className="text-[9px] font-medium text-slate-500">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Tool buttons — horizontal on mobile, vertical on desktop ──────────── */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-2 md:left-3 md:translate-x-0 md:bottom-14 z-20 flex flex-row md:flex-col gap-0.5 rounded-2xl bg-white/90 p-1 shadow-xl ring-1 ring-black/[0.06] backdrop-blur-xl max-w-[95vw] overflow-x-auto md:overflow-x-visible">
        {/* Primary tools — always visible */}
        {([
          {
            icon: RotateCcw,
            label: "Reset",
            active: false,
            onClick: () => { setCameraTarget(null); setSelectedRackId(null); setSelectedBox(null); setFpsMode(false); },
            hoverClass: "hover:bg-slate-100 hover:text-slate-800",
          },
          {
            icon: isFullscreen ? Minimize : Maximize,
            label: isFullscreen ? "Salir" : "Full",
            active: false,
            onClick: toggleFullscreen,
            hoverClass: "hover:bg-blue-50 hover:text-blue-600",
          },
          {
            icon: Camera,
            label: "Foto",
            active: false,
            onClick: takeScreenshot,
            hoverClass: "hover:bg-blue-50 hover:text-blue-600",
          },
          {
            icon: GraduationCap,
            label: "Tutorial",
            active: guidedTourActive,
            onClick: () => setGuidedTourActive((p) => !p),
            hoverClass: "hover:bg-amber-50 hover:text-amber-600",
            activeClass: "bg-amber-500 text-white shadow-sm shadow-amber-200",
          },
        ] as const).map((tool) => (
          <button
            key={tool.label}
            onClick={tool.onClick}
            title={tool.label}
            className={`group relative flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
              tool.active && tool.activeClass
                ? tool.activeClass
                : `text-slate-500 ${tool.hoverClass}`
            }`}
          >
            <tool.icon size={15} />
            <span className="text-[7px] font-semibold leading-none">{tool.label}</span>
          </button>
        ))}

        <div className="mx-1.5 h-px bg-slate-200" />

        {/* Secondary tools */}
        {([
          {
            icon: Eye,
            label: "FPS",
            active: fpsMode,
            onClick: () => setFpsMode((p) => !p),
            activeClass: "bg-indigo-500 text-white shadow-sm shadow-indigo-200",
            hoverClass: "hover:bg-violet-50 hover:text-violet-600",
          },
          {
            icon: Search,
            label: "Buscar",
            active: false,
            onClick: () => setSearchOpen(true),
            hoverClass: "hover:bg-emerald-50 hover:text-emerald-600",
          },
          {
            icon: Ruler,
            label: "Medir",
            active: distanceMeasuring,
            onClick: () => setDistanceMeasuring((p) => !p),
            activeClass: "bg-red-500 text-white shadow-sm shadow-red-200",
            hoverClass: "hover:bg-red-50 hover:text-red-500",
          },
        ] as const).map((tool) => (
          <button
            key={tool.label}
            onClick={tool.onClick}
            title={tool.label}
            className={`group relative flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
              tool.active && tool.activeClass
                ? tool.activeClass
                : `text-slate-500 ${tool.hoverClass}`
            }`}
          >
            <tool.icon size={15} />
            <span className="text-[7px] font-semibold leading-none">{tool.label}</span>
          </button>
        ))}

        <div className="mx-1.5 h-px bg-slate-200" />

        {/* More tools toggle */}
        <button
          onClick={() => setToolsExpanded((p) => !p)}
          title={toolsExpanded ? "Cerrar" : "Más"}
          className={`group relative flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
            toolsExpanded ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          {toolsExpanded ? <XIcon size={15} /> : <MoreVertical size={15} />}
          <span className="text-[7px] font-semibold leading-none">{toolsExpanded ? "Cerrar" : "Más"}</span>
        </button>
      </div>

      {/* ── Expandable Advanced Tools Popover ──────── */}
      {toolsExpanded && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-16 md:left-14 md:translate-x-0 md:bottom-14 z-30 rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 ring-black/[0.06] backdrop-blur-xl w-[min(240px,90vw)]">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Herramientas Avanzadas</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { key: "iot", icon: "📡", label: "IoT", action: () => { setIotPanelOpen((p) => !p); setFeatureToggles((p) => ({ ...p, iot: !p.iot })); } },
              { key: "labor", icon: "👷", label: "Personal", action: () => { setLaborPanelOpen((p) => !p); setFeatureToggles((p) => ({ ...p, operators: !p.operators })); } },
              { key: "waves", icon: "📋", label: "Waves", action: () => setWavePanelOpen((p) => !p) },
              { key: "alerts", icon: "🔔", label: "Alertas", action: () => { setAlertFeedOpen((p) => !p); setFeatureToggles((p) => ({ ...p, alerts: !p.alerts })); } },
              { key: "capacity", icon: "📐", label: "Capacidad", action: () => setCapacityPanelOpen((p) => !p) },
              { key: "slotting", icon: "🧩", label: "Slotting", action: () => setSlottingPanelOpen((p) => !p) },
              { key: "tour", icon: "🎯", label: "Tour", action: () => { setGuidedTourActive((p) => !p); setToolsExpanded(false); } },
              { key: "nav", icon: "🏗", label: "Almacenes", action: () => { setWarehouseNavOpen((p) => !p); setToolsExpanded(false); } },
            ].map((tool) => (
              <button
                key={tool.key}
                onClick={tool.action}
                className="flex flex-col items-center gap-1 rounded-xl p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm"
              >
                <span className="text-lg">{tool.icon}</span>
                <span className="text-[8px] font-semibold">{tool.label}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Modo de Vista</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "normal" as const, label: "Normal", icon: "🏭" },
                { id: "heatmap" as const, label: "Calor", icon: "🔥" },
                { id: "aging" as const, label: "Antigüedad", icon: "📅" },
                { id: "abc" as const, label: "ABC", icon: "🏷" },
                { id: "hazardous" as const, label: "Peligros", icon: "☣" },
                { id: "cycle_count" as const, label: "Conteo", icon: "🔢" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
                    viewMode === mode.id ? "bg-indigo-500 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3 mt-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Capas 3D</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "labels", label: "Labels AR", icon: "🏷" },
                { key: "dock", label: "Muelle", icon: "🚚" },
                { key: "crossdock", label: "Cross-Dock", icon: "🔄" },
                { key: "coldFog", label: "Frío", icon: "❄" },
              ].map((layer) => (
                <button
                  key={layer.key}
                  onClick={() => handleToggleFeature(layer.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
                    featureToggles[layer.key] ? "bg-indigo-500 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {layer.icon} {layer.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FPS Mode HUD ──────────── */}
      {fpsMode && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-indigo-500/90 px-3 py-1 text-[10px] font-semibold text-white shadow-md backdrop-blur">
          WASD / Flechas para volar · Mouse para mirar · E/Space subir · Q bajar · ESC para salir
        </div>
      )}

      {/* ── MiniMap hover zone + rendering ── */}
      <div
        className="absolute right-0 top-0 h-28 w-36"
        onMouseEnter={() => setMinimapHover(true)}
        onMouseLeave={() => setMinimapHover(false)}
      >
        <MiniMap racks={racks} visible={minimapHover || isFullscreen} />
      </div>

      {/* ── Box Detail Drawer ──────────── */}
      {selectedBox?.inventory && (
        <BoxDetailDrawer
          inventory={selectedBox.inventory}
          rackCode={selectedBox.rackCode}
          posRow={selectedBox.row}
          posCol={selectedBox.col}
          onClose={() => setSelectedBox(null)}
        />
      )}

      {/* ── Rack Panel (position grid + inventory list) ──────── */}
      {selectedRack && !selectedBox && (
        <RackPanel
          rackCode={selectedRack.code}
          positions={selectedRack.rack_positions}
          rows={selectedRack.rows}
          columns={selectedRack.columns}
          occupancy={
            selectedRack.rack_positions.filter((p) => p.status !== "empty").length /
            (selectedRack.rows * selectedRack.columns || 1)
          }
          onClose={() => {
            setSelectedRack(null);
            setSelectedRackId(null);
          }}
          onPositionClick={(pos) => {
            if (pos.inventory) {
              setSelectedBox({
                inventory: pos.inventory,
                rackCode: selectedRack.code,
                row: pos.row_number,
                col: pos.column_number,
              });
              setSelectedRack(null);
            }
          }}
        />
      )}

      {/* ── Distance Measuring HUD ──────── */}
      {distanceMeasuring && (
        <div className="absolute left-1/2 bottom-16 -translate-x-1/2 rounded-lg bg-red-500/90 px-3 py-1 text-[10px] font-semibold text-white shadow-md backdrop-blur">
          📏 Haz clic en 2 puntos para medir distancia · Click para reiniciar
        </div>
      )}

      {/* ── Search Overlay ──────────── */}
      <WarehouseSearch
        items={searchItems}
        onSelect={handleSearchSelect}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* ── Product Locator ──────────── */}
      <ProductLocator
        items={locatorItems}
        onLocate={handleLocateProduct}
        isOpen={locatorOpen}
        onClose={() => setLocatorOpen(false)}
      />

      {/* ── AI Recommendations Panel ──────────── */}
      {aiPanelOpen && (
        <div className="absolute right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1.27c.35-.6 1-1 1.73-1a2 2 0 110 4c-.74 0-1.39-.4-1.73-1H20a7 7 0 01-7 7v1.27c.6.34 1 .99 1 1.73a2 2 0 11-4 0c0-.74.4-1.39 1-1.73V23a7 7 0 01-7-7H2.73c-.34.6-.99 1-1.73 1a2 2 0 110-4c.74 0 1.39.4 1.73 1H4a7 7 0 017-7V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Insights</h3>
            </div>
            <button onClick={() => setAiPanelOpen(false)} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {aiLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="text-xs">La IA está analizando {racks.length} racks...</p>
            </div>
          ) : aiRecs ? (
            <div className="flex-1 overflow-y-auto">
              {/* Summary */}
              <div className="border-b border-[var(--border)] bg-violet-500/5 px-4 py-3">
                <p className="text-xs text-[var(--text-secondary)]">{aiRecs.summary}</p>
              </div>
              {/* Recommendations */}
              <div className="space-y-2 p-3">
                {aiRecs.recommendations.map((rec, i) => {
                  const typeIcons: Record<string, string> = {
                    reubicacion: "🔄",
                    alerta_vencimiento: "⚠️",
                    optimizacion_espacio: "📐",
                    reabastecimiento: "📦",
                  };
                  const impactColors: Record<string, string> = {
                    alto: "bg-red-500/10 text-red-600",
                    medio: "bg-amber-500/10 text-amber-600",
                    bajo: "bg-blue-500/10 text-blue-600",
                  };
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const rack = racks.find((r) => r.code === rec.rackCode);
                        if (rack) {
                          handleRackSelect(rack);
                          setAiPanelOpen(false);
                        }
                      }}
                      className="w-full rounded-lg bg-[var(--bg-muted)]/40 p-3 text-left transition-colors hover:bg-[var(--bg-muted)]"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">{typeIcons[rec.type] || "💡"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-semibold text-[var(--text-primary)]">{rec.title}</p>
                            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${impactColors[rec.impactLevel] || impactColors.bajo}`}>
                              {rec.impactLevel.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-[var(--text-muted)] leading-relaxed">{rec.description}</p>
                          <p className="mt-1 text-[9px] text-violet-500 font-medium">📍 Rack {rec.rackCode}{rec.productSku ? ` · ${rec.productSku}` : ""} →</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Advanced HUD Panels ──────────── */}
      <IoTDashboardPanel sensors={sensors} isOpen={iotPanelOpen} onClose={() => setIotPanelOpen(false)} />
      <LaborPanel operators={operators} isOpen={laborPanelOpen} onClose={() => setLaborPanelOpen(false)} />
      <WaveManagementPanel orders={pickingOrders} isOpen={wavePanelOpen} onClose={() => setWavePanelOpen(false)} onActivatePicking={handleActivatePicking} />
      <AlertFeed racks={racks} sensors={sensors} isOpen={alertFeedOpen} onClose={() => setAlertFeedOpen(false)} />
      <CapacityPlanningPanel racks={racks} isOpen={capacityPanelOpen} onClose={() => setCapacityPanelOpen(false)} />
      <SlottingOptimizerPanel racks={racks} isOpen={slottingPanelOpen} onClose={() => setSlottingPanelOpen(false)} />
      <GuidedTourOverlay
        racks={racks}
        active={guidedTourActive}
        onNavigate={(idx) => {
          const rack = racks[idx];
          if (rack) handleRackSelect(rack);
        }}
        onEnd={() => {
          setGuidedTourActive(false);
          // Cleanup all tutorial effects
          setViewMode("normal");
          setFpsMode(false);
          setSearchOpen(false);
          setCameraTarget(null);
          setSelectedRackId(null);
        }}
        onAction={(action, value) => {
          // Real-time activation of features for each tutorial step
          switch (action) {
            case "overview":
              // Reset camera to default orbital position
              setCameraTarget(null);
              setSelectedRackId(null);
              setSelectedBox(null);
              setFpsMode(false);
              setSearchOpen(false);
              setToolsExpanded(false);
              break;
            case "zoom":
              // No automatic action — just instruction
              break;
            case "selectRack":
              // Auto-select first rack to demonstrate
              if (racks[0]) handleRackSelect(racks[0]);
              break;
            case "search":
              setSearchOpen(true);
              break;
            case "heatmap":
              setViewMode("heatmap");
              break;
            case "showTools":
              setToolsExpanded(true);
              break;
            case "fps":
              if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                setFpsMode(true);
              }
              break;
            case "screenshot":
              // Just explanation — no action needed
              break;
            case "cleanup":
              // Reset when leaving a step
              if (value === "selectRack") {
                setSelectedRackId(null);
                setCameraTarget(null);
              }
              if (value === "search") setSearchOpen(false);
              if (value === "heatmap") setViewMode("normal");
              if (value === "showTools") setToolsExpanded(false);
              if (value === "fps") setFpsMode(false);
              break;
          }
        }}
      />
      <WarehouseComparisonPanel
        warehouses={allWarehouses}
        isOpen={warehouseNavOpen}
        onClose={() => setWarehouseNavOpen(false)}
        onNavigate={(whId) => {
          // Navigate to different warehouse page
          window.location.href = `/almacenes?warehouse=${whId}`;
        }}
      />

      {/* ViewModeToolbar removed — integrated into expandable tools menu */}

      {/* ── Picking Path HUD ──────────── */}
      {pickingPath.length > 0 && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-emerald-500/90 px-3 py-1.5 shadow-md backdrop-blur z-20">
          <span className="text-[10px] font-semibold text-white">🗺 Ruta de Picking Activa · {pickingPath.length - 2} paradas</span>
          <button onClick={() => setPickingPath([])} className="rounded bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-white/30">✕ Cerrar</button>
        </div>
      )}
    </div>
  );
}

