"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { Warehouse, CheckCircle2, Box } from "lucide-react";
import { fetchWarehouseRacksForPreview } from "../actions/stock-hierarchy-actions";
import type { MiniRack, MiniRackPosition } from "../actions/stock-hierarchy-actions";

// ── Types ──────────────────────────────────────────────────
type PutawaySelector3DProps = {
  warehouseId: string;
  warehouseName: string;
  suggestedPositions?: { position_id: string; rack_code: string; row_number: number; column_number: number }[];
  selectedPositionId?: string;
  onSelectPosition: (pos: { id: string; label: string; rack_code: string; row: number; col: number }) => void;
};

// ── Pulsing Beacon for suggested/selected positions ────────
function SelectionBeacon({ position, color = "#10b981" }: { position: [number, number, number]; color?: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
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
  });

  return (
    <group position={position}>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[0.05, 0.07, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={1} distance={2.5} decay={2} />
    </group>
  );
}

// ── Clickable Position Box ─────────────────────────────────
function PositionBox({
  pos,
  rackCode,
  cx, cy, cw, ch, rD,
  isAvailable,
  isSuggested,
  isSelected,
  onSelect,
}: {
  pos: MiniRackPosition;
  rackCode: string;
  cx: number; cy: number; cw: number; ch: number; rD: number;
  isAvailable: boolean;
  isSuggested: boolean;
  isSelected: boolean;
  onSelect: (data: { id: string; label: string; rack_code: string; row: number; col: number }) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!isAvailable && !isSelected) return;
    e.stopPropagation();
    onSelect({
      id: pos.id,
      label: `${rackCode}-${pos.row_number}-${pos.column_number}`,
      rack_code: rackCode,
      row: pos.row_number,
      col: pos.column_number,
    });
  }, [isAvailable, isSelected, pos, rackCode, onSelect]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isAvailable && !isSelected) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, [isAvailable, isSelected]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const targetEmissive = isSelected ? 0.8 : isSuggested ? 0.5 : hovered ? 0.4 : 0;
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.15;
    }
  });

  // Color logic
  let boxColor = "#1e293b"; // occupied
  let emissiveColor = "#000000";
  let opacity = 0.25;

  if (isSelected) {
    boxColor = "#10b981";
    emissiveColor = "#10b981";
    opacity = 1;
  } else if (isSuggested) {
    boxColor = "#f59e0b";
    emissiveColor = "#f59e0b";
    opacity = 1;
  } else if (isAvailable) {
    boxColor = hovered ? "#6ee7b7" : "#22c55e";
    emissiveColor = hovered ? "#6ee7b7" : "#000000";
    opacity = hovered ? 0.9 : 0.45;
  } else if (pos.su_code) {
    // Has inventory
    boxColor = "#6366f1";
    opacity = 0.7;
  }

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
        color={boxColor}
        roughness={isSelected || isSuggested || hovered ? 0.3 : 0.7}
        metalness={isSelected || isSuggested ? 0.5 : 0.05}
        emissive={emissiveColor}
        emissiveIntensity={0}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

// ── Rack with selectable positions ─────────────────────────
function SelectableRack({
  rack,
  position: rackPos,
  suggestedCells,
  selectedPositionId,
  onSelect,
}: {
  rack: MiniRack;
  position: [number, number, number];
  suggestedCells: { id: string; row: number; col: number }[];
  selectedPositionId?: string;
  onSelect: (data: { id: string; label: string; rack_code: string; row: number; col: number }) => void;
}) {
  const [px, , pz] = rackPos;
  const rW = rack.columns * 0.5;
  const rH = rack.rows * 0.45 + 0.3;
  const rD = 0.5;

  const hasSuggestions = suggestedCells.length > 0;
  const hasSelected = rack.rack_positions.some(p => p.id === selectedPositionId);
  const isHighlighted = hasSuggestions || hasSelected;

  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && isHighlighted) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 1.5) * 0.04;
    }
  });

  return (
    <group position={[px, 0, pz]}>
      {/* Floor glow */}
      {isHighlighted && (
        <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <planeGeometry args={[rW + 1, rD + 1]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.08} />
        </mesh>
      )}

      {/* Base plate */}
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[rW + 0.08, 0.024, rD + 0.08]} />
        <meshStandardMaterial
          color={isHighlighted ? "#059669" : "#1e293b"}
          metalness={isHighlighted ? 0.6 : 0.2}
          roughness={0.3}
        />
      </mesh>

      {/* Posts */}
      {[-1, 1].map((xD) =>
        [-1, 1].map((zD) => (
          <mesh key={`p-${xD}-${zD}`} position={[(xD * rW) / 2, rH / 2, (zD * rD) / 2]}>
            <boxGeometry args={[0.04, rH, 0.04]} />
            <meshStandardMaterial
              color={isHighlighted ? "#34d399" : "#334155"}
              metalness={isHighlighted ? 0.7 : 0.3}
              roughness={0.2}
            />
          </mesh>
        ))
      )}

      {/* Shelves */}
      {Array.from({ length: rack.rows + 1 }, (_, i) => {
        const y = 0.024 + (i / rack.rows) * (rH - 0.024);
        return (
          <group key={`sh-${i}`}>
            <mesh position={[0, y, rD / 2]}>
              <boxGeometry args={[rW + 0.04, 0.026, 0.02]} />
              <meshStandardMaterial color={isHighlighted ? "#10b981" : "#1e293b"} metalness={isHighlighted ? 0.45 : 0.15} roughness={0.3} />
            </mesh>
            <mesh position={[0, y, -rD / 2]}>
              <boxGeometry args={[rW + 0.04, 0.026, 0.02]} />
              <meshStandardMaterial color={isHighlighted ? "#10b981" : "#1e293b"} metalness={isHighlighted ? 0.45 : 0.15} roughness={0.3} />
            </mesh>
            <mesh position={[0, y + 0.013, 0]}>
              <boxGeometry args={[rW, 0.006, rD - 0.04]} />
              <meshStandardMaterial
                color={isHighlighted ? "#d1fae5" : "#334155"}
                metalness={0.1} roughness={0.6}
                transparent opacity={isHighlighted ? 0.55 : 0.15}
              />
            </mesh>
          </group>
        );
      })}

      {/* Position boxes — only show available/suggested/selected (putaway mode) */}
      {rack.rack_positions.map((pos) => {
        const cw = rW / rack.columns;
        const ch = (rH - 0.024) / rack.rows;
        const cx = (pos.column_number - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.024 + (pos.row_number - 1) * ch + ch * 0.35;

        const isAvailable = pos.status === "empty" || pos.status === "available" || (!pos.su_code && pos.status !== "reserved");
        const isSuggested = suggestedCells.some(s => s.row === pos.row_number && s.col === pos.column_number);
        const isSelected = selectedPositionId === pos.id;

        // Only render selectable positions — hide occupied ones entirely
        if (!isAvailable && !isSuggested && !isSelected) return null;

        return (
          <PositionBox
            key={pos.id}
            pos={pos}
            rackCode={rack.code}
            cx={cx} cy={cy} cw={cw} ch={ch} rD={rD}
            isAvailable={isAvailable}
            isSuggested={isSuggested}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        );
      })}

      {/* Beacons on suggested positions */}
      {suggestedCells.map((cell) => {
        const cw = rW / rack.columns;
        const ch = (rH - 0.024) / rack.rows;
        const cx = (cell.col - 1) * cw - rW / 2 + cw / 2;
        const cy = 0.024 + (cell.row - 1) * ch + ch * 0.65;
        const isThisSelected = selectedPositionId === cell.id;
        return (
          <SelectionBeacon
            key={`b-${cell.row}-${cell.col}`}
            position={[cx, cy, 0]}
            color={isThisSelected ? "#10b981" : "#f59e0b"}
          />
        );
      })}

      {/* Label */}
      {isHighlighted ? (
        <Float speed={1.5} floatIntensity={0.12} rotationIntensity={0}>
          <group position={[0, rH + 0.3, 0]}>
            <mesh position={[0, 0, -0.005]}>
              <planeGeometry args={[rack.code.length * 0.1 + 0.25, 0.24]} />
              <meshBasicMaterial color="#022c22" transparent opacity={0.9} />
            </mesh>
            <mesh position={[0, 0, -0.008]}>
              <planeGeometry args={[rack.code.length * 0.1 + 0.29, 0.28]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
            </mesh>
            <Text fontSize={0.13} color="#d1fae5" anchorX="center" anchorY="middle">
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

// ── Camera Fly-To Controller (animates once, then frees user) ─────
function CameraFlyTo({ target, distance = 4.5 }: { target: THREE.Vector3; distance?: number }) {
  const { camera } = useThree();
  const progress = useRef(0);
  const lastTarget = useRef(new THREE.Vector3());
  const isAnimating = useRef(true);

  // Detect target changes → restart animation
  useEffect(() => {
    if (!lastTarget.current.equals(target)) {
      lastTarget.current.copy(target);
      progress.current = 0;
      isAnimating.current = true;
    }
  }, [target]);

  useFrame(() => {
    if (!isAnimating.current) return;
    progress.current = Math.min(progress.current + 0.025, 1);
    const offset = new THREE.Vector3(distance * 0.7, distance * 0.55, distance * 0.7);
    const goalPos = target.clone().add(offset);
    camera.position.lerp(goalPos, 0.06);
    if (progress.current >= 1) {
      isAnimating.current = false;
    }
  });

  return null;
}

// ── Floor ─────────────────────────────────────────────────
function Floor() {
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

// ── Scene ─────────────────────────────────────────────────
function PutawayScene({
  racks,
  suggestedPositions,
  selectedPositionId,
  onSelect,
}: {
  racks: MiniRack[];
  suggestedPositions: PutawaySelector3DProps["suggestedPositions"];
  selectedPositionId?: string;
  onSelect: PutawaySelector3DProps["onSelectPosition"];
}) {
  // Build suggestion map by rack code
  const suggestMap = useMemo(() => {
    const map = new Map<string, { id: string; row: number; col: number }[]>();
    for (const sp of suggestedPositions || []) {
      const existing = map.get(sp.rack_code) || [];
      existing.push({ id: sp.position_id, row: sp.row_number, col: sp.column_number });
      map.set(sp.rack_code, existing);
    }
    return map;
  }, [suggestedPositions]);

  const getRackPos = useCallback(
    (index: number): [number, number, number] => {
      const maxRackWidth = Math.max(...racks.map((r) => r.columns * 0.5), 1.5);
      const xSpacing = maxRackWidth + 0.6;
      const zSpacing = 2.0;
      const cols = Math.ceil(Math.sqrt(racks.length * 1.5));
      const row = Math.floor(index / cols);
      const col = index % cols;
      const totalW = (cols - 1) * xSpacing;
      const totalD = (Math.ceil(racks.length / cols) - 1) * zSpacing;
      return [-totalW / 2 + col * xSpacing, 0, -totalD / 2 + row * zSpacing];
    },
    [racks]
  );

  // Camera targets the rack with the first suggestion, or the rack with the selected position
  const cameraTarget = useMemo(() => {
    let targetCode = suggestedPositions?.[0]?.rack_code;
    if (selectedPositionId) {
      for (const rack of racks) {
        if (rack.rack_positions.some(p => p.id === selectedPositionId)) {
          targetCode = rack.code;
          break;
        }
      }
    }
    if (!targetCode) return new THREE.Vector3(0, 1, 0);
    const rackIdx = racks.findIndex((r) => r.code === targetCode);
    if (rackIdx < 0) return new THREE.Vector3(0, 1, 0);
    const pos = getRackPos(rackIdx);
    const rack = racks[rackIdx];
    const rH = rack.rows * 0.45 + 0.3;
    return new THREE.Vector3(pos[0], rH / 2, pos[2]);
  }, [suggestedPositions, selectedPositionId, racks, getRackPos]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  // Smoothly update OrbitControls target when camera target changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.copy(cameraTarget);
      controlsRef.current.update();
    }
  }, [cameraTarget]);

  return (
    <>
      <ambientLight intensity={0.5} color="#E8ECFF" />
      <hemisphereLight color="#F0F4FF" groundColor="#1a1f35" intensity={0.4} />
      <directionalLight position={[8, 14, 6]} intensity={0.8} color="#E0E7FF" castShadow />
      <directionalLight position={[-6, 10, -5]} intensity={0.3} color="#c7d2fe" />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#10b981" decay={2} />

      <Floor />

      {racks.map((rack, i) => (
        <SelectableRack
          key={rack.id}
          rack={rack}
          position={getRackPos(i)}
          suggestedCells={suggestMap.get(rack.code) || []}
          selectedPositionId={selectedPositionId}
          onSelect={onSelect}
        />
      ))}

      <CameraFlyTo target={cameraTarget} distance={4.5} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={25}
        maxPolarAngle={Math.PI / 2.1}
        panSpeed={0.8}
      />
    </>

  );
}

// ── Main Component ────────────────────────────────────────
export default function PutawaySelector3D({
  warehouseId,
  warehouseName,
  suggestedPositions,
  selectedPositionId,
  onSelectPosition,
}: PutawaySelector3DProps) {
  const [racks, setRacks] = useState<MiniRack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchWarehouseRacksForPreview(warehouseId).then((data) => {
      if (cancelled) return;
      setRacks(data.racks);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [warehouseId]);

  // Count available positions
  const availableCount = useMemo(() =>
    racks.reduce((sum, r) =>
      sum + r.rack_positions.filter(p => p.status === "empty" || p.status === "available" || (!p.su_code && p.status !== "reserved")).length, 0
    ), [racks]
  );

  if (loading) {
    return (
      <div className="bg-[#0d0f1e] border border-emerald-500/20 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-500/15 bg-linear-to-r from-emerald-500/5 to-transparent">
          <Warehouse className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-text-primary">{warehouseName}</span>
        </div>
        <div className="h-[280px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
            </div>
            <span className="text-xs text-emerald-300/50">Generando vista 3D...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0f1e] border border-emerald-500/20 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/15 bg-linear-to-r from-emerald-500/8 via-transparent to-cyan-500/5">
        <div className="flex items-center gap-2">
          <Warehouse className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-text-primary">{warehouseName}</span>
          <span className="text-[9px] text-emerald-400/40 font-mono">PUTAWAY</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Box className="w-2.5 h-2.5 text-emerald-400" />
            <span className="text-[9px] text-emerald-400 font-medium">{availableCount} libres</span>
          </div>
          {selectedPositionId && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-[9px] text-emerald-300 font-medium">Seleccionado</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="h-[280px] relative">
        <Canvas
          camera={{ position: [5, 4, 5], fov: 45, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <color attach="background" args={["#0d0f1e"]} />
          <Suspense fallback={null}>
            <PutawayScene
              racks={racks}
              suggestedPositions={suggestedPositions}
              selectedPositionId={selectedPositionId}
              onSelect={onSelectPosition}
            />
          </Suspense>
        </Canvas>

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(13,15,30,0.5) 100%)"
        }} />
      </div>

      {/* Legend */}
      <div className="px-3 py-1.5 border-t border-emerald-500/15 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-emerald-500/40 border border-emerald-500/60" />
          <span className="text-[8px] text-zinc-400">Disponible</span>
        </div>
        {(suggestedPositions?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-amber-500/40 border border-amber-500 animate-pulse" />
            <span className="text-[8px] text-zinc-400">Sugerido IA</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-emerald-500 border border-emerald-400" />
          <span className="text-[8px] text-zinc-400">Seleccionado</span>
        </div>
        <span className="text-[8px] text-zinc-600 ml-auto">Click en posición disponible para asignar</span>
      </div>
    </div>
  );
}
