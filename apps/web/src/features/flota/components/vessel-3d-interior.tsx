"use client";

import React, {
  useRef,
  useMemo,
  Suspense,
} from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Equipment } from "../types";
import { EQUIPMENT_STATUS_COLORS } from "../types";

// ─── Texture Hook (reuses warehouse textures) ───────────

function useInteriorTextures() {
  const [metal, concrete, wall] = useLoader(THREE.TextureLoader, [
    "/textures/metal.png",
    "/textures/concrete.png",
    "/textures/wall.png",
  ]);

  useMemo(() => {
    metal.wrapS = THREE.RepeatWrapping;
    metal.wrapT = THREE.RepeatWrapping;
    metal.repeat.set(3, 3);
    concrete.wrapS = THREE.RepeatWrapping;
    concrete.wrapT = THREE.RepeatWrapping;
    concrete.repeat.set(6, 4);
    wall.wrapS = THREE.RepeatWrapping;
    wall.wrapT = THREE.RepeatWrapping;
    wall.repeat.set(8, 2);
  }, [metal, concrete, wall]);

  return { metal, concrete, wall };
}

// ─── Floor with Grid Pattern ────────────────────────────

function EngineRoomFloor({ textures }: { textures: ReturnType<typeof useInteriorTextures> }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial map={textures.concrete} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Floor safety lines */}
      {[-3, 0, 3].map((z) => (
        <mesh key={`fl-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.99, z]}>
          <planeGeometry args={[18, 0.06]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Room Structure ─────────────────────────────────────

const RoomStructure = React.memo(function RoomStructure({ textures }: { textures: ReturnType<typeof useInteriorTextures> }) {
  return (
    <group>
      {/* Walls — back side visible */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[18, 7, 12]} />
        <meshStandardMaterial
          map={textures.wall}
          color="#5a6a7a"
          roughness={0.7}
          metalness={0.3}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Ceiling I-beams */}
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={`beam-${x}`} position={[x, 3.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.3, 12, 0.15]} />
          <meshStandardMaterial map={textures.metal} color="#64748B" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Ceiling pipes */}
      {[-4, -1, 2, 5].map((x) => (
        <mesh key={`pipe-${x}`} position={[x, 3.2, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 12, 8]} />
          <meshStandardMaterial color="#4a5a6a" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Columns */}
      {[-8.8, 8.8].map((x) =>
        [-5, 0, 5].map((z) => (
          <mesh key={`col-${x}-${z}`} position={[x, 0.5, z]} castShadow>
            <boxGeometry args={[0.3, 7, 0.3]} />
            <meshStandardMaterial color="#78716C" metalness={0.5} roughness={0.35} />
          </mesh>
        ))
      )}
    </group>
  );
});

// ─── Main Engine ────────────────────────────────────────

const MainEngine = React.memo(function MainEngine({ textures }: { textures: ReturnType<typeof useInteriorTextures> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = -0.8 + Math.sin(clock.elapsedTime * 3) * 0.005;
    }
  });

  return (
    <group position={[-2, 0, 0]}>
      {/* Engine block */}
      <mesh ref={meshRef} position={[0, -0.8, 0]} castShadow>
        <boxGeometry args={[5, 3.5, 3]} />
        <meshStandardMaterial map={textures.metal} color="#4a5a6a" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Cylinder heads */}
      {[-1.8, -0.6, 0.6, 1.8].map((x) => (
        <group key={`cyl-${x}`}>
          <mesh position={[x, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 1.0, 12]} />
            <meshStandardMaterial color="#5a6a5a" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[x, 1.75, 0]}>
            <cylinderGeometry args={[0.28, 0.38, 0.15, 12]} />
            <meshStandardMaterial color="#7a8a7a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Crankshaft */}
      <mesh position={[0, -2.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 5.5, 8]} />
        <meshStandardMaterial color="#8a7a3a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Flywheel */}
      <mesh position={[2.8, -2.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.8, 0.8, 0.15, 16]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Label */}
      <Text position={[0, 2.6, 0]} fontSize={0.25} color="#0EA5E9" anchorX="center">
        MOTOR PRINCIPAL
      </Text>
      <Text position={[0, 2.2, 0]} fontSize={0.15} color="#10B981" anchorX="center">
        MAN B&W 6S50MC-C
      </Text>
    </group>
  );
});

// ─── Generators ─────────────────────────────────────────

function Generators({ textures }: { textures: ReturnType<typeof useInteriorTextures> }) {
  return (
    <group position={[5.5, -1.5, 0]}>
      {[-1.5, 1.5].map((z) => (
        <group key={`gen-${z}`} position={[0, 0, z]}>
          <mesh castShadow>
            <boxGeometry args={[1.8, 1.5, 1.2]} />
            <meshStandardMaterial map={textures.metal} color="#4a6a5a" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 12]} />
            <meshStandardMaterial color="#5a7a6a" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Status LED */}
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <Text position={[0, 1.2, 0]} fontSize={0.14} color="#06B6D4" anchorX="center">
        GEN AUX #1 / #2
      </Text>
    </group>
  );
}

// ─── Auxiliary Equipment ────────────────────────────────

function AuxEquipment({ textures }: { textures: ReturnType<typeof useInteriorTextures> }) {
  const items = useMemo(() => [
    { pos: [-7, -1.5, -3] as [number, number, number], label: "COMPRESOR", color: "#6a7a8a", size: [1.2, 1, 0.8] as [number, number, number] },
    { pos: [-7, -1.5, 3] as [number, number, number], label: "CALDERA AUX", color: "#7a5a4a", size: [1.4, 1.2, 1] as [number, number, number] },
    { pos: [5.5, -1.5, -4] as [number, number, number], label: "BOMBA HFO", color: "#5a6a7a", size: [0.8, 0.6, 0.6] as [number, number, number] },
    { pos: [5.5, -1.5, 4] as [number, number, number], label: "SEPARADORA", color: "#6a5a7a", size: [0.8, 0.8, 0.8] as [number, number, number] },
  ], []);

  return (
    <group>
      {items.map((eq) => (
        <group key={eq.label} position={eq.pos}>
          <mesh castShadow>
            <boxGeometry args={eq.size} />
            <meshStandardMaterial map={textures.metal} color={eq.color} roughness={0.5} metalness={0.5} />
          </mesh>
          <Text position={[0, eq.size[1] / 2 + 0.2, 0]} fontSize={0.1} color="#0EA5E9" anchorX="center">
            {eq.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ─── Equipment Status Wall Panel ────────────────────────

function StatusPanel({ equipment }: { equipment: Equipment[] }) {
  return (
    <group position={[-8.7, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
      {/* Metal frame */}
      <mesh>
        <boxGeometry args={[3, 2, 0.06]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[2.8, 1.8]} />
        <meshBasicMaterial color="#0F172A" />
      </mesh>
      {/* Title */}
      <Text position={[0, 0.7, 0.04]} fontSize={0.1} color="#94A3B8" anchorX="center">
        ESTADO EQUIPOS — SALA MÁQUINAS
      </Text>

      {equipment.slice(0, 8).map((eq, i) => {
        const color = EQUIPMENT_STATUS_COLORS[eq.status] ?? "#6B7280";
        const row = Math.floor(i / 2);
        const col = i % 2;

        return (
          <group key={eq.id} position={[col * 1.2 - 0.6, 0.35 - row * 0.35, 0.04]}>
            <mesh>
              <circleGeometry args={[0.04, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <Text position={[0.1, 0, 0]} fontSize={0.07} color={color} anchorX="left">
              {eq.code}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ─── Interior Scene ─────────────────────────────────────

function InteriorScene({ equipment }: { equipment: Equipment[] }) {
  const textures = useInteriorTextures();

  return (
    <>
      <ambientLight intensity={0.4} color="#F0F4FF" />
      <directionalLight position={[5, 12, 5]} intensity={1.0} color="#ffffff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-5, 8, -3]} intensity={0.4} color="#e8dcd0" />
      <pointLight position={[0, 3, 0]} intensity={0.4} color="#0EA5E9" />
      <pointLight position={[-5, 1, 0]} intensity={0.2} color="#EF4444" />
      <hemisphereLight args={["#b1e1ff", "#1a2535", 0.4]} />

      <EngineRoomFloor textures={textures} />
      <RoomStructure textures={textures} />
      <MainEngine textures={textures} />
      <Generators textures={textures} />
      <AuxEquipment textures={textures} />
      <StatusPanel equipment={equipment} />

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

// ─── Exported Component ─────────────────────────────────

export function Vessel3DInterior({ equipment }: { equipment: Equipment[] }) {
  return (
    <div className="relative h-[450px] md:h-[550px] rounded-xl border border-white/10 bg-[#0f1923] overflow-hidden">
      <Canvas
        camera={{ position: [8, 5, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        shadows
      >
        <color attach="background" args={["#0f1923"]} />
        <fog attach="fog" args={["#0f1923", 25, 45]} />
        <Suspense fallback={null}>
          <InteriorScene equipment={equipment} />
        </Suspense>
      </Canvas>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-linear-to-b from-[#0f1923]/90 to-transparent">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#EF4444]">⚙️ SALA DE MÁQUINAS</span>
          <span className="text-[10px] text-white/40">Vista Interior · Texturizada</span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10B981]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-linear-to-t from-[#0f1923]/90 to-transparent">
        <div className="flex items-center gap-3 text-[9px] text-white/40">
          <span>{equipment.length} equipos monitoreados</span>
          <span className="text-[#10B981]">{equipment.filter((e) => e.status === "operational").length} operativos</span>
          <span className="text-[#EF4444]">{equipment.filter((e) => e.status === "failed").length} en falla</span>
        </div>
        <div className="text-[8px] text-white/30">Drag to rotate · Scroll to zoom</div>
      </div>
    </div>
  );
}
