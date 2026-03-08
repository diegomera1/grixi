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
import { BoxDetailDrawer } from "./box-detail-drawer";
import { WarehouseSearch } from "./warehouse-search";
import type { SearchableItem } from "./warehouse-search";

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
  electronics: 0x2563eb,
  packaging: 0xe2e8f0,
  raw: 0xc2956b,
  chemical: 0xeab308,
  finished: 0xd4a574,
  mechanical: 0x94a3b8,
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

// ─── Dust Particles ─────────────────────────────────────

function DustParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 150;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 28,
        y: Math.random() * 6 + 0.5,
        z: (Math.random() - 0.5) * 18,
        speed: Math.random() * 0.3 + 0.1,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const o = offsets[i];
      dummy.position.set(
        o.x + Math.sin(t * o.speed + o.phase) * 0.3,
        o.y + Math.sin(t * o.speed * 0.5 + o.phase) * 0.15,
        o.z + Math.cos(t * o.speed + o.phase) * 0.2
      );
      dummy.scale.setScalar(0.008 + Math.sin(t + o.phase) * 0.003);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#D4D4D8" transparent opacity={0.3} depthWrite={false} />
    </instancedMesh>
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

      {/* ── Industrial Gate (front wall, roller shutter) ────── */}
      <group position={[0, 0, D / 2]}>
        {/* Gate frame */}
        <mesh position={[-2.2, H / 2 - 0.5, 0]}>
          <boxGeometry args={[0.15, H - 1, 0.15]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[2.2, H / 2 - 0.5, 0]}>
          <boxGeometry args={[0.15, H - 1, 0.15]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Roller shutter (half open) */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={`shutter-${i}`} position={[0, H - 1.5 - i * 0.15, 0]}>
            <boxGeometry args={[4.2, 0.12, 0.03]} />
            <meshStandardMaterial color="#9CA3AF" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
        {/* PVC strip curtain (hanging) */}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={`pvc-${i}`} position={[-2 + i * 0.36, 1.5, 0.05]}>
            <boxGeometry args={[0.08, 3, 0.005]} />
            <meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* ── Floor signage ────── */}
      {/* CARGA zone */}
      <mesh position={[-8, 0.005, D / 2 - 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 2.5]} />
        <meshBasicMaterial color="#22C55E" transparent opacity={0.08} />
      </mesh>
      <Text position={[-8, 0.008, D / 2 - 2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#22C55E" anchorX="center" anchorY="middle">
        CARGA
      </Text>

      {/* DESCARGA zone */}
      <mesh position={[8, 0.005, D / 2 - 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 2.5]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.08} />
      </mesh>
      <Text position={[8, 0.008, D / 2 - 2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#3B82F6" anchorX="center" anchorY="middle">
        DESCARGA
      </Text>

      {/* Evacuation arrows on floor */}
      {[[-14, 0], [-14, 4], [14, 0], [14, 4]].map(([x, z], i) => (
        <Text key={`evac-${i}`} position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, z > 2 ? Math.PI : 0]} fontSize={0.2} color="#22C55E" anchorX="center" anchorY="middle">
          ▶ SALIDA
        </Text>
      ))}

      {/* ── Volumetric light cones from ceiling ────── */}
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 3 }, (_, col) => {
          const lx = -W / 3 + col * (W / 3);
          const lz = -D / 2 + 3 + row * 5;
          return (
            <mesh key={`cone-${row}-${col}`} position={[lx, H / 2 - 0.2, lz]}>
              <coneGeometry args={[1.2, H - 0.5, 8, 1, true]} />
              <meshBasicMaterial color="#FFFDE7" transparent opacity={0.02} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          );
        })
      )}

      {/* ── Dust Particles ────── */}
      <DustParticles />
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
  onBoxClick,
}: {
  rack: Rack;
  rackIndex: number;
  totalRacks: number;
  onSelect: () => void;
  isSelected: boolean;
  textures: ReturnType<typeof useWarehouseTextures>;
  onBoxClick?: (pos: Position, rackCode: string) => void;
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

      {/* Inventory boxes with category-based textures */}
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

        // Category-based texture selection
        const category = pos.inventory?.category || "";
        const texKey = CATEGORY_TEXTURE_MAP[category] || "finished";
        const catTex = textures.categoryTextures[texKey];
        const catColor = CATEGORY_COLORS[texKey] || 0xd4a574;

        const isExpired = st === "expired";
        const isQuarantine = st === "quarantine";
        const isReserved = st === "reserved";
        const baseColor = isExpired ? 0xef4444 : isQuarantine ? 0xa855f7 : isReserved ? 0x3b82f6 : catColor;

        // Use category texture for normal items, no texture for status-colored items
        const boxTex = (isExpired || isQuarantine || isReserved) ? undefined : catTex;

        return (
          <group key={pos.id} position={[cx, cy, 0]}>
            <mesh
              castShadow
              onClick={(e) => {
                e.stopPropagation();
                onBoxClick?.(pos, rack.code);
              }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <boxGeometry args={[cw * 0.7, ch * 0.45, rD * 0.55]} />
              <meshStandardMaterial
                map={boxTex}
                color={baseColor}
                roughness={0.75}
                metalness={isExpired ? 0.1 : 0.05}
                emissive={isExpired ? 0xef4444 : 0x000000}
                emissiveIntensity={isExpired ? 0.3 : 0}
              />
            </mesh>
            {/* SKU label on box face */}
            {pos.inventory?.product_sku && (
              <Text
                position={[0, 0, rD * 0.28 + 0.001]}
                fontSize={0.035}
                color={isExpired ? "#FCA5A5" : "#1F2937"}
                anchorX="center"
                anchorY="middle"
                maxWidth={cw * 0.6}
              >
                {pos.inventory.product_sku}
              </Text>
            )}
          </group>
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

// ─── FPS Controls ───────────────────────────────────────

function FPSControls({ active }: { active: boolean }) {
  const { camera, gl } = useThree();
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!active) return;
    camera.position.set(0, 1.7, 8);
    euler.current.setFromQuaternion(camera.quaternion);

    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      euler.current.y -= e.movementX * 0.002;
      euler.current.x -= e.movementY * 0.002;
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x));
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
    };
  }, [active, camera, gl]);

  useFrame((_, delta) => {
    if (!active) return;
    const speed = 5 * delta;
    const dir = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0));

    velocity.current.set(0, 0, 0);
    if (keys.current["KeyW"]) velocity.current.add(dir.multiplyScalar(speed));
    if (keys.current["KeyS"]) velocity.current.add(dir.multiplyScalar(-speed));
    if (keys.current["KeyA"]) velocity.current.add(right.multiplyScalar(-speed));
    if (keys.current["KeyD"]) velocity.current.add(right.multiplyScalar(speed));

    camera.position.add(velocity.current);
    camera.position.y = 1.7;
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

  return (
    <group position={[14, 6.5, -8]}>
      {/* Background panel */}
      <mesh>
        <planeGeometry args={[3.5, 2.2]} />
        <meshBasicMaterial color="#0F172A" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Title */}
      <Text position={[0, 0.85, 0.01]} fontSize={0.14} color="#94A3B8" anchorX="center" anchorY="middle">
        OCUPACIÓN POR RACK
      </Text>

      {/* Overall percentage */}
      <Text position={[0, 0.6, 0.01]} fontSize={0.22} color={pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981"} anchorX="center" anchorY="middle" font={undefined}>
        {pct}% Ocupado
      </Text>

      {/* Mini rack bars */}
      {racks.slice(0, 10).map((rack, i) => {
        const rTotal = rack.rack_positions.length;
        const rOcc = rack.rack_positions.filter((p) => p.status !== "empty").length;
        const ratio = rTotal > 0 ? rOcc / rTotal : 0;
        const y = 0.35 - i * 0.18;
        const barW = 1.8;

        return (
          <group key={rack.id} position={[-0.6, y, 0.01]}>
            <Text position={[-0.6, 0, 0]} fontSize={0.07} color="#94A3B8" anchorX="right" anchorY="middle">
              {rack.code}
            </Text>
            {/* BG bar */}
            <mesh position={[barW / 2 - 0.45, 0, 0]}>
              <planeGeometry args={[barW, 0.08]} />
              <meshBasicMaterial color="#1E293B" />
            </mesh>
            {/* Fill bar */}
            <mesh position={[(barW * ratio) / 2 - 0.45, 0, 0.001]}>
              <planeGeometry args={[barW * ratio, 0.08]} />
              <meshBasicMaterial color={ratio > 0.8 ? "#EF4444" : ratio > 0.5 ? "#F59E0B" : "#10B981"} />
            </mesh>
            <Text position={[barW - 0.35, 0, 0]} fontSize={0.06} color="#CBD5E1" anchorX="left" anchorY="middle">
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
}: {
  racks: Rack[];
  selectedRackId: string | null;
  onRackSelect: (rack: Rack) => void;
  cameraTarget: THREE.Vector3 | null;
  simulating: boolean;
  onBoxClick?: (pos: Position, rackCode: string) => void;
  fpsMode?: boolean;
  distanceMeasuring?: boolean;
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
          onBoxClick={onBoxClick}
        />
      ))}
      {cameraTarget && <CameraController target={cameraTarget} />}

      {!fpsMode && (
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
      )}
      {fpsMode && <FPSControls active={fpsMode} />}
      <DistanceTool active={distanceMeasuring || false} />
      <FloatingDashboard racks={racks} />
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fpsMode, setFpsMode] = useState(false);
  const [minimapHover, setMinimapHover] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [distanceMeasuring, setDistanceMeasuring] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setRacks(initialRacks);
  }, [initialRacks]);

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

  // Screenshot
  const takeScreenshot = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `almacen-${warehouse.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, [warehouse.name]);

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
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
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
    <div ref={containerRef} className={`relative w-full overflow-hidden rounded-xl border border-slate-200 ${isFullscreen ? 'h-screen' : 'h-full'}`}>
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

      {/* ── Tool buttons ──────────── */}
      <div className="absolute left-3 bottom-14 flex flex-col gap-1">
        {/* Screenshot */}
        <button
          onClick={takeScreenshot}
          title="Exportar captura HD"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-500 shadow-md ring-1 ring-black/5 transition-all hover:bg-indigo-50 hover:text-indigo-600"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M9 3h6" /></svg>
        </button>
        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-500 shadow-md ring-1 ring-black/5 transition-all hover:bg-indigo-50 hover:text-indigo-600"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isFullscreen ? (
              <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
            ) : (
              <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
            )}
          </svg>
        </button>
        {/* FPS Mode */}
        <button
          onClick={() => setFpsMode((p) => !p)}
          title={fpsMode ? "Salir de primera persona (ESC)" : "Vista primera persona (WASD)"}
          className={`flex h-7 w-7 items-center justify-center rounded-lg shadow-md ring-1 ring-black/5 transition-all ${
            fpsMode ? "bg-indigo-500 text-white" : "bg-white/95 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
        {/* Distance Measure */}
        <button
          onClick={() => setDistanceMeasuring((p) => !p)}
          title={distanceMeasuring ? "Desactivar medición" : "Medir distancia"}
          className={`flex h-7 w-7 items-center justify-center rounded-lg shadow-md ring-1 ring-black/5 transition-all ${
            distanceMeasuring ? "bg-red-500 text-white" : "bg-white/95 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z" /><path d="M14.5 12.5l2-2" /><path d="M11.5 9.5l2-2" /></svg>
        </button>
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          title="Buscar inventario (⌘K)"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-500 shadow-md ring-1 ring-black/5 transition-all hover:bg-indigo-50 hover:text-indigo-600"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </button>
      </div>

      {/* ── FPS Mode HUD ──────────── */}
      {fpsMode && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-indigo-500/90 px-3 py-1 text-[10px] font-semibold text-white shadow-md backdrop-blur">
          WASD para caminar · Mouse para mirar · ESC para salir
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
    </div>
  );
}
