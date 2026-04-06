"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { Warehouse, MapPin, X as XIcon, Box } from "lucide-react";
import { fetchWarehouseRacksForPreview } from "../actions/stock-hierarchy-actions";
import type { MiniRack, MiniRackPosition } from "../actions/stock-hierarchy-actions";

// ── Types ──────────────────────────────────────────────────
type HighlightedPosition = {
  rack_code: string;
  row_number: number;
  column_number: number;
  su_code: string;
};

type MiniWarehouse3DProps = {
  warehouseId: string;
  warehouseName: string;
  highlightedPositions: HighlightedPosition[];
  focusedRackCode?: string | null;
  contextLabel?: string | null;
};

type SelectedBoxInfo = {
  su_code: string;
  product_name: string | null;
  product_sku: string | null;
  su_type: string | null;
  su_quantity: number | null;
  lot_number: string | null;
  rack_code: string;
  row_number: number;
  column_number: number;
};

// ── Holographic Beacon ─────────────────────────────────────
function HolographicBeacon({ position, color = "#22d3ee" }: { position: [number, number, number]; color?: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const pillarRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.2);
      coreRef.current.rotation.y = t * 2;
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2 + Math.sin(t * 3) * 1;
    }
    if (ring1Ref.current) {
      const s = 1 + ((t * 0.6) % 1) * 2.5;
      ring1Ref.current.scale.set(s, s, 1);
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.7 - ((t * 0.6) % 1) * 0.9);
    }
    if (ring2Ref.current) {
      const s = 1 + (((t * 0.6) + 0.5) % 1) * 2.5;
      ring2Ref.current.scale.set(s, s, 1);
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.7 - (((t * 0.6) + 0.5) % 1) * 0.9);
    }
    if (pillarRef.current) {
      const mat = pillarRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(t * 2) * 0.08;
    }
  });

  return (
    <group position={position}>
      <mesh ref={pillarRef} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.01, 0.05, 1.0, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[0.05, 0.07, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[0.05, 0.07, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={1} distance={2.5} decay={2} />
    </group>
  );
}

// ── Hoverable Inventory Box ───────────────────────────────
function InventoryBox({
  pos,
  rackCode,
  cx,
  cy,
  cw,
  ch,
  rD,
  isTarget,
  isHighlightedRack,
  onSelect,
}: {
  pos: MiniRackPosition;
  rackCode: string;
  cx: number;
  cy: number;
  cw: number;
  ch: number;
  rD: number;
  isTarget: boolean;
  isHighlightedRack: boolean;
  onSelect: (data: SelectedBoxInfo | null) => void;
}) {
  const [active, setActive] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const interactive = isHighlightedRack;

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const next = !active;
    setActive(next);
    if (next && pos.su_code) {
      onSelect({
        su_code: pos.su_code,
        product_name: pos.product_name,
        product_sku: pos.product_sku,
        su_type: pos.su_type,
        su_quantity: pos.su_quantity,
        lot_number: pos.lot_number,
        rack_code: rackCode,
        row_number: pos.row_number,
        column_number: pos.column_number,
      });
    } else {
      onSelect(null);
    }
  }, [interactive, active, pos, rackCode, onSelect]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  }, [interactive]);

  const handlePointerOut = useCallback(() => {
    if (!interactive) return;
    document.body.style.cursor = "auto";
  }, [interactive]);

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const targetEmissive = active ? 0.6 : isTarget ? 0.5 : 0;
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.15;
    }
  });

  const boxColor = isTarget ? "#22d3ee" : isHighlightedRack ? "#818cf8" : "#1e293b";
  const emissiveColor = isTarget ? "#22d3ee" : active ? "#818cf8" : "#000000";

  return (
    <mesh
      ref={meshRef}
      position={[cx, cy, 0]}
      castShadow
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[cw * 0.72, ch * 0.42, rD * 0.55]} />
      <meshStandardMaterial
        color={active && !isTarget ? "#a5b4fc" : boxColor}
        roughness={isTarget || active ? 0.3 : 0.7}
        metalness={isTarget || active ? 0.5 : 0.05}
        emissive={emissiveColor}
        emissiveIntensity={0}
        transparent={!isHighlightedRack && !active}
        opacity={isHighlightedRack || active ? 1 : 0.25}
      />
    </mesh>
  );
}

// ── Camera Controller (smooth fly-to) ─────────────────────
function CameraController({ target, distance = 4.5 }: { target: THREE.Vector3; distance?: number }) {
  const { camera } = useThree();
  const initialized = useRef(false);
  const prevTarget = useRef(target.clone());
  const lerpAlpha = useRef(0);

  // Detect target change
  useEffect(() => {
    if (!prevTarget.current.equals(target)) {
      prevTarget.current.copy(target);
      lerpAlpha.current = 0; // restart animation
    }
  });

  useFrame((_, delta) => {
    const offset = new THREE.Vector3(distance * 0.7, distance * 0.55, distance * 0.7);
    const goalPos = target.clone().add(offset);

    if (!initialized.current) {
      camera.position.copy(goalPos);
      camera.lookAt(target);
      initialized.current = true;
      lerpAlpha.current = 1;
      return;
    }

    if (lerpAlpha.current < 1) {
      lerpAlpha.current = Math.min(lerpAlpha.current + delta * 2.5, 1);
      const t = lerpAlpha.current;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      camera.position.lerp(goalPos, ease * 0.12);
      camera.lookAt(
        new THREE.Vector3().lerpVectors(camera.position, target, 0.5)
      );
    }
  });

  return null;
}

// ── Industrial Floor ──────────────────────────────────────
function IndustrialFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#141828" roughness={0.9} metalness={0.05} />
      </mesh>
      <gridHelper args={[60, 30, "#252d4a", "#1c2240"]} position={[0, -0.01, 0]} />
    </group>
  );
}

// ── Rack ──────────────────────────────────────────────────
function MiniRack3D({
  rack,
  position: rackPos,
  isHighlighted,
  highlightedCells,
  onSelect,
}: {
  rack: MiniRack;
  position: [number, number, number];
  isHighlighted: boolean;
  highlightedCells: { row: number; col: number; su_code: string }[];
  onSelect: (data: SelectedBoxInfo | null) => void;
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  const [px, , pz] = rackPos;
  const rW = rack.columns * 0.5;
  const rH = rack.rows * 0.45 + 0.3;
  const rD = 0.5;
  const hl = isHighlighted;

  useFrame((state) => {
    if (glowRef.current && hl) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 1.5) * 0.04;
    }
  });

  return (
    <group position={[px, 0, pz]}>
      {/* Floor glow */}
      {hl && (
        <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <planeGeometry args={[rW + 1, rD + 1]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.08} />
        </mesh>
      )}

      {/* Aisle safety lines */}
      {hl && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, rD / 2 + 0.45]}>
            <planeGeometry args={[rW + 0.3, 0.04]} />
            <meshBasicMaterial color="#eab308" transparent opacity={0.6} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -(rD / 2 + 0.45)]}>
            <planeGeometry args={[rW + 0.3, 0.04]} />
            <meshBasicMaterial color="#eab308" transparent opacity={0.6} />
          </mesh>
        </>
      )}

      {/* Base plate */}
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[rW + 0.08, 0.024, rD + 0.08]} />
        <meshStandardMaterial
          color={hl ? "#4f46e5" : "#1e293b"}
          metalness={hl ? 0.6 : 0.2}
          roughness={0.3}
        />
      </mesh>

      {/* Posts */}
      {[-1, 1].map((xD) =>
        [-1, 1].map((zD) => (
          <mesh key={`p-${xD}-${zD}`} position={[(xD * rW) / 2, rH / 2, (zD * rD) / 2]}>
            <boxGeometry args={[0.04, rH, 0.04]} />
            <meshStandardMaterial
              color={hl ? "#818cf8" : "#334155"}
              metalness={hl ? 0.7 : 0.3}
              roughness={0.2}
            />
          </mesh>
        ))
      )}

      {/* Cross bracing */}
      {hl && (
        <group position={[0, rH / 2, -rD / 2 - 0.005]}>
          <mesh rotation={[0, 0, 0.75]}>
            <boxGeometry args={[0.015, rH * 0.65, 0.008]} />
            <meshStandardMaterial color="#4338ca" metalness={0.5} roughness={0.3} transparent opacity={0.6} />
          </mesh>
          <mesh rotation={[0, 0, -0.75]}>
            <boxGeometry args={[0.015, rH * 0.65, 0.008]} />
            <meshStandardMaterial color="#4338ca" metalness={0.5} roughness={0.3} transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Shelves */}
      {Array.from({ length: rack.rows + 1 }, (_, i) => {
        const y = 0.024 + (i / rack.rows) * (rH - 0.024);
        return (
          <group key={`sh-${i}`}>
            <mesh position={[0, y, rD / 2]}>
              <boxGeometry args={[rW + 0.04, 0.026, 0.02]} />
              <meshStandardMaterial color={hl ? "#6366f1" : "#1e293b"} metalness={hl ? 0.45 : 0.15} roughness={0.3} />
            </mesh>
            <mesh position={[0, y, -rD / 2]}>
              <boxGeometry args={[rW + 0.04, 0.026, 0.02]} />
              <meshStandardMaterial color={hl ? "#6366f1" : "#1e293b"} metalness={hl ? 0.45 : 0.15} roughness={0.3} />
            </mesh>
            <mesh position={[0, y + 0.013, 0]}>
              <boxGeometry args={[rW, 0.006, rD - 0.04]} />
              <meshStandardMaterial
                color={hl ? "#c7d2fe" : "#334155"}
                metalness={0.1}
                roughness={0.6}
                transparent
                opacity={hl ? 0.55 : 0.15}
              />
            </mesh>
          </group>
        );
      })}

      {/* Inventory boxes — each hoverable */}
      {rack.rack_positions.map((pos) => {
        if (pos.status === "empty" && !pos.su_code) return null;

        const cw = rW / rack.columns;
        const ch = (rH - 0.024) / rack.rows;
        const cx = (pos.column_number - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.024 + (pos.row_number - 1) * ch + ch * 0.35;

        const isTarget = highlightedCells.some(
          (h) => h.row === pos.row_number && h.col === pos.column_number
        );

        return (
          <InventoryBox
            key={pos.id}
            pos={pos}
            rackCode={rack.code}
            cx={cx}
            cy={cy}
            cw={cw}
            ch={ch}
            rD={rD}
            isTarget={isTarget}
            isHighlightedRack={hl}
            onSelect={onSelect}
          />
        );
      })}

      {/* Beacons on target cells */}
      {highlightedCells.map((cell) => {
        const cw = rW / rack.columns;
        const ch = (rH - 0.024) / rack.rows;
        const cx = (cell.col - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.024 + (cell.row - 1) * ch + ch * 0.65;
        return (
          <HolographicBeacon key={`b-${cell.row}-${cell.col}`} position={[cx, cy, 0]} />
        );
      })}

      {/* Label */}
      {hl ? (
        <Float speed={1.5} floatIntensity={0.12} rotationIntensity={0}>
          <group position={[0, rH + 0.3, 0]}>
            <mesh position={[0, 0, -0.005]}>
              <planeGeometry args={[rack.code.length * 0.1 + 0.25, 0.24]} />
              <meshBasicMaterial color="#1e1b4b" transparent opacity={0.9} />
            </mesh>
            <mesh position={[0, 0, -0.008]}>
              <planeGeometry args={[rack.code.length * 0.1 + 0.29, 0.28]} />
              <meshBasicMaterial color="#6366f1" transparent opacity={0.4} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[rack.code.length * 0.1 + 0.45, 0.44]} />
              <meshBasicMaterial color="#6366f1" transparent opacity={0.08} />
            </mesh>
            <Text fontSize={0.13} color="#c7d2fe" anchorX="center" anchorY="middle">
              {rack.code}
            </Text>
          </group>
        </Float>
      ) : (
        <Text position={[0, rH + 0.12, 0]} fontSize={0.09} color="#475569" anchorX="center" anchorY="middle">
          {rack.code}
        </Text>
      )}
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────
function MiniScene({
  racks,
  highlightedPositions,
  focusedRackCode,
  onSelect,
}: {
  racks: MiniRack[];
  highlightedPositions: HighlightedPosition[];
  focusedRackCode: string | null;
  onSelect: (data: SelectedBoxInfo | null) => void;
}) {
  const highlightMap = useMemo(() => {
    const map = new Map<string, { row: number; col: number; su_code: string }[]>();
    for (const hp of highlightedPositions) {
      const existing = map.get(hp.rack_code) || [];
      existing.push({ row: hp.row_number, col: hp.column_number, su_code: hp.su_code });
      map.set(hp.rack_code, existing);
    }
    return map;
  }, [highlightedPositions]);

  // Only show racks that have highlighted positions — avoids black scene
  const relevantRacks = useMemo(() =>
    racks.filter((r) => highlightMap.has(r.code)),
    [racks, highlightMap]
  );

  const getRackPos = useCallback(
    (index: number): [number, number, number] => {
      const maxRackWidth = Math.max(...relevantRacks.map((r) => r.columns * 0.5), 1.5);
      const xSpacing = maxRackWidth + 0.8;
      const cols = Math.ceil(Math.sqrt(relevantRacks.length * 1.5));
      const row = Math.floor(index / cols);
      const col = index % cols;
      const totalW = (cols - 1) * xSpacing;
      return [-totalW / 2 + col * xSpacing, 0, row * 2.0];
    },
    [relevantRacks]
  );

  // Camera targets the focused rack, or the first one
  const cameraTarget = useMemo(() => {
    const targetCode = focusedRackCode || relevantRacks[0]?.code;
    if (!targetCode) return new THREE.Vector3(0, 1, 0);
    const rackIdx = relevantRacks.findIndex((r) => r.code === targetCode);
    if (rackIdx < 0) return new THREE.Vector3(0, 1, 0);
    const pos = getRackPos(rackIdx);
    const rack = relevantRacks[rackIdx];
    const rH = rack.rows * 0.45 + 0.3;
    return new THREE.Vector3(pos[0], rH / 2, pos[2]);
  }, [focusedRackCode, relevantRacks, getRackPos]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  // Update OrbitControls target when camera target changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.copy(cameraTarget);
      controlsRef.current.update();
    }
  });

  return (
    <>
      {/* Lighting — brighter for the focused view */}
      <ambientLight intensity={0.7} color="#E8ECFF" />
      <hemisphereLight color="#F0F4FF" groundColor="#1a1f35" intensity={0.5} />
      <directionalLight position={[8, 14, 6]} intensity={1.0} color="#E0E7FF" castShadow />
      <directionalLight position={[-6, 10, -5]} intensity={0.4} color="#c7d2fe" />
      <pointLight position={[0, 6, 0]} intensity={0.4} color="#818cf8" decay={2} />
      <pointLight position={[3, 3, 3]} intensity={0.3} color="#22d3ee" decay={2} distance={15} />

      <IndustrialFloor />

      {relevantRacks.map((rack, i) => {
        const cells = highlightMap.get(rack.code) || [];
        return (
          <MiniRack3D
            key={rack.id}
            rack={rack}
            position={getRackPos(i)}
            isHighlighted={true}
            highlightedCells={cells}
            onSelect={onSelect}
          />
        );
      })}

      <CameraController target={cameraTarget} distance={3.5} />
      <OrbitControls
        ref={controlsRef}
        target={cameraTarget}
        enablePan={false}
        enableZoom={true}
        minDistance={1.2}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

// ── Main Component ────────────────────────────────────────
export default function MiniWarehouse3D({
  warehouseId,
  warehouseName,
  highlightedPositions,
  focusedRackCode: externalFocusedRack,
  contextLabel,
}: MiniWarehouse3DProps) {
  const [racks, setRacks] = useState<MiniRack[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalFocusedRack, setInternalFocusedRack] = useState<string | null>(null);
  const [selectedBox, setSelectedBox] = useState<SelectedBoxInfo | null>(null);

  // External prop takes priority, then internal clicks
  const focusedRack = externalFocusedRack ?? internalFocusedRack;
  const setFocusedRack = setInternalFocusedRack;

  const handleBoxSelect = useCallback((data: SelectedBoxInfo | null) => {
    setSelectedBox(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWarehouseRacksForPreview(warehouseId).then((data) => {
      if (cancelled) return;
      setRacks(data.racks);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [warehouseId]);

  // Get unique rack codes from highlighted positions
  const uniqueRacks = useMemo(() => {
    const seen = new Set<string>();
    return highlightedPositions.filter((hp) => {
      if (seen.has(hp.rack_code)) return false;
      seen.add(hp.rack_code);
      return true;
    });
  }, [highlightedPositions]);

  if (loading) {
    return (
      <div className="bg-[#0d0f1e] border border-indigo-500/20 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-500/15 bg-linear-to-r from-indigo-500/5 to-transparent">
          <Warehouse className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-100">{warehouseName}</span>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
              <div className="absolute inset-0 w-10 h-10 border-2 border-transparent border-b-cyan-400/50 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <span className="text-xs text-indigo-300/50">Generando vista 3D...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0f1e] border border-indigo-500/20 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-500/15 bg-linear-to-r from-indigo-500/8 via-transparent to-cyan-500/5">
        <div className="flex items-center gap-2 min-w-0">
          <Warehouse className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-indigo-100 truncate">{warehouseName}</span>
          {contextLabel ? (
            <span className="text-[9px] text-amber-400/70 font-mono whitespace-nowrap">{contextLabel}</span>
          ) : (
            <span className="text-[9px] text-indigo-400/40 font-mono">LIVE</span>
          )}
        </div>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 shrink-0">
          <MapPin className="w-2.5 h-2.5 text-cyan-400" />
          <span className="text-[9px] text-cyan-400 font-medium">{highlightedPositions.length}</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="h-[200px] relative">
        <Canvas
          camera={{ position: [5, 4, 5], fov: 45, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <color attach="background" args={["#0d0f1e"]} />
          <Suspense fallback={null}>
            <MiniScene
              racks={racks}
              highlightedPositions={highlightedPositions}
              focusedRackCode={focusedRack}
              onSelect={handleBoxSelect}
            />
          </Suspense>
        </Canvas>

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(13,15,30,0.5) 100%)"
        }} />

        {/* Box detail popout — floating over canvas */}
        {selectedBox && (
          <div className="absolute top-2 right-2 w-[180px] bg-[#0f172a]/95 backdrop-blur-md border border-indigo-500/30 rounded-lg shadow-xl shadow-black/30 animate-in fade-in slide-in-from-right-2 duration-200 z-10">
            {/* Close button */}
            <button
              onClick={() => setSelectedBox(null)}
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <XIcon className="w-3 h-3" />
            </button>

            <div className="p-2.5 pb-2">
              {/* SU Code */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <Box className="w-3 h-3 text-cyan-400" />
                <span className="text-[11px] font-mono font-bold text-cyan-300">{selectedBox.su_code}</span>
              </div>

              {/* Product name */}
              {selectedBox.product_name && (
                <div className="text-[10px] text-indigo-100 font-medium leading-snug mb-1.5 pr-4">
                  {selectedBox.product_name}
                </div>
              )}

              {/* Details grid */}
              <div className="space-y-1 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Posición</span>
                  <span className="font-mono text-indigo-300">
                    {selectedBox.rack_code}·F{selectedBox.row_number}C{selectedBox.column_number}
                  </span>
                </div>
                {selectedBox.su_quantity !== null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Cantidad</span>
                    <span className="font-semibold text-emerald-400">{selectedBox.su_quantity} UN</span>
                  </div>
                )}
                {selectedBox.su_type && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Tipo</span>
                    <span className="text-indigo-300 capitalize">{selectedBox.su_type}</span>
                  </div>
                )}
                {selectedBox.lot_number && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Lote</span>
                    <span className="text-amber-400/80 font-mono">{selectedBox.lot_number}</span>
                  </div>
                )}
                {selectedBox.product_sku && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">SKU</span>
                    <span className="text-zinc-400 font-mono">{selectedBox.product_sku}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rack navigation buttons */}
      {uniqueRacks.length > 1 && (
        <div className="px-2.5 py-1.5 border-t border-indigo-500/15 bg-linear-to-r from-transparent via-indigo-500/3 to-transparent flex flex-wrap gap-1">
          {uniqueRacks.map((hp) => {
            const isActive = focusedRack === hp.rack_code || (!focusedRack && hp === uniqueRacks[0]);
            return (
              <button
                key={hp.rack_code}
                onClick={() => setFocusedRack(hp.rack_code)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono rounded transition-all ${
                  isActive
                    ? "bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-sm shadow-cyan-500/10"
                    : "bg-zinc-800/50 border border-zinc-700/40 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5"
                }`}
              >
                <span className={`w-1 h-1 rounded-full ${isActive ? "bg-cyan-400 animate-pulse" : "bg-zinc-600"}`} />
                {hp.rack_code}
              </button>
            );
          })}
        </div>
      )}

      {/* Single rack badge */}
      {uniqueRacks.length === 1 && (
        <div className="px-2.5 py-1.5 border-t border-indigo-500/15 flex gap-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500/8 border border-cyan-500/20 text-cyan-400 text-[9px] font-mono rounded">
            <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
            {uniqueRacks[0].rack_code}·F{uniqueRacks[0].row_number}C{uniqueRacks[0].column_number}
          </span>
        </div>
      )}
    </div>
  );
}
