"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";

// Imperative texture loader — bypasses React compiler mutation stripping
function useImperativeTexture(url: string, repeatX = 1, repeatY = 1): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.needsUpdate = true;
      setTexture(tex);
    });
  }, [url, repeatX, repeatY]);
  return texture;
}
import type { Equipment } from "../types";
import { EQUIPMENT_STATUS_COLORS } from "../types";

// ── Interior Engine Room Scene ──────────────────

function InteriorGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);
  useFrame(({ clock }) => {
    if (gridRef.current) {
      (gridRef.current.material as THREE.Material).opacity = 0.1 + Math.sin(clock.elapsedTime * 0.3) * 0.03;
    }
  });
  return (
    <gridHelper
      ref={gridRef}
      args={[20, 20, "#0EA5E9", "#0EA5E9"]}
      position={[0, -3, 0]}
      material-transparent
      material-opacity={0.12}
    />
  );
}

// Room walls with textures
function RoomStructure() {
  const wireRef = useRef<THREE.Mesh>(null);
  const metalTexture = useImperativeTexture("/fleet/texture-engine-metal.png", 3, 2);
  const floorTexture = useImperativeTexture("/fleet/texture-floor-grating.png", 6, 4);

  useFrame(({ clock }) => {
    if (wireRef.current) {
      (wireRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + Math.sin(clock.elapsedTime * 0.4) * 0.02;
    }
  });

  return (
    <group>
      {/* Floor with grating texture */}
      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial map={floorTexture} roughness={0.8} metalness={0.6} color="#1a2535" />
      </mesh>
      {/* Room wireframe with metal */}
      <mesh ref={wireRef} position={[0, 0.5, 0]}>
        <boxGeometry args={[18, 7, 12]} />
        <meshStandardMaterial map={metalTexture} transparent opacity={0.15} roughness={0.9} metalness={0.7} emissive="#0EA5E9" emissiveIntensity={0.05} side={THREE.BackSide} />
      </mesh>
      {/* Ceiling pipes */}
      {[-4, 0, 4].map((x) => (
        <mesh key={x} position={[x, 3.5, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 12, 8]} />
          <meshStandardMaterial color="#2a5478" roughness={0.6} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// Main Engine (large block)
function MainEngine({ onClick }: { onClick?: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = -0.5 + Math.sin(clock.elapsedTime * 2) * 0.01;
    }
  });

  return (
    <group position={[-2, -1, 0]} onClick={onClick}>
      {/* Engine block */}
      <mesh ref={meshRef}>
        <boxGeometry args={[5, 4, 3]} />
        <meshBasicMaterial color="#0EA5E9" wireframe transparent opacity={0.2} />
      </mesh>
      {/* Engine cylinders */}
      {[-1.5, -0.5, 0.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 1.5, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 1.2, 8]} />
          <meshBasicMaterial color="#10B981" transparent opacity={0.25} />
        </mesh>
      ))}
      {/* Crankshaft */}
      <mesh position={[0, -1.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 5, 8]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.3} />
      </mesh>
      {/* Label */}
      <Text position={[0, 2.8, 0]} fontSize={0.3} color="#0EA5E9" anchorX="center">
        MOTOR PRINCIPAL
      </Text>
      <Text position={[0, 2.4, 0]} fontSize={0.18} color="#10B981" anchorX="center">
        MAN B&W 6S50MC-C
      </Text>
    </group>
  );
}

// Generator unit
function GeneratorUnit({ position, label, status }: { position: [number, number, number]; label: string; status: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const statusColor = EQUIPMENT_STATUS_COLORS[status as keyof typeof EQUIPMENT_STATUS_COLORS] || "#0EA5E9";

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.8, 1.5, 1.2]} />
        <meshBasicMaterial color={statusColor} wireframe transparent opacity={0.2} />
      </mesh>
      {/* Rotor */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <torusGeometry args={[0.4, 0.06, 8, 16]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.4} />
      </mesh>
      <Text position={[0, 1.2, 0]} fontSize={0.2} color="#0EA5E9" anchorX="center">
        {label}
      </Text>
      <Float speed={2} rotationIntensity={0} floatIntensity={0.1}>
        <mesh position={[0, -0.9, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>
      </Float>
    </group>
  );
}

// Pump
function PumpUnit({ position, label }: { position: [number, number, number]; label: string }) {
  const impellerRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (impellerRef.current) impellerRef.current.rotation.z = clock.elapsedTime * 3;
  });

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.35, 0.35, 0.8, 12]} />
        <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.25} />
      </mesh>
      {/* Impeller */}
      <mesh ref={impellerRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.03, 6, 8]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.5} />
      </mesh>
      {/* Pipe connections */}
      <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 1, 6]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.15} />
      </mesh>
      <Text position={[0, 0.7, 0]} fontSize={0.15} color="#8B5CF6" anchorX="center">
        {label}
      </Text>
    </group>
  );
}

// Control Panel
function ControlPanel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2.5, 2, 0.3]} />
        <meshBasicMaterial color="#F59E0B" wireframe transparent opacity={0.2} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.3, 0.2]}>
        <planeGeometry args={[1.8, 0.8]} />
        <meshBasicMaterial color="#0EA5E9" transparent opacity={0.1} />
      </mesh>
      {/* Indicator lights */}
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <Float key={x} speed={1 + (x + 1) * 0.3} floatIntensity={0.05}>
          <mesh position={[x, -0.5, 0.2]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={x < 0 ? "#10B981" : x === 0.2 ? "#F59E0B" : "#10B981"} />
          </mesh>
        </Float>
      ))}
      <Text position={[0, 1.3, 0]} fontSize={0.2} color="#F59E0B" anchorX="center">
        PANEL DE CONTROL
      </Text>
    </group>
  );
}

// Particle system for engine exhaust effect
function ExhaustParticles() {
  const particles = useMemo(() => {
    // Deterministic pseudo-random for ESLint purity
    let seed = 42;
    const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };
    const positions = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      positions[i * 3] = (rand() - 0.5) * 18;
      positions[i * 3 + 1] = (rand() - 0.5) * 7;
      positions[i * 3 + 2] = (rand() - 0.5) * 12;
    }
    return positions;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.elapsedTime * 0.02;
      (pointsRef.current.material as THREE.PointsMaterial).opacity = 0.15 + Math.sin(clock.elapsedTime) * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles, 3]}
          count={200}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#0EA5E9" size={0.04} transparent opacity={0.15} sizeAttenuation />
    </points>
  );
}

// ── Main Interior Scene ─────────────────────────

type InteriorProps = {
  equipment: Equipment[];
  onSelectEquipment?: (eq: Equipment) => void;
};

function InteriorScene({ equipment }: InteriorProps) {
  const gen1 = equipment.find((e) => e.code?.includes("GEN-01"));
  const gen2 = equipment.find((e) => e.code?.includes("GEN-02"));

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.3} color="#0EA5E9" />
      <pointLight position={[-5, 2, 3]} intensity={0.15} color="#10B981" />

      <InteriorGrid />
      <RoomStructure />
      <ExhaustParticles />

      {/* Main Engine */}
      <MainEngine />

      {/* Generators */}
      <GeneratorUnit
        position={[5.5, -1.5, -3]}
        label="GENERADOR #1"
        status={gen1?.status || "operational"}
      />
      <GeneratorUnit
        position={[5.5, -1.5, 3]}
        label="GENERADOR #2"
        status={gen2?.status || "operational"}
      />

      {/* Pumps */}
      <PumpUnit position={[-6, -2.2, -3]} label="BOMBA CARGA" />
      <PumpUnit position={[-6, -2.2, 0]} label="BOMBA LASTRE" />
      <PumpUnit position={[-6, -2.2, 3]} label="BOMBA SENTINA" />

      {/* Control Panel */}
      <ControlPanel position={[7, -0.5, 0]} />

      {/* Compressor */}
      <group position={[3, -2, -4.5]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 1.2, 12]} />
          <meshBasicMaterial color="#06B6D4" wireframe transparent opacity={0.2} />
        </mesh>
        <Text position={[0, 1, 0]} fontSize={0.15} color="#06B6D4" anchorX="center">
          COMPRESOR
        </Text>
      </group>

      {/* Boiler */}
      <group position={[3, -1.5, 4.5]}>
        <mesh>
          <cylinderGeometry args={[0.6, 0.6, 2, 12]} />
          <meshBasicMaterial color="#EF4444" wireframe transparent opacity={0.2} />
        </mesh>
        <Text position={[0, 1.5, 0]} fontSize={0.15} color="#EF4444" anchorX="center">
          CALDERA
        </Text>
      </group>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 1.5}
        minPolarAngle={0.3}
        maxDistance={15}
        minDistance={4}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function Vessel3DInterior({ equipment }: InteriorProps) {
  return (
    <div className="relative h-[450px] rounded-xl border border-[var(--border)] bg-black overflow-hidden">
      <Canvas
        camera={{ position: [10, 5, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "#030712" }}
      >
        <InteriorScene equipment={equipment} />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-3 left-3 z-10">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-md px-3 py-2">
          <p className="text-[10px] font-bold text-[#0EA5E9]">SALA DE MÁQUINAS</p>
          <p className="text-[8px] text-[var(--text-muted)]">Vista Interior · Holográfica</p>
        </div>
      </div>

      {/* Equipment Legend */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-md px-3 py-2">
        <p className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Componentes</p>
        <div className="space-y-0.5">
          {[
            { color: "#0EA5E9", label: "Motor Principal" },
            { color: "#10B981", label: "Generadores (2)" },
            { color: "#8B5CF6", label: "Bombas (3)" },
            { color: "#F59E0B", label: "Panel de Control" },
            { color: "#06B6D4", label: "Compresor" },
            { color: "#EF4444", label: "Caldera" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[8px] text-[var(--text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
