"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type LiveEvent = {
  id: string;
  type: "measurement" | "alert" | "wo_update" | "checklist" | "system";
  title: string;
  detail: string;
  timestamp: Date;
  color: string;
  icon: string;
};

// Realistic maritime measurement simulation
const SIMULATED_READINGS = [
  { name: "Motor Principal RPM", unit: "rpm", base: 118, variance: 5, color: "#0EA5E9" },
  { name: "Temp. Gases Escape Cyl 1", unit: "°C", base: 385, variance: 15, color: "#EF4444" },
  { name: "Temp. Gases Escape Cyl 2", unit: "°C", base: 378, variance: 12, color: "#EF4444" },
  { name: "Presión Aceite Lub.", unit: "bar", base: 4.2, variance: 0.3, color: "#10B981" },
  { name: "Temp. Agua Refrigeración", unit: "°C", base: 76, variance: 3, color: "#F59E0B" },
  { name: "Consumo Combustible", unit: "MT/day", base: 24.5, variance: 1.5, color: "#8B5CF6" },
  { name: "Gen. Aux #1 Carga", unit: "%", base: 68, variance: 8, color: "#06B6D4" },
  { name: "Gen. Aux #2 Voltaje", unit: "V", base: 450, variance: 5, color: "#06B6D4" },
  { name: "Presión Vapor Caldera", unit: "bar", base: 6.2, variance: 0.5, color: "#F97316" },
  { name: "Bomba Carga #1 Presión", unit: "bar", base: 11.5, variance: 1.0, color: "#3B82F6" },
  { name: "pH Scrubber", unit: "pH", base: 6.8, variance: 0.3, color: "#14B8A6" },
  { name: "Presión Botella Aire", unit: "bar", base: 28.5, variance: 0.5, color: "#6B7280" },
];

const WO_EVENTS = [
  { wo: "WO-2026-001", title: "Overhaul Cyl. 3", detail: "Progreso: pistón removido, inspeccionando camisa" },
  { wo: "WO-2026-003", title: "Reparación Sello Bomba", detail: "Nuevo sello instalado, preparando prueba" },
  { wo: "WO-2026-010", title: "Limpieza Scrubber", detail: "Limpieza interna completada al 75%" },
  { wo: "WO-2026-008", title: "Válvulas Compresor #1", detail: "Válvula HP desmontada, midiendo desgaste" },
];

const SYSTEM_EVENTS = [
  { title: "Sincronización VSAT", detail: "Datos enviados a oficina central — 24 registros" },
  { title: "Backup automático", detail: "Base de datos local respaldada correctamente" },
  { title: "Posición GPS", detail: "Lat: 0.9537° S, Lon: 80.7339° W — Rumbo 285°" },
  { title: "Conexión satelital", detail: "Latencia: 580ms — Ancho de banda: 256 kbps" },
];

export type RealtimeReading = {
  name: string;
  value: number;
  unit: string;
  color: string;
  trend: "up" | "down" | "stable";
  timestamp: Date;
};

export function useFlotaDemo() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [readings, setReadings] = useState<RealtimeReading[]>(() =>
    SIMULATED_READINGS.map((r) => ({
      name: r.name,
      value: r.base,
      unit: r.unit,
      color: r.color,
      trend: "stable" as const,
      timestamp: new Date(),
    }))
  );
  const counterRef = useRef(0);

  const generateEvent = useCallback((): LiveEvent => {
    counterRef.current += 1;
    const rand = Math.random();

    if (rand < 0.5) {
      // Measurement reading
      const reading = SIMULATED_READINGS[Math.floor(Math.random() * SIMULATED_READINGS.length)];
      const value = reading.base + (Math.random() - 0.5) * 2 * reading.variance;
      return {
        id: `evt-${counterRef.current}`,
        type: "measurement",
        title: reading.name,
        detail: `${value.toFixed(1)} ${reading.unit}`,
        timestamp: new Date(),
        color: reading.color,
        icon: "📊",
      };
    } else if (rand < 0.7) {
      // WO update
      const wo = WO_EVENTS[Math.floor(Math.random() * WO_EVENTS.length)];
      return {
        id: `evt-${counterRef.current}`,
        type: "wo_update",
        title: `${wo.wo} — ${wo.title}`,
        detail: wo.detail,
        timestamp: new Date(),
        color: "#3B82F6",
        icon: "🔧",
      };
    } else if (rand < 0.85) {
      // Alert
      const reading = SIMULATED_READINGS[Math.floor(Math.random() * SIMULATED_READINGS.length)];
      return {
        id: `evt-${counterRef.current}`,
        type: "alert",
        title: `Alerta: ${reading.name}`,
        detail: `Valor cercano a umbral — monitoreo activo`,
        timestamp: new Date(),
        color: "#F59E0B",
        icon: "⚠️",
      };
    } else {
      // System
      const sys = SYSTEM_EVENTS[Math.floor(Math.random() * SYSTEM_EVENTS.length)];
      return {
        id: `evt-${counterRef.current}`,
        type: "system",
        title: sys.title,
        detail: sys.detail,
        timestamp: new Date(),
        color: "#6B7280",
        icon: "🛰️",
      };
    }
  }, []);

  const updateReadings = useCallback(() => {
    setReadings((prev) =>
      prev.map((r) => {
        const base = SIMULATED_READINGS.find((s) => s.name === r.name);
        if (!base) return r;
        const newValue = base.base + (Math.random() - 0.5) * 2 * base.variance;
        const trend = newValue > r.value + 0.01 ? "up" : newValue < r.value - 0.01 ? "down" : "stable";
        return { ...r, value: newValue, trend, timestamp: new Date() };
      })
    );
  }, []);

  useEffect(() => {
    // Generate events every 4-8 seconds
    const eventInterval = setInterval(() => {
      const event = generateEvent();
      setEvents((prev) => [event, ...prev].slice(0, 30));
    }, 4000 + Math.random() * 4000);

    // Update readings every 3 seconds
    const readingInterval = setInterval(updateReadings, 3000);

    // Generate initial events
    const initial = Array.from({ length: 5 }, () => generateEvent());
    setEvents(initial);

    return () => {
      clearInterval(eventInterval);
      clearInterval(readingInterval);
    };
  }, [generateEvent, updateReadings]);

  return { events, readings };
}
