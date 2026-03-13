"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ──────────────────────────────────────────────

type IoTSensor = {
  id: string;
  sensor_type: string;
  label: string;
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

// ─── View Mode Toolbar ──────────────────────────────────

type ViewMode = "normal" | "heatmap" | "aging" | "abc" | "hazardous" | "cycle_count";

export function ViewModeToolbar({
  currentMode,
  onModeChange,
  toggles,
  onToggle,
}: {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const modes: { id: ViewMode; label: string; icon: string; color: string }[] = [
    { id: "normal", label: "Normal", icon: "🏭", color: "bg-slate-500" },
    { id: "heatmap", label: "Heat Map", icon: "🔥", color: "bg-red-500" },
    { id: "aging", label: "Antigüedad", icon: "📅", color: "bg-amber-500" },
    { id: "abc", label: "ABC", icon: "🏷", color: "bg-emerald-500" },
    { id: "hazardous", label: "Peligros", icon: "☣", color: "bg-red-600" },
    { id: "cycle_count", label: "Conteo", icon: "🔢", color: "bg-blue-500" },
  ];

  const features: { key: string; label: string; icon: string }[] = [
    { key: "iot", label: "IoT", icon: "📡" },
    { key: "operators", label: "Personal", icon: "👷" },
    { key: "alerts", label: "Alertas", icon: "⚠️" },
    { key: "labels", label: "Labels", icon: "🏷" },
    { key: "dock", label: "Muelle", icon: "🚚" },
    { key: "crossdock", label: "Cross-Dock", icon: "🔄" },
    { key: "coldFog", label: "Frío", icon: "❄" },
  ];

  return (
    <div className="absolute left-1/2 bottom-3 -translate-x-1/2 flex items-center gap-2 z-20">
      {/* View modes */}
      <div className="flex items-center gap-0.5 rounded-xl bg-white/95 px-1.5 py-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md">
        <span className="text-[8px] font-semibold text-slate-400 px-1">VISTA</span>
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            title={mode.label}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold transition-all ${
              currentMode === mode.id
                ? `${mode.color} text-white shadow-md`
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="text-[10px]">{mode.icon}</span>
            {currentMode === mode.id && <span>{mode.label}</span>}
          </button>
        ))}
      </div>

      {/* Feature toggles */}
      <div className="flex items-center gap-0.5 rounded-xl bg-white/95 px-1.5 py-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md">
        <span className="text-[8px] font-semibold text-slate-400 px-1">CAPAS</span>
        {features.map((feat) => (
          <button
            key={feat.key}
            onClick={() => onToggle(feat.key)}
            title={feat.label}
            className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] transition-all ${
              toggles[feat.key]
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            {feat.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── IoT Dashboard Panel ─────────────────────────────────

export function IoTDashboardPanel({
  sensors,
  isOpen,
  onClose,
}: {
  sensors: IoTSensor[];
  isOpen: boolean;
  onClose: () => void;
}) {
  // Simulate real-time updates
  const [sensorData, setSensorData] = useState(sensors);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setSensorData((prev) =>
        prev.map((s) => ({
          ...s,
          current_value: s.current_value + (Math.random() - 0.5) * 2,
          status:
            s.current_value > (s.max_threshold || Infinity) || s.current_value < (s.min_threshold || -Infinity)
              ? "alarm"
              : Math.abs(s.current_value - (s.max_threshold || 0)) < 3
              ? "warning"
              : "active",
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    setSensorData(sensors);
  }, [sensors]);

  if (!isOpen) return null;

  const statusColors: Record<string, string> = {
    active: "text-emerald-500",
    warning: "text-amber-500",
    alarm: "text-red-500",
    offline: "text-slate-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📡</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">IoT en Vivo</h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-500 animate-pulse">● LIVE</span>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sensorData.map((sensor) => (
          <div
            key={sensor.id}
            className={`rounded-lg border p-3 transition-all ${
              sensor.status === "alarm"
                ? "border-red-500/30 bg-red-500/5 animate-pulse"
                : sensor.status === "warning"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-[var(--border)] bg-[var(--bg-muted)]/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {sensor.sensor_type === "temperature" ? "🌡" : sensor.sensor_type === "humidity" ? "💧" : sensor.sensor_type === "light" ? "💡" : "👁"}
                </span>
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-primary)]">{sensor.label}</p>
                  <p className="text-[8px] text-[var(--text-muted)] capitalize">{sensor.sensor_type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-black tabular-nums ${statusColors[sensor.status]}`}>
                  {sensor.current_value.toFixed(1)}{sensor.unit}
                </p>
                <p className="text-[7px] text-[var(--text-muted)]">
                  {sensor.min_threshold}{sensor.unit} — {sensor.max_threshold}{sensor.unit}
                </p>
              </div>
            </div>
            {/* Mini bar */}
            <div className="mt-2 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  sensor.status === "alarm" ? "bg-red-500" : sensor.status === "warning" ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(
                    Math.max(
                      ((sensor.current_value - (sensor.min_threshold || 0)) /
                        ((sensor.max_threshold || 1) - (sensor.min_threshold || 0))) *
                        100,
                      0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Labor / Operators Panel ────────────────────────────

export function LaborPanel({
  operators,
  isOpen,
  onClose,
}: {
  operators: Operator[];
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

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

  const totalItems = operators.reduce((s, o) => s + o.items_picked_today, 0);
  const activOps = operators.filter((o) => o.current_task !== "idle").length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">👷</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Personal</h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-500">{activOps}/{operators.length} activos</span>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 border-b border-[var(--border)] p-3">
        <div className="text-center">
          <p className="text-lg font-black text-[var(--text-primary)]">{operators.length}</p>
          <p className="text-[7px] text-[var(--text-muted)]">Operarios</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-emerald-500">{totalItems}</p>
          <p className="text-[7px] text-[var(--text-muted)]">Items Hoy</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-blue-500">{operators.reduce((s, o) => s + o.tasks_completed_today, 0)}</p>
          <p className="text-[7px] text-[var(--text-muted)]">Tareas</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {operators.map((op) => (
          <div key={op.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: op.avatar_color }}>
                {op.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{op.name}</p>
                <p className="text-[8px] text-[var(--text-muted)]">{roleLabels[op.role]} · Zona {op.current_zone}</p>
              </div>
              <div className="text-right">
                <p className={`text-[9px] font-bold ${op.current_task === "idle" ? "text-slate-400" : "text-emerald-500"}`}>
                  {taskIcons[op.current_task || "idle"]} {op.current_task || "idle"}
                </p>
                <p className="text-[7px] text-[var(--text-muted)]">{op.items_picked_today} items</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Wave Management Panel ──────────────────────────────

export function WaveManagementPanel({
  orders,
  isOpen,
  onClose,
  onActivatePicking,
}: {
  orders: PickingOrder[];
  isOpen: boolean;
  onClose: () => void;
  onActivatePicking: (orderId: string) => void;
}) {
  if (!isOpen) return null;

  const waves = useMemo(() => {
    const waveMap = new Map<string, PickingOrder[]>();
    orders.forEach((o) => {
      const key = o.wave_id || "sin-wave";
      if (!waveMap.has(key)) waveMap.set(key, []);
      waveMap.get(key)!.push(o);
    });
    return Array.from(waveMap.entries());
  }, [orders]);

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500 text-white",
    high: "bg-amber-500 text-white",
    normal: "bg-blue-500/10 text-blue-600",
    low: "bg-slate-200 text-slate-600",
  };

  const statusIcons: Record<string, string> = {
    pending: "⏳",
    in_progress: "🔄",
    completed: "✅",
    cancelled: "❌",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Wave Management</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {waves.map(([waveId, waveOrders]) => (
          <div key={waveId} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-violet-500 uppercase tracking-wider">
                {waveId === "sin-wave" ? "Sin Ola" : waveId}
              </span>
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[8px] text-[var(--text-muted)]">{waveOrders.length} órdenes</span>
            </div>
            {waveOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{statusIcons[order.status]}</span>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-primary)]">{order.order_number}</p>
                      <p className="text-[8px] text-[var(--text-muted)]">{order.total_items} items · ~{order.estimated_time_min || "?"}min</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[7px] font-bold ${priorityColors[order.priority]}`}>
                    {order.priority.toUpperCase()}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(order.picked_items / (order.total_items || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-bold text-[var(--text-muted)]">{order.picked_items}/{order.total_items}</span>
                </div>
                {/* Action button */}
                {order.status === "pending" && (
                  <button
                    onClick={() => onActivatePicking(order.id)}
                    className="mt-2 w-full rounded-md bg-emerald-500 px-2 py-1 text-[9px] font-bold text-white hover:bg-emerald-600 transition-colors"
                  >
                    ▶ Iniciar Picking
                  </button>
                )}
                {order.status === "in_progress" && (
                  <button
                    onClick={() => onActivatePicking(order.id)}
                    className="mt-2 w-full rounded-md bg-blue-500 px-2 py-1 text-[9px] font-bold text-white hover:bg-blue-600 transition-colors"
                  >
                    🗺 Ver Ruta en 3D
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Alert Feed Sidebar ─────────────────────────────────

type Alert = {
  id: string;
  type: "expired" | "quarantine" | "low_stock" | "sensor_alarm" | "full_rack";
  message: string;
  rackCode?: string;
  severity: "critical" | "warning" | "info";
  timestamp: Date;
};

export function AlertFeed({
  racks,
  sensors,
  isOpen,
  onClose,
}: {
  racks: { code: string; rack_positions: { status: string; inventory: { expiry_date: string | null; status: string; quantity: number; product_name: string } | null }[] }[];
  sensors: IoTSensor[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    let counter = 0;

    // Rack-based alerts
    racks.forEach((rack) => {
      const expired = rack.rack_positions.filter(
        (p) => p.inventory?.status === "expired" || (p.inventory?.expiry_date && new Date(p.inventory.expiry_date) < new Date())
      );
      if (expired.length > 0) {
        result.push({
          id: `exp-${counter++}`,
          type: "expired",
          message: `${expired.length} item(s) vencidos en rack ${rack.code}`,
          rackCode: rack.code,
          severity: "critical",
          timestamp: new Date(),
        });
      }

      const quarantine = rack.rack_positions.filter((p) => p.status === "quarantine" || p.inventory?.status === "quarantine");
      if (quarantine.length > 0) {
        result.push({
          id: `quar-${counter++}`,
          type: "quarantine",
          message: `${quarantine.length} item(s) en cuarentena — rack ${rack.code}`,
          rackCode: rack.code,
          severity: "warning",
          timestamp: new Date(Date.now() - Math.random() * 3600000),
        });
      }

      const lowStock = rack.rack_positions.filter((p) => p.inventory && p.inventory.quantity < 20);
      if (lowStock.length > 2) {
        result.push({
          id: `low-${counter++}`,
          type: "low_stock",
          message: `${lowStock.length} posiciones con stock bajo en ${rack.code}`,
          rackCode: rack.code,
          severity: "info",
          timestamp: new Date(Date.now() - Math.random() * 7200000),
        });
      }
    });

    // Sensor alerts
    sensors.forEach((sensor) => {
      if (sensor.status === "alarm") {
        result.push({
          id: `sensor-${sensor.id}`,
          type: "sensor_alarm",
          message: `${sensor.label}: ${sensor.current_value.toFixed(1)}${sensor.unit} fuera de rango`,
          severity: "critical",
          timestamp: new Date(),
        });
      }
    });

    return result.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [racks, sensors]);

  if (!isOpen) return null;

  const severityStyles: Record<string, string> = {
    critical: "border-red-500/30 bg-red-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };

  const typeIcons: Record<string, string> = {
    expired: "⚠️",
    quarantine: "🔒",
    low_stock: "📉",
    sensor_alarm: "🚨",
    full_rack: "🔴",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔔</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Alertas</h3>
          {alerts.filter((a) => a.severity === "critical").length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[8px] font-bold text-white animate-pulse">
              {alerts.filter((a) => a.severity === "critical").length} críticas
            </span>
          )}
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
            <span className="text-2xl mb-2">✅</span>
            <p className="text-xs">Sin alertas activas</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`rounded-lg border p-2.5 ${severityStyles[alert.severity]}`}>
              <div className="flex items-start gap-2">
                <span className="text-sm">{typeIcons[alert.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--text-primary)]">{alert.message}</p>
                  <p className="text-[8px] text-[var(--text-muted)] mt-0.5">
                    {alert.timestamp.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                    {alert.rackCode && ` · Rack ${alert.rackCode}`}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ─── Capacity Planning Panel ────────────────────────────

export function CapacityPlanningPanel({
  racks,
  isOpen,
  onClose,
}: {
  racks: { code: string; rows: number; columns: number; rack_positions: { status: string }[] }[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [incomingQty, setIncomingQty] = useState(50);

  const totalEmpty = racks.reduce((s, r) => s + r.rack_positions.filter((p) => p.status === "empty").length, 0);
  const totalPositions = racks.reduce((s, r) => s + r.rack_positions.length, 0);
  const canFit = incomingQty <= totalEmpty;

  const suggestions = useMemo(() => {
    return racks
      .map((rack) => ({
        code: rack.code,
        emptySlots: rack.rack_positions.filter((p) => p.status === "empty").length,
        total: rack.rack_positions.length,
      }))
      .filter((r) => r.emptySlots > 0)
      .sort((a, b) => b.emptySlots - a.emptySlots);
  }, [racks]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📐</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Capacidad</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="border-b border-[var(--border)] p-4">
        <p className="text-[9px] font-semibold text-[var(--text-muted)] mb-2">¿Cuántas posiciones necesitas?</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={incomingQty}
            onChange={(e) => setIncomingQty(parseInt(e.target.value) || 0)}
            className="w-20 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm font-bold text-[var(--text-primary)]"
          />
          <div className={`rounded-full px-3 py-1 text-[9px] font-bold ${canFit ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            {canFit ? `✅ Caben (${totalEmpty} libres)` : `❌ No caben (solo ${totalEmpty} libres)`}
          </div>
        </div>
        {/* Visual bar */}
        <div className="mt-3 h-3 w-full rounded-full bg-slate-200 overflow-hidden relative">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((totalPositions - totalEmpty) / totalPositions) * 100}%` }} />
          {canFit && (
            <div
              className="absolute top-0 h-full bg-blue-500/50 rounded-full"
              style={{
                left: `${((totalPositions - totalEmpty) / totalPositions) * 100}%`,
                width: `${(incomingQty / totalPositions) * 100}%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[7px] text-[var(--text-muted)]">Usado: {totalPositions - totalEmpty}</span>
          <span className="text-[7px] text-blue-500 font-bold">+ {incomingQty} nuevo</span>
          <span className="text-[7px] text-[var(--text-muted)]">Total: {totalPositions}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[9px] font-bold text-[var(--text-muted)] mb-2">📍 Racks con espacio disponible</p>
        <div className="space-y-1.5">
          {suggestions.map((r) => (
            <div key={r.code} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--text-primary)]">{r.code}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${((r.total - r.emptySlots) / r.total) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-emerald-500">{r.emptySlots} libres</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Slotting Optimizer Panel ───────────────────────────

export function SlottingOptimizerPanel({
  racks,
  isOpen,
  onClose,
}: {
  racks: { code: string; rack_positions: { status: string; inventory: { product_name: string; quantity: number; category: string } | null }[] }[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<{ from: string; to: string; product: string; reason: string }[]>([]);

  const runOptimizer = useCallback(() => {
    setOptimizing(true);
    // Simulate AI optimization delay
    setTimeout(() => {
      const sug: { from: string; to: string; product: string; reason: string }[] = [];
      // Find high-qty items far from exit and suggest moving closer
      racks.forEach((rack) => {
        rack.rack_positions.forEach((pos) => {
          if (pos.inventory && pos.inventory.quantity > 300) {
            sug.push({
              from: rack.code,
              to: "A-01",
              product: pos.inventory.product_name,
              reason: "Alta rotación → Mover cerca de salida",
            });
          }
        });
      });
      // Add some general suggestions
      sug.push(
        { from: "E-02", to: "B-01", product: "Items ligeros", reason: "Consolidar items < 5kg en zona B" },
        { from: "D-02", to: "C-01", product: "Químicos", reason: "Reagrupar por categoría en zona segura" },
      );
      setSuggestions(sug.slice(0, 6));
      setOptimizing(false);
    }, 2000);
  }, [racks]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧩</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Slotting Optimizer</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <button
          onClick={runOptimizer}
          disabled={optimizing}
          className="w-full rounded-lg bg-violet-500 px-4 py-2.5 text-[11px] font-bold text-white shadow-md hover:bg-violet-600 transition-colors disabled:opacity-50"
        >
          {optimizing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              AI analizando layout...
            </span>
          ) : (
            "🧠 Optimizar Slotting con AI"
          )}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[9px] font-bold text-violet-500 mb-1">Sugerencias de reubicación:</p>
          {suggestions.map((sug, i) => (
            <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
              <div className="flex items-center gap-1 text-[10px]">
                <span className="font-bold text-red-400">{sug.from}</span>
                <span className="text-[var(--text-muted)]">→</span>
                <span className="font-bold text-emerald-400">{sug.to}</span>
              </div>
              <p className="text-[9px] font-semibold text-[var(--text-primary)] mt-0.5">{sug.product}</p>
              <p className="text-[8px] text-[var(--text-muted)]">{sug.reason}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Guided Tour Presentation ───────────────────────────

export function GuidedTourOverlay({
  racks,
  active,
  onNavigate,
  onEnd,
  onAction,
}: {
  racks: { code: string; rack_positions: { status: string }[] }[];
  active: boolean;
  onNavigate: (index: number) => void;
  onEnd: () => void;
  onAction?: (action: string, value?: unknown) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const steps = useMemo(() => [
    {
      title: "🌐 Vista General del Almacén",
      description: isMobile
        ? "Estás viendo tu almacén en 3D. Usa un dedo para rotar la vista y dos dedos para mover la cámara. Cada estructura es un rack con sus productos."
        : "Estás viendo una representación 3D de tu almacén. Arrastra con el mouse para rotar la vista. Click derecho + arrastra para mover la cámara. Cada estructura es un rack con sus posiciones e inventario.",
      action: "overview",
    },
    {
      title: "🔍 Acercar y Alejar (Zoom)",
      description: isMobile
        ? "Haz pinch con dos dedos para acercarte o alejarte. Acércate a un rack para ver sus productos individuales con colores según categoría."
        : "Usa la rueda del mouse para hacer zoom. Acércate para ver los productos individuales dentro de cada rack — cada caja tiene un color según su categoría de producto.",
      action: "zoom",
    },
    {
      title: "📦 Seleccionar un Rack",
      description: isMobile
        ? "Toca cualquier rack para ver sus detalles: número de posiciones, productos almacenados, estado de cada slot y datos del inventario."
        : "Haz click en cualquier rack para seleccionarlo. Verás sus detalles completos: código del rack, posiciones ocupadas/vacías, productos con SKU, lotes, fechas de vencimiento y más.",
      action: "selectRack",
    },
    {
      title: "🔎 Buscar Productos",
      description: "Se abre el buscador inteligente. Puedes buscar cualquier producto por nombre, SKU o categoría. Los resultados te llevan directo al rack donde está el producto.",
      action: "search",
    },
    {
      title: "🔥 Modos de Visualización",
      description: "Se activó el Mapa de Calor. Este modo colorea los racks según su nivel de ocupación (verde = bajo, amarillo = medio, rojo = lleno). También hay modos: ABC (clasificación Pareto), Antigüedad (días almacenado), y Conteo Cíclico.",
      action: "heatmap",
    },
    {
      title: "📡 Paneles de Control",
      description: "El botón 'Más' abre herramientas avanzadas: IoT (sensores de temperatura/humedad), Personal (operarios activos), Waves (órdenes de picking), Alertas (vencimientos, stock bajo), Capacidad (slots disponibles) y Slotting con IA.",
      action: "showTools",
    },
    {
      title: "👁 Vista en Primera Persona",
      description: isMobile
        ? "El modo FPS te permite recorrer el almacén como si caminaras dentro de él. En móvil, la experiencia es más limitada — se recomienda usar esta función en desktop."
        : "El modo FPS (Primera Persona) te permite recorrer el almacén como si caminaras dentro. Usa WASD para moverte, mouse para mirar alrededor, E/Q para subir/bajar. Click para capturar el mouse. ESC para salir.",
      action: "fps",
    },
    {
      title: "📸 Captura de Pantalla",
      description: "Puedes tomar capturas del estado actual del almacén 3D en cualquier momento con el botón de cámara. Útil para reportes, documentación o compartir el estado del inventario con tu equipo.",
      action: "screenshot",
    },
  ], [isMobile]);

  // Execute action for current step
  useEffect(() => {
    if (!active) return;
    const step = steps[currentStep];
    if (!step || !onAction) return;

    onAction(step.action);

    return () => {
      // Cleanup: reset the action when leaving the step
      onAction("cleanup", step.action);
    };
  }, [currentStep, active, steps, onAction]);

  // Auto-play mode
  useEffect(() => {
    if (!active || !autoPlay) return;
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= steps.length) {
          setAutoPlay(false);
          onEnd();
          return 0;
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [active, autoPlay, steps, onEnd]);

  // Reset on deactivate
  useEffect(() => {
    if (!active) setCurrentStep(0);
  }, [active]);

  if (!active) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      onEnd();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  };

  return (
    <>
      {/* Full-screen semi-transparent backdrop */}
      <div className="fixed inset-0 z-[998] bg-black/30 pointer-events-none" />
      {/* Tour card — fixed, centered, always on top */}
      <div className="fixed inset-x-0 top-4 md:top-6 flex justify-center z-[999] px-4 pointer-events-none">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          className="pointer-events-auto w-full max-w-md rounded-2xl bg-slate-900/95 px-5 py-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
        >
          {/* Progress bar */}
          <div className="mb-3 h-1 w-full rounded-full bg-slate-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.description}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500">{currentStep + 1} de {steps.length}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onEnd}
                className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:scale-95"
              >
                Salir
              </button>
              <button
                onClick={goPrev}
                disabled={currentStep === 0}
                className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:text-white disabled:opacity-30 active:scale-95"
              >
                ← Ant.
              </button>
              <button
                onClick={goNext}
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-emerald-400 active:scale-95"
              >
                {currentStep === steps.length - 1 ? "Fin ✓" : "Sig. →"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ─── Warehouse Comparison Split View ────────────────────

export function WarehouseComparisonPanel({
  warehouses,
  isOpen,
  onClose,
  onNavigate,
}: {
  warehouses: { id: string; name: string; type: string }[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (warehouseId: string) => void;
}) {
  if (!isOpen) return null;

  const warehouseIcons: Record<string, string> = {
    general: "🏭",
    cold_storage: "❄️",
    raw_materials: "📦",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex gap-2 rounded-xl bg-white/95 p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-md"
    >
      <span className="self-center text-[9px] font-bold text-slate-400 mr-1">NAVEGAR A:</span>
      {warehouses.map((wh) => (
        <button
          key={wh.id}
          onClick={() => {
            onNavigate(wh.id);
            onClose();
          }}
          className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-[10px] font-bold text-slate-700 transition-all hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md"
        >
          <span className="text-lg">{warehouseIcons[wh.type] || "🏭"}</span>
          <span>{wh.name}</span>
        </button>
      ))}
      <button onClick={onClose} className="ml-1 self-center rounded-md p-1 text-slate-400 hover:text-slate-600">
        ✕
      </button>
    </motion.div>
  );
}
