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
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";

// ─── Types ──────────────────────────────────────────────

type Position = {
  id: string;
  row_number: number;
  column_number: number;
  status: string;
  inventory: {
    product_name: string;
    product_sku: string;
    quantity: number;
    lot_number: string | null;
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

// ─── Texture Hook ───────────────────────────────────────

function useWarehouseTextures() {
  const [concrete, metal, wall, cardboard, wood] = useLoader(
    THREE.TextureLoader,
    [
      "/textures/concrete.png",
      "/textures/metal.png",
      "/textures/wall.png",
      "/textures/cardboard.png",
      "/textures/wood.png",
    ]
  );

  useMemo(() => {
    // Floor tiling
    concrete.wrapS = THREE.RepeatWrapping;
    concrete.wrapT = THREE.RepeatWrapping;
    concrete.repeat.set(8, 5);

    // Wall tiling
    wall.wrapS = THREE.RepeatWrapping;
    wall.wrapT = THREE.RepeatWrapping;
    wall.repeat.set(10, 2);

    // Metal tiling
    metal.wrapS = THREE.RepeatWrapping;
    metal.wrapT = THREE.RepeatWrapping;
    metal.repeat.set(1, 3);

    // Wood tiling
    wood.wrapS = THREE.RepeatWrapping;
    wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(2, 2);

    // Cardboard tiling
    cardboard.wrapS = THREE.RepeatWrapping;
    cardboard.wrapT = THREE.RepeatWrapping;
    cardboard.repeat.set(1, 1);
  }, [concrete, metal, wall, cardboard, wood]);

  return { concrete, metal, wall, cardboard, wood };
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

function WarehouseBuilding({ textures }: { textures: ReturnType<typeof useWarehouseTextures> }) {
  const W = 32;
  const D = 20;
  const H = 7;

  return (
    <group>
      {/* ── Floor with concrete texture ────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial
          map={textures.concrete}
          roughness={0.85}
          metalness={0.02}
        />
      </mesh>

      {/* ── Floor markings (yellow safety lines) ────── */}
      {[-8, -4, 0, 4, 8].map((x) =>
        Array.from({ length: 14 }, (_, j) => (
          <mesh
            key={`al-${x}-${j}`}
            position={[x, 0.004, -D / 2 + 1 + j * 1.4]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.07, 0.8]} />
            <meshBasicMaterial color="#EAB308" transparent opacity={0.35} />
          </mesh>
        ))
      )}

      {/* Epoxy zone rectangles */}
      {[[-13, -5, 4, 3], [-13, 4, 4, 3], [11, -5, 4, 3], [11, 4, 4, 3]].map(
        ([x, z, w, d], i) => (
          <mesh
            key={`zone-${i}`}
            position={[x, 0.003, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial color="#3B82F6" transparent opacity={0.05} />
          </mesh>
        )
      )}

      {/* ── Back wall with corrugated texture ────── */}
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
        <meshStandardMaterial
          map={textures.wall}
          roughness={0.8}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial
          map={textures.wall}
          roughness={0.8}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* NO CEILING — open top for visibility */}

      {/* ── Roof beams (structural, visible from top) ────── */}
      {Array.from({ length: 5 }, (_, i) => {
        const z = -D / 2 + 2 + i * (D / 5);
        return (
          <mesh key={`beam-${i}`} position={[0, H - 0.15, z]}>
            <boxGeometry args={[W, 0.22, 0.16]} />
            <meshStandardMaterial
              map={textures.metal}
              color="#94A3B8"
              metalness={0.65}
              roughness={0.25}
            />
          </mesh>
        );
      })}

      {/* Cross beams */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={`xbeam-${i}`} position={[-W / 4 + i * (W / 3), H - 0.15, 0]}>
          <boxGeometry args={[0.12, 0.18, D]} />
          <meshStandardMaterial
            map={textures.metal}
            color="#94A3B8"
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>
      ))}

      {/* ── Columns ────── */}
      {[-W / 2 + 0.2, W / 2 - 0.2].map((x) =>
        Array.from({ length: 3 }, (_, j) => (
          <mesh
            key={`col-${x}-${j}`}
            position={[x, H / 2, -D / 2 + 3 + j * (D / 3)]}
          >
            <boxGeometry args={[0.3, H, 0.3]} />
            <meshStandardMaterial
              map={textures.metal}
              color="#78716C"
              metalness={0.5}
              roughness={0.35}
            />
          </mesh>
        ))
      )}

      {/* ── Ceiling Lights ────── */}
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 3 }, (_, col) => {
          const lx = -W / 3 + col * (W / 3);
          const lz = -D / 2 + 3 + row * 5;
          return (
            <group key={`light-${row}-${col}`}>
              <mesh position={[lx, H - 0.35, lz]}>
                <boxGeometry args={[1.8, 0.06, 0.25]} />
                <meshStandardMaterial color="#6B7280" metalness={0.7} roughness={0.2} />
              </mesh>
              <mesh position={[lx, H - 0.39, lz]}>
                <boxGeometry args={[1.5, 0.015, 0.12]} />
                <meshStandardMaterial
                  color="#FEFEFE"
                  emissive="#FEFEFE"
                  emissiveIntensity={0.6}
                  toneMapped={false}
                />
              </mesh>
              <pointLight
                position={[lx, H - 0.6, lz]}
                intensity={0.5}
                distance={10}
                color="#FFF8F0"
                decay={2}
              />
            </group>
          );
        })
      )}

      {/* Forklifts are now animated — rendered separately */}

      {/* ── Pallet stacks with wood texture ────── */}
      {[
        [-12, 2],
        [-12, 5],
        [12, -3],
        [12, 6],
        [-13, -7],
      ].map(([x, z], i) => (
        <group key={`pallet-${i}`} position={[x, 0, z]}>
          {Array.from({ length: 3 }, (_, j) => (
            <mesh key={`pw-${j}`} position={[0, j * 0.15, 0]}>
              <boxGeometry args={[1.2, 0.12, 1.0]} />
              <meshStandardMaterial map={textures.wood} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[1.0, 0.6, 0.8]} />
            <meshStandardMaterial map={textures.cardboard} roughness={0.8} />
          </mesh>
          {i % 2 === 0 && (
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[0.9, 0.4, 0.75]} />
              <meshStandardMaterial map={textures.cardboard} color="#D4A574" roughness={0.8} />
            </mesh>
          )}
        </group>
      ))}

      {/* ── Fire extinguisher ────── */}
      <group position={[-W / 2 + 0.3, 0, -2]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.5, 12]} />
          <meshStandardMaterial color="#DC2626" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.08, 8]} />
          <meshStandardMaterial color="#1F2937" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* ── Barrel ────── */}
      <group position={[-W / 2 + 1, 0, 5]}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.25, 0.22, 0.8, 16]} />
          <meshStandardMaterial color="#1E40AF" roughness={0.6} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Single Rack (textured) ─────────────────────────────

function Rack3D({
  rack,
  rackIndex,
  totalRacks,
  onSelect,
  isSelected,
  textures,
}: {
  rack: Rack;
  rackIndex: number;
  totalRacks: number;
  onSelect: () => void;
  isSelected: boolean;
  textures: ReturnType<typeof useWarehouseTextures>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Layout in aisles
  const racksPerAisle = Math.ceil(totalRacks / 4);
  const aisleIdx = Math.floor(rackIndex / racksPerAisle);
  const posInAisle = rackIndex % racksPerAisle;
  const aisleZ = -7 + aisleIdx * 4.5;
  const side = posInAisle % 2 === 0 ? -1 : 1;
  const col = Math.floor(posInAisle / 2);
  const px = -10 + col * 3.2;
  const pz = aisleZ + side * 1.2;

  const rW = rack.columns * 0.5;
  const rH = rack.rows * 0.45 + 0.3;
  const rD = 0.5;

  const isActive = hovered || isSelected;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = hovered ? 0.03 : 0;
    groupRef.current.position.y +=
      (targetY - groupRef.current.position.y) * delta * 10;
  });

  const occupiedCount = rack.rack_positions.filter(
    (p) => p.status === "occupied"
  ).length;
  const totalSlots = rack.rows * rack.columns;
  const occupancy = totalSlots > 0 ? occupiedCount / totalSlots : 0;

  return (
    <group
      ref={groupRef}
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

      {/* Base plate with metal texture */}
      <mesh position={[0, 0.015, 0]} castShadow>
        <boxGeometry args={[rW + 0.1, 0.03, rD + 0.1]} />
        <meshStandardMaterial
          map={textures.metal}
          color={isActive ? 0x818cf8 : 0x94a3b8}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>

      {/* 4 upright posts with metal texture */}
      {[-1, 1].map((xD) =>
        [-1, 1].map((zD) => (
          <group
            key={`post-${xD}-${zD}`}
            position={[(xD * rW) / 2, 0, (zD * rD) / 2]}
          >
            <mesh position={[0, rH / 2, 0]} castShadow>
              <boxGeometry args={[0.04, rH, 0.04]} />
              <meshStandardMaterial
                map={textures.metal}
                color={isActive ? 0x6366f1 : 0x64748b}
                metalness={0.75}
                roughness={0.2}
              />
            </mesh>
            {/* Footing */}
            <mesh position={[0, 0.01, 0]}>
              <boxGeometry args={[0.1, 0.02, 0.1]} />
              <meshStandardMaterial
                map={textures.metal}
                color={0x475569}
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
            {/* Bolt holes (decorative dots) */}
            {Array.from({ length: Math.floor(rH / 0.3) }, (_, k) => (
              <mesh
                key={`bolt-${k}`}
                position={[0.022, 0.15 + k * 0.3, 0]}
              >
                <sphereGeometry args={[0.006, 6, 6]} />
                <meshStandardMaterial color={0x374151} metalness={0.8} roughness={0.2} />
              </mesh>
            ))}
          </group>
        ))
      )}

      {/* Horizontal beams per level with metal texture */}
      {Array.from({ length: rack.rows + 1 }, (_, i) => {
        const y = 0.03 + (i / rack.rows) * (rH - 0.03);
        return (
          <group key={`lvl-${i}`}>
            {/* Front beam (orange like real warehouse) */}
            <mesh position={[0, y, rD / 2]} castShadow>
              <boxGeometry args={[rW + 0.04, 0.04, 0.03]} />
              <meshStandardMaterial
                color={isActive ? 0xa5b4fc : 0xf97316}
                metalness={0.4}
                roughness={0.4}
              />
            </mesh>
            {/* Back beam */}
            <mesh position={[0, y, -rD / 2]} castShadow>
              <boxGeometry args={[rW + 0.04, 0.04, 0.03]} />
              <meshStandardMaterial
                color={isActive ? 0xa5b4fc : 0xf97316}
                metalness={0.4}
                roughness={0.4}
              />
            </mesh>
            {/* Wire deck shelf */}
            <mesh position={[0, y + 0.018, 0]} receiveShadow>
              <boxGeometry args={[rW, 0.012, rD - 0.04]} />
              <meshStandardMaterial
                map={textures.metal}
                color={isActive ? 0xc7d2fe : 0xd1d5db}
                metalness={0.3}
                roughness={0.5}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Wire grid lines on shelf */}
            {Array.from({ length: Math.floor(rW / 0.08) }, (_, wi) => (
              <mesh
                key={`wire-${i}-${wi}`}
                position={[-rW / 2 + 0.04 + wi * 0.08, y + 0.02, 0]}
              >
                <boxGeometry args={[0.003, 0.003, rD - 0.06]} />
                <meshBasicMaterial color={0xA1A1AA} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* X-bracing on back */}
      <mesh
        position={[0, rH / 2, -rD / 2 + 0.01]}
        rotation={[0, 0, Math.atan2(rH, rW)]}
      >
        <boxGeometry
          args={[Math.sqrt(rW * rW + rH * rH) * 0.95, 0.012, 0.012]}
        />
        <meshStandardMaterial color={0xf97316} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, rH / 2, -rD / 2 + 0.01]}
        rotation={[0, 0, -Math.atan2(rH, rW)]}
      >
        <boxGeometry
          args={[Math.sqrt(rW * rW + rH * rH) * 0.95, 0.012, 0.012]}
        />
        <meshStandardMaterial color={0xf97316} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Inventory boxes with cardboard texture */}
      {rack.rack_positions.map((pos) => {
        const cw = rW / rack.columns;
        const ch = (rH - 0.03) / rack.rows;
        const cx = (pos.column_number - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.03 + (pos.row_number - 1) * ch + ch * 0.35;

        const st =
          pos.inventory?.status === "expired"
            ? "expired"
            : pos.inventory?.status === "quarantine"
            ? "quarantine"
            : pos.status;

        if (st === "empty") return null;

        const color = STATUS_COLORS[st] || 0xd4d4d8;
        const useCardboard = st === "occupied" || st === "active";

        return (
          <mesh key={pos.id} position={[cx, cy, 0]} castShadow>
            <boxGeometry args={[cw * 0.7, ch * 0.45, rD * 0.55]} />
            <meshStandardMaterial
              map={useCardboard ? textures.cardboard : undefined}
              color={color}
              roughness={0.75}
              metalness={0.05}
            />
          </mesh>
        );
      })}

      {/* Label */}
      <Text
        position={[0, rH + 0.15, 0]}
        fontSize={0.15}
        color={isActive ? "#4338CA" : "#64748B"}
        anchorX="center"
        anchorY="middle"
      >
        {rack.code}
      </Text>
      <Text
        position={[0, rH + 0.02, 0]}
        fontSize={0.08}
        color={occupancy > 0.8 ? "#D97706" : "#94A3B8"}
        anchorX="center"
        anchorY="middle"
      >
        {`${occupiedCount}/${totalSlots} · ${Math.round(occupancy * 100)}%`}
      </Text>

      {/* Tooltip */}
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
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
              whiteSpace: "nowrap",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
              Rack {rack.code}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#64748B",
                marginTop: 3,
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 4,
                  background: "#E2E8F0",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${occupancy * 100}%`,
                    height: "100%",
                    background: occupancy > 0.8 ? "#F59E0B" : "#22C55E",
                    borderRadius: 2,
                  }}
                />
              </div>
              <span>{Math.round(occupancy * 100)}%</span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span>
                {occupiedCount}/{totalSlots}
              </span>
            </div>
            {rack.aisle && (
              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                Pasillo {rack.aisle}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

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

function SceneContent({
  racks,
  selectedRackId,
  onRackSelect,
  cameraTarget,
  simulating,
}: {
  racks: Rack[];
  selectedRackId: string | null;
  onRackSelect: (rack: Rack) => void;
  cameraTarget: THREE.Vector3 | null;
  simulating: boolean;
}) {
  const textures = useWarehouseTextures();

  return (
    <>
      <ambientLight intensity={0.3} color="#F0F4FF" />
      <directionalLight
        position={[12, 18, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={40}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight position={[-8, 10, -8]} intensity={0.25} color="#E0E7FF" />
      <hemisphereLight color="#F8FAFC" groundColor="#D1D5DB" intensity={0.35} />

      <WarehouseBuilding textures={textures} />

      {/* Animated forklifts */}
      {[0, 1, 2].map((i) => (
        <AnimatedForklift
          key={`forklift-${i}`}
          pathIndex={i}
          active={simulating}
          metalTex={textures.metal}
        />
      ))}

      {racks.map((rack, i) => (
        <Rack3D
          key={rack.id}
          rack={rack}
          rackIndex={i}
          totalRacks={racks.length}
          isSelected={rack.id === selectedRackId}
          onSelect={() => onRackSelect(rack)}
          textures={textures}
        />
      ))}

      {cameraTarget && <CameraController target={cameraTarget} />}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={3}
        maxDistance={28}
        target={[0, 1.5, 0]}
      />
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRacks(initialRacks);
  }, [initialRacks]);

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
              return {
                ...pos,
                status: ns,
                inventory: {
                  product_name: `Producto ${Math.floor(Math.random() * 100)}`,
                  product_sku: `SKU-${Math.floor(
                    Math.random() * 9000 + 1000
                  )}`,
                  quantity: Math.floor(Math.random() * 500 + 10),
                  lot_number: `LOT-${Math.floor(Math.random() * 900 + 100)}`,
                  status:
                    ns === "expired"
                      ? "expired"
                      : ns === "quarantine"
                      ? "quarantine"
                      : "active",
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
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200">
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
          shadows
          dpr={[1, 1.5]}
          style={{ background: "#E8EDF3" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0xe8edf3);
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
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      {/* ── HUD ──────────── */}
      <div className="absolute left-3 top-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[12px] font-bold text-slate-800">
            {warehouse.name}
          </span>
          <span className="text-[10px] text-slate-400">
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

      <div className="absolute bottom-3 left-3 flex gap-1.5">
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

      <div className="absolute bottom-3 right-3 flex items-center gap-3 rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-black/5">
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
    </div>
  );
}
