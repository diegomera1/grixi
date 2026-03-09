"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Text, Line } from "@react-three/drei";
import * as THREE from "three";

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
  rack_positions: Position[];
};

type IoTSensor = {
  id: string;
  sensor_type: string;
  label: string;
  position_x: number;
  position_y: number;
  position_z: number;
  current_value: number;
  unit: string;
  status: string;
  min_threshold: number | null;
  max_threshold: number | null;
};

type Operator = {
  id: string;
  name: string;
  role: string;
  avatar_color: string;
  current_zone: string | null;
  current_task: string | null;
  position_x: number;
  position_z: number;
  tasks_completed_today: number;
  items_picked_today: number;
};

type PickingOrder = {
  id: string;
  order_number: string;
  wave_id: string | null;
  status: string;
  priority: string;
  total_items: number;
  picked_items: number;
  estimated_time_min: number | null;
  items: { sku: string; qty: number; picked: boolean }[];
};

// ─── IoT Sensor 3D Nodes ────────────────────────────────

export function IoTSensors3D({ sensors }: { sensors: IoTSensor[] }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      // Gentle pulse for alarm sensors
      if (sensors[i]?.status === "alarm") {
        child.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4 + i) * 0.15);
      }
    });
  });

  const typeIcons: Record<string, string> = {
    temperature: "🌡",
    humidity: "💧",
    light: "💡",
    motion: "👁",
  };

  const statusColors: Record<string, string> = {
    active: "#22C55E",
    warning: "#F59E0B",
    alarm: "#EF4444",
    offline: "#6B7280",
  };

  return (
    <group ref={groupRef}>
      {sensors.map((sensor, i) => (
        <group key={sensor.id} position={[sensor.position_x, sensor.position_y, sensor.position_z]}>
          {/* Sensor housing */}
          <mesh>
            <boxGeometry args={[0.2, 0.12, 0.08]} />
            <meshStandardMaterial
              color={statusColors[sensor.status] || "#6B7280"}
              metalness={0.6}
              roughness={0.3}
              emissive={sensor.status === "alarm" ? "#EF4444" : "#000000"}
              emissiveIntensity={sensor.status === "alarm" ? 0.5 : 0}
            />
          </mesh>
          {/* LED indicator */}
          <mesh position={[0, -0.07, 0.05]}>
            <circleGeometry args={[0.015, 8]} />
            <meshBasicMaterial color={statusColors[sensor.status] || "#6B7280"} />
          </mesh>
          {/* Label */}
          <Html position={[0, 0.2, 0]} center style={{ pointerEvents: "none" }}>
            <div className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-bold shadow-md ${
              sensor.status === "alarm" ? "bg-red-500 text-white animate-pulse" :
              sensor.status === "warning" ? "bg-amber-500 text-white" :
              "bg-slate-800/80 text-white"
            }`}>
              {typeIcons[sensor.sensor_type]} {sensor.current_value}{sensor.unit}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ─── Operator Dots in 3D ────────────────────────────────

export function Operators3D({ operators }: { operators: Operator[] }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      // Idle = slow bounce, active = faster
      const speed = operators[i]?.current_task === "idle" ? 1 : 2.5;
      child.position.y = 0.4 + Math.sin(clock.elapsedTime * speed + i * 2) * 0.05;
    });
  });

  const taskIcons: Record<string, string> = {
    picking: "📦",
    putaway: "🏗",
    counting: "🔢",
    receiving: "📥",
    idle: "⏸",
  };

  const roleLabels: Record<string, string> = {
    picker: "Picker",
    forklift: "Montacargas",
    supervisor: "Supervisor",
    receiver: "Receptor",
  };

  return (
    <group ref={groupRef}>
      {operators.map((op) => (
        <group key={op.id} position={[op.position_x, 0.4, op.position_z]}>
          {/* Body */}
          <mesh>
            <capsuleGeometry args={[0.1, 0.3, 6, 8]} />
            <meshStandardMaterial color={op.avatar_color} roughness={0.6} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={op.avatar_color} roughness={0.5} />
          </mesh>
          {/* Safety helmet */}
          <mesh position={[0, 0.43, 0]}>
            <sphereGeometry args={[0.11, 8, 4]} />
            <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Name tag */}
          <Html position={[0, 0.7, 0]} center style={{ pointerEvents: "none" }}>
            <div className="flex flex-col items-center gap-0.5">
              <div className="whitespace-nowrap rounded bg-slate-900/85 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-lg backdrop-blur-sm">
                {taskIcons[op.current_task || "idle"]} {op.name.split(" ")[0]}
              </div>
              <div className="whitespace-nowrap rounded bg-slate-800/70 px-1 py-0.5 text-[7px] text-slate-300">
                {roleLabels[op.role]} · {op.items_picked_today} items
              </div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ─── Alert Icons floating over racks ────────────────────

export function RackAlerts3D({
  racks,
  getRackPosition,
}: {
  racks: Rack[];
  getRackPosition: (index: number) => [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.position.y = 4.5 + Math.sin(clock.elapsedTime * 2 + i) * 0.15;
    });
  });

  const alerts = useMemo(() => {
    return racks.map((rack, i) => {
      const expiredCount = rack.rack_positions.filter(
        (p) => p.inventory?.status === "expired" || (p.inventory?.expiry_date && new Date(p.inventory.expiry_date) < new Date())
      ).length;
      const quarantineCount = rack.rack_positions.filter(
        (p) => p.status === "quarantine" || p.inventory?.status === "quarantine"
      ).length;
      const lowStock = rack.rack_positions.filter((p) => p.inventory && p.inventory.quantity < 20).length;
      const occupancy = rack.rack_positions.filter((p) => p.status === "occupied").length / (rack.rack_positions.length || 1);

      const issues: { type: string; icon: string; color: string; count: number }[] = [];
      if (expiredCount > 0) issues.push({ type: "expired", icon: "⚠️", color: "#EF4444", count: expiredCount });
      if (quarantineCount > 0) issues.push({ type: "quarantine", icon: "🔒", color: "#F59E0B", count: quarantineCount });
      if (lowStock > 2) issues.push({ type: "low_stock", icon: "📉", color: "#3B82F6", count: lowStock });
      if (occupancy > 0.95) issues.push({ type: "full", icon: "🔴", color: "#DC2626", count: 0 });

      return { rackIndex: i, rack, issues };
    }).filter((a) => a.issues.length > 0);
  }, [racks]);

  return (
    <group ref={groupRef}>
      {alerts.map(({ rackIndex, rack, issues }) => {
        const [px, , pz] = getRackPosition(rackIndex);
        return (
          <group key={rack.id} position={[px, 4.5, pz]}>
            <Html center style={{ pointerEvents: "none" }}>
              <div className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 shadow-lg backdrop-blur-sm animate-pulse">
                {issues.map((issue, j) => (
                  <span key={j} className="text-[10px]" title={issue.type}>
                    {issue.icon}{issue.count > 0 ? issue.count : ""}
                  </span>
                ))}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── Heat Map Mode (color racks by occupancy) ───────────

export function HeatMapOverlay({
  racks,
  getRackPosition,
  active,
}: {
  racks: Rack[];
  getRackPosition: (index: number) => [number, number, number];
  active: boolean;
}) {
  if (!active) return null;

  return (
    <group>
      {racks.map((rack, i) => {
        const occupied = rack.rack_positions.filter((p) => p.status === "occupied").length;
        const total = rack.rack_positions.length || 1;
        const ratio = occupied / total;

        // Color gradient: green (empty) -> yellow (50%) -> red (full)
        const color = new THREE.Color();
        if (ratio < 0.5) {
          color.setHSL(0.33 - ratio * 0.33, 0.9, 0.5); // green to yellow
        } else {
          color.setHSL(0.17 - (ratio - 0.5) * 0.34, 0.9, 0.5); // yellow to red
        }

        const [px, , pz] = getRackPosition(i);

        return (
          <group key={rack.id}>
            {/* Glow on floor */}
            <mesh position={[px, 0.01, pz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.5, 2]} />
              <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
            </mesh>
            {/* Percentage label */}
            <Html position={[px, 0.5, pz]} center style={{ pointerEvents: "none" }}>
              <div
                className="rounded px-1 py-0.5 text-[9px] font-black text-white shadow"
                style={{ backgroundColor: `#${color.getHexString()}` }}
              >
                {Math.round(ratio * 100)}%
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── Stock Aging Visualization ──────────────────────────

export function StockAgingOverlay({
  racks,
  getRackPosition,
  active,
}: {
  racks: Rack[];
  getRackPosition: (index: number) => [number, number, number];
  active: boolean;
}) {
  if (!active) return null;

  return (
    <group>
      {racks.map((rack, i) => {
        const avgDays = rack.rack_positions
          .filter((p) => p.inventory?.entry_date)
          .reduce((sum, p) => {
            const days = Math.floor((Date.now() - new Date(p.inventory!.entry_date!).getTime()) / 86400000);
            return sum + days;
          }, 0) / (rack.rack_positions.filter((p) => p.inventory?.entry_date).length || 1);

        const color = new THREE.Color();
        const ratio = Math.min(avgDays / 120, 1); // 120 days = max
        color.setHSL(0.33 * (1 - ratio), 0.8, 0.5); // green -> red

        const [px, , pz] = getRackPosition(i);

        return (
          <group key={rack.id}>
            <mesh position={[px, 0.01, pz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.5, 2]} />
              <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
            </mesh>
            <Html position={[px, 0.3, pz]} center style={{ pointerEvents: "none" }}>
              <div className="rounded bg-slate-900/80 px-1 py-0.5 text-[8px] font-bold text-white">
                📅 {Math.round(avgDays)}d avg
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── ABC Classification Visual ──────────────────────────

export function ABCClassification({
  racks,
  getRackPosition,
  active,
}: {
  racks: Rack[];
  getRackPosition: (index: number) => [number, number, number];
  active: boolean;
}) {
  if (!active) return null;

  const abcColors: Record<string, string> = {
    A: "#22C55E",
    B: "#F59E0B",
    C: "#6B7280",
  };

  return (
    <group>
      {racks.map((rack, i) => {
        const totalQty = rack.rack_positions.reduce((s, p) => s + (p.inventory?.quantity || 0), 0);
        const classification = totalQty > 300 ? "A" : totalQty > 100 ? "B" : "C";
        const [px, , pz] = getRackPosition(i);

        return (
          <group key={rack.id}>
            <mesh position={[px, 0.012, pz]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.8, 16]} />
              <meshBasicMaterial color={abcColors[classification]} transparent opacity={0.3} depthWrite={false} />
            </mesh>
            <Text
              position={[px, 0.02, pz]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.25}
              color={abcColors[classification]}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {classification}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ─── Hazardous Materials Zones ──────────────────────────

export function HazardousZones({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !active) return;
    groupRef.current.children.forEach((child) => {
      if (child.userData.blink) {
        (child as THREE.Mesh).material = (child as THREE.Mesh).material;
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.1 + Math.sin(clock.elapsedTime * 3) * 0.05;
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {/* Hazardous zone in "Productos Químicos" area */}
      <mesh position={[-12, 0.006, -6]} rotation={[-Math.PI / 2, 0, 0]} userData={{ blink: true }}>
        <planeGeometry args={[4, 3]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {/* Warning stripes */}
      {Array.from({ length: 8 }, (_, j) => (
        <mesh key={`hz-stripe-${j}`} position={[-14 + j * 0.6, 0.007, -7.6]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[0.05, 0.4]} />
          <meshBasicMaterial color="#EAB308" transparent opacity={0.6} />
        </mesh>
      ))}
      <Text position={[-12, 0.01, -7.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color="#EF4444" anchorX="center" anchorY="middle">
        ☣ ZONA MATERIALES PELIGROSOS
      </Text>
      {/* Flammable symbol */}
      <Text position={[-12, 0.01, -4.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.25} color="#F59E0B" anchorX="center" anchorY="middle">
        🔥 INFLAMABLE
      </Text>
    </group>
  );
}

// ─── Temperature Fog for Cold Storage ───────────────────

export function ColdStorageFog({ active, warehouseType }: { active: boolean; warehouseType: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current || !active) return;
    const geo = particlesRef.current.geometry;
    const posAttr = geo.getAttribute("position");
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, posAttr.getY(i) + Math.sin(clock.elapsedTime + i * 0.1) * 0.002);
      posAttr.setX(i, posAttr.getX(i) + Math.cos(clock.elapsedTime * 0.5 + i * 0.2) * 0.001);
    }
    posAttr.needsUpdate = true;
  });

  if (!active || warehouseType !== "cold_storage") return null;

  return (
    <group ref={groupRef}>
      {/* Blue tint fog plane */}
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 20]} />
        <meshBasicMaterial color="#93C5FD" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {/* Ice particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color="#DBEAFE" transparent opacity={0.4} sizeAttenuation />
      </points>
    </group>
  );
}

// ─── Picking Path Animation ─────────────────────────────

export function PickingPath3D({
  path,
  active,
}: {
  path: [number, number, number][];
  active: boolean;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const [dashOffset, setDashOffset] = useState(0);

  useFrame((_, delta) => {
    setDashOffset((prev) => prev + delta * 2);
  });

  if (!active || path.length < 2) return null;

  const points = path.map((p) => new THREE.Vector3(...p));

  return (
    <group>
      <Line
        points={points}
        color="#22C55E"
        lineWidth={3}
        dashed
        dashScale={2}
        dashSize={0.3}
        dashOffset={dashOffset}
      />
      {/* Waypoint markers */}
      {points.map((pt, i) => (
        <group key={`wp-${i}`} position={pt}>
          <mesh>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color={i === 0 ? "#22C55E" : i === points.length - 1 ? "#EF4444" : "#F59E0B"} />
          </mesh>
          <Html center style={{ pointerEvents: "none" }}>
            <div className="rounded bg-emerald-600/90 px-1 py-0.5 text-[7px] font-bold text-white -mt-4">
              {i === 0 ? "INICIO" : i === points.length - 1 ? "FIN" : `#${i}`}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ─── Inbound/Outbound Dock with Truck ───────────────────

export function DockArea3D({ active }: { active: boolean }) {
  const truckRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!truckRef.current || !active) return;
    // Truck slowly backing in
    const z = 12 + Math.sin(clock.elapsedTime * 0.3) * 1.5;
    truckRef.current.position.z = z;
  });

  if (!active) return null;

  return (
    <group>
      {/* Loading dock platform */}
      <mesh position={[0, 0.3, 11.5]}>
        <boxGeometry args={[8, 0.6, 2]} />
        <meshStandardMaterial color="#374151" roughness={0.8} />
      </mesh>
      {/* Dock bumper */}
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={`bumper-${i}`} position={[x, 0.3, 10.5]}>
          <boxGeometry args={[0.3, 0.4, 0.2]} />
          <meshStandardMaterial color="#1F2937" roughness={0.7} />
        </mesh>
      ))}
      {/* Truck (simplified) */}
      <group ref={truckRef} position={[0, 0, 13]}>
        {/* Trailer */}
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[3, 2.5, 6]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.7} />
        </mesh>
        {/* Cab */}
        <mesh position={[0, 1, -3.5]}>
          <boxGeometry args={[2.5, 1.8, 1.5]} />
          <meshStandardMaterial color="#3B82F6" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Wheels */}
        {[[-1.2, 0.3, -3], [1.2, 0.3, -3], [-1.2, 0.3, 0], [1.2, 0.3, 0], [-1.2, 0.3, 2], [1.2, 0.3, 2]].map(([x, y, z], i) => (
          <mesh key={`wheel-${i}`} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 12]} />
            <meshStandardMaterial color="#1F2937" roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* Labels */}
      <Text position={[-3, 0.7, 10.3]} rotation={[0, 0, 0]} fontSize={0.18} color="#3B82F6" anchorX="center" anchorY="middle">
        🚚 MUELLE 1 — DESCARGA
      </Text>
      <Text position={[3, 0.7, 10.3]} rotation={[0, 0, 0]} fontSize={0.18} color="#F59E0B" anchorX="center" anchorY="middle">
        🚛 MUELLE 2 — CARGA
      </Text>
    </group>
  );
}

// ─── Cross-Docking Flow Lines ───────────────────────────

export function CrossDockingFlow({ active }: { active: boolean }) {
  const [offset, setOffset] = useState(0);

  useFrame((_, delta) => {
    if (active) setOffset((prev) => prev + delta * 3);
  });

  if (!active) return null;

  const flowPaths: [number, number, number][][] = [
    // Path 1: Receiving -> Shipping direct
    [[0, 0.3, 8], [0, 0.3, 5], [-6, 0.3, 5], [-6, 0.3, 8]],
    // Path 2: Cross dock through center
    [[4, 0.3, 8], [4, 0.3, 0], [8, 0.3, 0], [8, 0.3, 8]],
  ];

  return (
    <group>
      {flowPaths.map((path, i) => (
        <Line
          key={`cd-${i}`}
          points={path.map((p) => new THREE.Vector3(...p))}
          color={i === 0 ? "#06B6D4" : "#8B5CF6"}
          lineWidth={2}
          dashed
          dashScale={3}
          dashSize={0.2}
          dashOffset={offset}
        />
      ))}
      <Text position={[0, 1, 6]} fontSize={0.15} color="#06B6D4" anchorX="center" anchorY="middle">
        🔄 CROSS-DOCKING ACTIVO
      </Text>
    </group>
  );
}

// ─── AR Overlay Labels ──────────────────────────────────

export function ARLabels3D({
  racks,
  getRackPosition,
  active,
}: {
  racks: Rack[];
  getRackPosition: (index: number) => [number, number, number];
  active: boolean;
}) {
  if (!active) return null;

  return (
    <group>
      {racks.map((rack, i) => {
        const [px, , pz] = getRackPosition(i);
        const topItems = rack.rack_positions
          .filter((p) => p.inventory)
          .slice(0, 3);

        if (topItems.length === 0) return null;

        return (
          <Html key={rack.id} position={[px, 3.5, pz]} center style={{ pointerEvents: "none" }}>
            <div className="rounded-lg bg-slate-900/90 p-1.5 shadow-xl backdrop-blur-md min-w-[100px]">
              <p className="text-[8px] font-bold text-emerald-400 mb-1">📍 {rack.code}</p>
              {topItems.map((p) => (
                <div key={p.id} className="flex items-center gap-1 text-[7px] text-slate-300">
                  <span className="text-slate-500">{p.inventory!.product_sku}</span>
                  <span className="text-white font-medium">×{p.inventory!.quantity}</span>
                </div>
              ))}
              <p className="text-[6px] text-slate-500 mt-0.5">
                {rack.rack_positions.filter((p) => p.status === "occupied").length}/{rack.rack_positions.length} pos
              </p>
            </div>
          </Html>
        );
      })}
    </group>
  );
}

// ─── Cycle Count Mode Overlay ───────────────────────────

export function CycleCountOverlay({
  racks,
  getRackPosition,
  active,
  countedRacks,
}: {
  racks: Rack[];
  getRackPosition: (index: number) => [number, number, number];
  active: boolean;
  countedRacks: Set<string>;
}) {
  if (!active) return null;

  return (
    <group>
      {racks.map((rack, i) => {
        const [px, , pz] = getRackPosition(i);
        const isCounted = countedRacks.has(rack.id);

        return (
          <group key={rack.id}>
            <mesh position={[px, 0.015, pz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.5, 2]} />
              <meshBasicMaterial
                color={isCounted ? "#22C55E" : "#F59E0B"}
                transparent
                opacity={0.2}
                depthWrite={false}
              />
            </mesh>
            <Html position={[px, 3, pz]} center style={{ pointerEvents: "none" }}>
              <div className={`rounded-full px-2 py-0.5 text-[9px] font-bold shadow-md ${
                isCounted ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              }`}>
                {isCounted ? "✅ Contado" : "🔢 Pendiente"}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
