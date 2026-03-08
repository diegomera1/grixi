"use client";

import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

// ─── Procedural Textures ────────────────────────────────
// Generate textures via canvas instead of loading from files

function makeConcreteTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base concrete color
  ctx.fillStyle = "#E8ECF0";
  ctx.fillRect(0, 0, size, size);

  // Add noise
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gray = 200 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${gray},${gray + 2},${gray + 5})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Add subtle cracks
  ctx.strokeStyle = "rgba(180,185,190,0.3)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

function makeWallTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#F0F2F5";
  ctx.fillRect(0, 0, size, size);

  // Horizontal panel lines
  for (let y = 0; y < size; y += 32) {
    ctx.strokeStyle = "rgba(200,205,210,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  return tex;
}

function makeMetalTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Brushed metal look
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#B0B8C4");
  gradient.addColorStop(0.5, "#A0A8B4");
  gradient.addColorStop(1, "#B0B8C4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Brush lines
  for (let y = 0; y < size; y += 2) {
    ctx.strokeStyle = `rgba(180,188,196,${0.2 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random());
    ctx.lineTo(size, y + Math.random());
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

// ─── Warehouse Building ─────────────────────────────────

function WarehouseBuilding() {
  const floorTex = useMemo(() => makeConcreteTexture(), []);
  const wallTex = useMemo(() => makeWallTexture(), []);

  const W = 32; // warehouse width
  const D = 20; // warehouse depth
  const H = 7;  // warehouse height

  return (
    <group>
      {/* ── Floor ────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorTex} roughness={0.85} metalness={0.02} />
      </mesh>

      {/* ── Floor markings (aisle lines) ────── */}
      {[-8, -4, 0, 4, 8].map((x) =>
        Array.from({ length: 14 }, (_, j) => (
          <mesh
            key={`al-${x}-${j}`}
            position={[x, 0.003, -D / 2 + 1 + j * 1.4]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.06, 0.8]} />
            <meshBasicMaterial color="#EAB308" transparent opacity={0.25} />
          </mesh>
        ))
      )}

      {/* ── Back wall ────── */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={wallTex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Side walls (partial — open front) ────── */}
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={wallTex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={wallTex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Ceiling (metal roof) ────── */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#D1D5DB" roughness={0.7} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Roof beams ────── */}
      {Array.from({ length: 5 }, (_, i) => {
        const z = -D / 2 + 2 + i * (D / 5);
        return (
          <mesh key={`beam-${i}`} position={[0, H - 0.15, z]}>
            <boxGeometry args={[W, 0.2, 0.15]} />
            <meshStandardMaterial color="#9CA3AF" metalness={0.6} roughness={0.3} />
          </mesh>
        );
      })}

      {/* ── Columns ────── */}
      {[-W / 2 + 0.2, W / 2 - 0.2].map((x) =>
        Array.from({ length: 3 }, (_, j) => (
          <mesh key={`col-${x}-${j}`} position={[x, H / 2, -D / 2 + 3 + j * (D / 3)]}>
            <boxGeometry args={[0.3, H, 0.3]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.4} roughness={0.4} />
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
              {/* Housing */}
              <mesh position={[lx, H - 0.35, lz]}>
                <boxGeometry args={[1.8, 0.06, 0.25]} />
                <meshStandardMaterial color="#6B7280" metalness={0.7} roughness={0.2} />
              </mesh>
              {/* Light strip */}
              <mesh position={[lx, H - 0.39, lz]}>
                <boxGeometry args={[1.5, 0.015, 0.12]} />
                <meshStandardMaterial
                  color="#FEFEFE"
                  emissive="#FEFEFE"
                  emissiveIntensity={0.6}
                  toneMapped={false}
                />
              </mesh>
              {/* Point light */}
              <pointLight
                position={[lx, H - 0.6, lz]}
                intensity={0.6}
                distance={10}
                color="#FFF8F0"
                decay={2}
              />
            </group>
          );
        })
      )}

      {/* ── Forklift (simple geometric) ────── */}
      <group position={[6, 0, 4]} rotation={[0, -0.3, 0]}>
        {/* Body */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.8, 0.5, 1.2]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.7} />
        </mesh>
        {/* Cab */}
        <mesh position={[0, 0.75, -0.15]} castShadow>
          <boxGeometry args={[0.7, 0.4, 0.6]} />
          <meshStandardMaterial color="#FBBF24" roughness={0.6} />
        </mesh>
        {/* Forks */}
        <mesh position={[-0.15, 0.12, 0.8]}>
          <boxGeometry args={[0.06, 0.04, 0.8]} />
          <meshStandardMaterial color="#71717A" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.15, 0.12, 0.8]}>
          <boxGeometry args={[0.06, 0.04, 0.8]} />
          <meshStandardMaterial color="#71717A" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Mast */}
        <mesh position={[0, 0.7, 0.55]}>
          <boxGeometry args={[0.06, 1.1, 0.06]} />
          <meshStandardMaterial color="#71717A" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Wheels */}
        {[[-0.35, -0.45], [0.35, -0.45], [-0.3, 0.4], [0.3, 0.4]].map(([x, z], i) => (
          <mesh key={`w-${i}`} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.08, 12]} />
            <meshStandardMaterial color="#1F2937" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* ── Pallet stack (decoration) ────── */}
      {[[-12, 2], [-12, 5], [12, -3]].map(([x, z], i) => (
        <group key={`pallet-${i}`} position={[x, 0, z]}>
          {Array.from({ length: 3 }, (_, j) => (
            <mesh key={`p-${j}`} position={[0, j * 0.15, 0]}>
              <boxGeometry args={[1.2, 0.12, 1.0]} />
              <meshStandardMaterial color="#D4A574" roughness={0.85} />
            </mesh>
          ))}
          {/* Boxes on pallet */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[1.0, 0.6, 0.8]} />
            <meshStandardMaterial color="#A78BFA" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Single Rack ────────────────────────────────────────

function Rack3D({
  rack,
  rackIndex,
  totalRacks,
  onSelect,
  isSelected,
}: {
  rack: Rack;
  rackIndex: number;
  totalRacks: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const metalTex = useMemo(() => makeMetalTexture(), []);

  // Layout: 2 rows of racks facing each other across aisles
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
      {/* Selection highlight on floor */}
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[rW + 0.6, rD + 0.6]} />
          <meshBasicMaterial color={isSelected ? 0x6366f1 : 0x818cf8} transparent opacity={0.15} />
        </mesh>
      )}

      {/* Base plate */}
      <mesh position={[0, 0.015, 0]} castShadow>
        <boxGeometry args={[rW + 0.1, 0.03, rD + 0.1]} />
        <meshStandardMaterial color={isActive ? 0x818cf8 : 0x94a3b8} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* 4 upright posts — L-shaped angle iron */}
      {[-1, 1].map((xD) =>
        [-1, 1].map((zD) => (
          <group key={`post-${xD}-${zD}`} position={[(xD * rW) / 2, 0, (zD * rD) / 2]}>
            {/* Main post */}
            <mesh position={[0, rH / 2, 0]} castShadow>
              <boxGeometry args={[0.04, rH, 0.04]} />
              <meshStandardMaterial
                map={metalTex}
                color={isActive ? 0x6366f1 : 0x64748b}
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
            {/* Footing plate */}
            <mesh position={[0, 0.01, 0]}>
              <boxGeometry args={[0.1, 0.02, 0.1]} />
              <meshStandardMaterial color={0x475569} metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        ))
      )}

      {/* Horizontal beams (front/back) per level */}
      {Array.from({ length: rack.rows + 1 }, (_, i) => {
        const y = 0.03 + (i / rack.rows) * (rH - 0.03);
        return (
          <group key={`lvl-${i}`}>
            {/* Front beam */}
            <mesh position={[0, y, rD / 2]} castShadow>
              <boxGeometry args={[rW + 0.04, 0.035, 0.03]} />
              <meshStandardMaterial
                map={metalTex}
                color={isActive ? 0xa5b4fc : 0x94a3b8}
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
            {/* Back beam */}
            <mesh position={[0, y, -rD / 2]} castShadow>
              <boxGeometry args={[rW + 0.04, 0.035, 0.03]} />
              <meshStandardMaterial
                map={metalTex}
                color={isActive ? 0xa5b4fc : 0x94a3b8}
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
            {/* Shelf surface (wire deck) */}
            <mesh position={[0, y + 0.015, 0]} receiveShadow>
              <boxGeometry args={[rW, 0.015, rD - 0.04]} />
              <meshStandardMaterial
                color={isActive ? 0xe0e7ff : 0xe2e8f0}
                metalness={0.1}
                roughness={0.7}
                transparent
                opacity={0.85}
              />
            </mesh>
          </group>
        );
      })}

      {/* Diagonal bracing (X pattern on back) */}
      <mesh
        position={[0, rH / 2, -rD / 2 + 0.01]}
        rotation={[0, 0, Math.atan2(rH, rW)]}
      >
        <boxGeometry args={[Math.sqrt(rW * rW + rH * rH) * 0.95, 0.015, 0.015]} />
        <meshStandardMaterial color={0x94a3b8} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, rH / 2, -rD / 2 + 0.01]}
        rotation={[0, 0, -Math.atan2(rH, rW)]}
      >
        <boxGeometry args={[Math.sqrt(rW * rW + rH * rH) * 0.95, 0.015, 0.015]} />
        <meshStandardMaterial color={0x94a3b8} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Inventory boxes */}
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

        return (
          <mesh key={pos.id} position={[cx, cy, 0]} castShadow>
            <boxGeometry args={[cw * 0.7, ch * 0.45, rD * 0.55]} />
            <meshStandardMaterial color={color} roughness={0.75} metalness={0.05} />
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
        position={[0, rH + 0.03, 0]}
        fontSize={0.08}
        color={occupancy > 0.8 ? "#D97706" : "#94A3B8"}
        anchorX="center"
        anchorY="middle"
      >
        {`${occupiedCount}/${totalSlots} · ${Math.round(occupancy * 100)}%`}
      </Text>

      {/* Tooltip */}
      {hovered && (
        <Html position={[0, rH + 0.45, 0]} center style={{ pointerEvents: "none" }}>
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

// ─── Camera Controller ──────────────────────────────────

function CameraController({ target }: { target: THREE.Vector3 | null }) {
  const { camera } = useThree();
  const currentTarget = useRef(new THREE.Vector3(0, 1.5, 0));

  useFrame((_, delta) => {
    if (!target) return;

    // Smoothly move camera to look at selected rack
    currentTarget.current.lerp(target, delta * 3);
    const camTarget = currentTarget.current.clone();
    camTarget.y = Math.max(camTarget.y, 1);

    // Orbit around the target
    const idealPos = camTarget.clone().add(new THREE.Vector3(3, 3, 3));
    camera.position.lerp(idealPos, delta * 2);
    camera.lookAt(currentTarget.current);
  });

  return null;
}

// ─── Scene ──────────────────────────────────────────────

function SceneContent({
  racks,
  selectedRackId,
  onRackSelect,
  cameraTarget,
}: {
  racks: Rack[];
  selectedRackId: string | null;
  onRackSelect: (rack: Rack) => void;
  cameraTarget: THREE.Vector3 | null;
}) {
  return (
    <>
      {/* Ambient */}
      <ambientLight intensity={0.3} color="#F0F4FF" />

      {/* Main directional */}
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

      {/* Hemisphere */}
      <hemisphereLight color="#F8FAFC" groundColor="#D1D5DB" intensity={0.35} />

      {/* Building */}
      <WarehouseBuilding />

      {/* Racks */}
      {racks.map((rack, i) => (
        <Rack3D
          key={rack.id}
          rack={rack}
          rackIndex={i}
          totalRacks={racks.length}
          isSelected={rack.id === selectedRackId}
          onSelect={() => onRackSelect(rack)}
        />
      ))}

      {/* Camera controller for click-to-focus */}
      {cameraTarget && <CameraController target={cameraTarget} />}

      {/* Orbit controls */}
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

export function Warehouse3DScene({ racks: initialRacks, warehouse, onRackSelect }: Props) {
  const [racks, setRacks] = useState(initialRacks);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const [simulating, setSimulating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setRacks(initialRacks); }, [initialRacks]);

  const toggleSimulation = useCallback(() => {
    if (simulating) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
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
              const statuses = ["occupied", "empty", "reserved", "expired", "quarantine"];
              const ns = statuses[Math.floor(Math.random() * statuses.length)];
              if (ns === "empty") return { ...pos, status: ns, inventory: null };
              return {
                ...pos,
                status: ns,
                inventory: {
                  product_name: `Producto ${Math.floor(Math.random() * 100)}`,
                  product_sku: `SKU-${Math.floor(Math.random() * 9000 + 1000)}`,
                  quantity: Math.floor(Math.random() * 500 + 10),
                  lot_number: `LOT-${Math.floor(Math.random() * 900 + 100)}`,
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleRackSelect = useCallback(
    (rack: Rack) => {
      setSelectedRackId(rack.id);
      onRackSelect(rack);
      // Calculate 3D position for camera fly-to
      const racksPerAisle = Math.ceil(initialRacks.length / 4);
      const aisleIdx = Math.floor(initialRacks.indexOf(rack) / racksPerAisle);
      const posInAisle = initialRacks.indexOf(rack) % racksPerAisle;
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
  const occupiedTotal = racks.reduce((s, r) => s + r.rack_positions.filter((p) => p.status === "occupied").length, 0);
  const totalPositions = racks.reduce((s, r) => s + r.rack_positions.length, 0);
  const reservedTotal = racks.reduce((s, r) => s + r.rack_positions.filter((p) => p.status === "reserved").length, 0);
  const expiredTotal = racks.reduce((s, r) => s + r.rack_positions.filter((p) => p.status === "expired" || p.inventory?.status === "expired").length, 0);
  const occupancyPct = totalPositions > 0 ? Math.round((occupiedTotal / totalPositions) * 100) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200">
      <ErrorBoundary
        fallback={
          <div className="flex h-full items-center justify-center bg-slate-50 p-8">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">Error en la escena 3D</p>
              <button onClick={() => window.location.reload()} className="mt-2 rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white">
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
          style={{ background: "#F1F5F9" }}
          onCreated={({ gl }) => { gl.setClearColor(0xf1f5f9); }}
          fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-slate-500">WebGL no disponible</p></div>}
        >
          <Suspense fallback={null}>
            <SceneContent
              racks={racks}
              selectedRackId={selectedRackId}
              onRackSelect={handleRackSelect}
              cameraTarget={cameraTarget}
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      {/* ── HUD ──────────────── */}

      <div className="absolute left-3 top-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[12px] font-bold text-slate-800">{warehouse.name}</span>
          <span className="text-[10px] text-slate-400">{racks.length} racks · {totalPositions} pos</span>
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
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
              Detener Demo
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Simular en Vivo
            </>
          )}
        </button>
      </div>

      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <div className="rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <span className="text-[9px] text-slate-400">🖱 Rotar · ⚡ Zoom · Click rack</span>
        </div>
        <div className="rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-black/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[18px] font-black tabular-nums text-slate-800">{occupancyPct}%</p>
              <p className="text-[8px] font-medium uppercase tracking-wider text-slate-400">Ocupación</p>
            </div>
            <div className="h-8 w-8">
              <svg viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={occupancyPct > 80 ? "#F59E0B" : occupancyPct > 50 ? "#22C55E" : "#3B82F6"} strokeWidth="3" strokeDasharray={`${occupancyPct}, 100`} strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex gap-1.5">
        {[
          { label: "Ocupados", value: occupiedTotal, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Reservados", value: reservedTotal, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Vencidos", value: expiredTotal, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Total", value: totalPositions, color: "text-slate-600", bg: "bg-slate-100" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg ${s.bg} px-2.5 py-1.5 shadow-md ring-1 ring-black/5`}>
            <p className={`text-[12px] font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[8px] font-medium text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-3 rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-black/5">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_HEX[key] }} />
            <span className="text-[9px] font-medium text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
