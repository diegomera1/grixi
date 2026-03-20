"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import type { Equipment } from "../types";
import { EQUIPMENT_STATUS_COLORS } from "../types";

// ── Interior Equipment Types ────────────────────

type InteriorProps = {
  equipment: Equipment[];
};

// ── Procedural Grid Floor ───────────────────────

function GridFloor() {
  return (
    <group>
      {/* Main floor */}
      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#1a2530" roughness={0.9} metalness={0.3} />
      </mesh>
      {/* Grid lines — X direction */}
      {Array.from({ length: 19 }, (_, i) => i - 9).map((x) => (
        <mesh key={`gx-${x}`} position={[x, -2.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.02, 12]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.08} />
        </mesh>
      ))}
      {/* Grid lines — Z direction */}
      {Array.from({ length: 13 }, (_, i) => i - 6).map((z) => (
        <mesh key={`gz-${z}`} position={[0, -2.99, z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.02, 18]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.08} />
        </mesh>
      ))}
    </group>
  );
}

// ── Room Structure ──────────────────────────────

function RoomStructure() {
  return (
    <group>
      {/* Walls — back side to see inside */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[18, 7, 12]} />
        <meshPhysicalMaterial
          color="#2a3a4a"
          roughness={0.7}
          metalness={0.4}
          transparent
          opacity={0.25}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Ceiling pipes */}
      {[-4, -1, 2, 5].map((x) => (
        <mesh key={x} position={[x, 3.2, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 12, 8]} />
          <meshPhysicalMaterial color="#4a5a6a" roughness={0.4} metalness={0.7} clearcoat={0.3} />
        </mesh>
      ))}
      {/* Cross pipes */}
      {[-3, 0, 3].map((z) => (
        <mesh key={z} position={[0, 3.4, z]} rotation={[0, Math.PI / 2, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 18, 6]} />
          <meshPhysicalMaterial color="#5a6a7a" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ── Main Engine ─────────────────────────────────

function MainEngine() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = -0.8 + Math.sin(clock.elapsedTime * 3) * 0.005;
    }
  });

  return (
    <group position={[-2, 0, 0]}>
      {/* Engine block */}
      <mesh ref={meshRef} position={[0, -0.8, 0]}>
        <boxGeometry args={[5, 3.5, 3]} />
        <meshPhysicalMaterial
          color="#3a4a5a"
          roughness={0.35}
          metalness={0.6}
          clearcoat={0.3}
          clearcoatRoughness={0.5}
        />
      </mesh>
      {/* Cylinder heads */}
      {[-1.8, -0.6, 0.6, 1.8].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.2, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 1.0, 12]} />
            <meshPhysicalMaterial color="#5a6a5a" roughness={0.3} metalness={0.7} clearcoat={0.4} />
          </mesh>
          {/* Cylinder head cap */}
          <mesh position={[x, 1.75, 0]}>
            <cylinderGeometry args={[0.28, 0.38, 0.15, 12]} />
            <meshPhysicalMaterial color="#7a8a7a" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Crankshaft */}
      <mesh position={[0, -2.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 5.5, 8]} />
        <meshPhysicalMaterial color="#8a7a3a" roughness={0.3} metalness={0.8} clearcoat={0.5} />
      </mesh>
      {/* Flywheel */}
      <mesh position={[2.8, -2.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.8, 0.8, 0.15, 16]} />
        <meshPhysicalMaterial color="#4a4a4a" roughness={0.3} metalness={0.7} clearcoat={0.4} />
      </mesh>
      {/* Label */}
      <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
        <Text position={[0, 2.6, 0]} fontSize={0.25} color="#0EA5E9" anchorX="center">
          MOTOR PRINCIPAL
        </Text>
        <Text position={[0, 2.2, 0]} fontSize={0.15} color="#10B981" anchorX="center">
          MAN B&W 6S50MC-C
        </Text>
      </Float>
    </group>
  );
}

// ── Generators ──────────────────────────────────

function Generators() {
  return (
    <group position={[5.5, -1.5, 0]}>
      {[-1.5, 1.5].map((z) => (
        <group key={z} position={[0, 0, z]}>
          {/* Generator body */}
          <mesh>
            <boxGeometry args={[1.8, 1.5, 1.2]} />
            <meshPhysicalMaterial color="#4a6a5a" roughness={0.35} metalness={0.5} clearcoat={0.3} />
          </mesh>
          {/* Alternator */}
          <mesh position={[1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 12]} />
            <meshPhysicalMaterial color="#5a7a6a" roughness={0.3} metalness={0.6} clearcoat={0.3} />
          </mesh>
          {/* Status LED */}
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
      <Text position={[0, 1.2, 0]} fontSize={0.15} color="#06B6D4" anchorX="center">
        GEN AUX #1 / #2
      </Text>
    </group>
  );
}

// ── Auxiliary Equipment ─────────────────────────

function AuxEquipment() {
  const equipment = useMemo(() => [
    { pos: [-7, -1.5, -3] as [number, number, number], label: "COMPRESOR", color: "#6a7a8a", size: [1.2, 1, 0.8] as [number, number, number] },
    { pos: [-7, -1.5, 3] as [number, number, number], label: "CALDERA AUX", color: "#7a5a4a", size: [1.4, 1.2, 1] as [number, number, number] },
    { pos: [5.5, -1.5, -4] as [number, number, number], label: "BOMBA HFO", color: "#5a6a7a", size: [0.8, 0.6, 0.6] as [number, number, number] },
    { pos: [5.5, -1.5, 4] as [number, number, number], label: "SEPARADORA", color: "#6a5a7a", size: [0.8, 0.8, 0.8] as [number, number, number] },
  ], []);

  return (
    <group>
      {equipment.map((eq) => (
        <group key={eq.label} position={eq.pos}>
          <mesh>
            <boxGeometry args={eq.size} />
            <meshPhysicalMaterial color={eq.color} roughness={0.4} metalness={0.5} clearcoat={0.2} />
          </mesh>
          <Text position={[0, eq.size[1] / 2 + 0.2, 0]} fontSize={0.1} color="#0EA5E9" anchorX="center">
            {eq.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ── Equipment Status Panel ──────────────────────

function EquipmentStatusLEDs({ equipment }: { equipment: Equipment[] }) {
  return (
    <group position={[-8.5, 0, 0]}>
      <Text position={[0, 2.5, 0]} fontSize={0.15} color="#0EA5E9" anchorX="center">
        ESTADO EQUIPOS
      </Text>
      {equipment.slice(0, 10).map((eq, i) => {
        const color = EQUIPMENT_STATUS_COLORS[eq.status] ?? "#6B7280";
        const row = Math.floor(i / 2);
        const col = i % 2;

        return (
          <group key={eq.id} position={[col * 1.2 - 0.6, 1.8 - row * 0.5, 0]}>
            <mesh>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={eq.status === "failed" ? 2.5 : eq.status === "operational" ? 0.6 : 1.2}
              />
            </mesh>
            <Text position={[0.15, 0, 0]} fontSize={0.07} color={color} anchorX="left">
              {eq.code}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ── Interior Scene ──────────────────────────────

function InteriorScene({ equipment }: InteriorProps) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#ffffff" castShadow />
      <directionalLight position={[-5, 8, -3]} intensity={0.5} color="#e8dcd0" />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#0EA5E9" />
      <pointLight position={[-5, 1, 0]} intensity={0.3} color="#EF4444" />
      <hemisphereLight args={["#b1e1ff", "#1a2535", 0.5]} />

      <GridFloor />
      <RoomStructure />
      <MainEngine />
      <Generators />
      <AuxEquipment />
      <EquipmentStatusLEDs equipment={equipment} />

      <OrbitControls
        makeDefault
        minDistance={4}
        maxDistance={20}
        enablePan
        enableZoom
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI * 0.8}
      />
    </>
  );
}

// ── Exported Component ──────────────────────────

export function Vessel3DInterior({ equipment }: InteriorProps) {
  return (
    <div className="relative h-[450px] md:h-[550px] rounded-xl border border-white/10 bg-[#0f1923] overflow-hidden">
      <Canvas
        camera={{ position: [8, 5, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#0f1923"]} />
        <fog attach="fog" args={["#0f1923", 25, 45]} />
        <InteriorScene equipment={equipment} />
      </Canvas>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#0f1923]/90 to-transparent">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#EF4444]">⚙️ SALA DE MÁQUINAS</span>
          <span className="text-[10px] text-white/40">Vista Interior</span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10B981]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-t from-[#0f1923]/90 to-transparent">
        <div className="flex items-center gap-3 text-[9px] text-white/40">
          <span>{equipment.length} equipos monitoreados</span>
          <span className="text-[#10B981]">
            {equipment.filter((e) => e.status === "operational").length} operativos
          </span>
          <span className="text-[#EF4444]">
            {equipment.filter((e) => e.status === "failed").length} en falla
          </span>
        </div>
        <div className="text-[8px] text-white/30">
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
}
