"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Warehouse,
  Package,
  Users,
  AlertTriangle,
  Activity,
  Zap,
  Radio,
  Volume2,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Mic,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import type {
  CommandCenterData,
  ActivityEvent,
  WarehouseOccupancy,
  ModuleHealth,
  CommandCenterUser,
} from "../types";

// ── Mini Sparkline (SVG) ─────────────────────────────
function Sparkline({
  data,
  color,
  height = 32,
  width = 80,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon
        fill={`url(#spark-${color})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}

// ── KPI Card ─────────────────────────────────────────
function KPICard({
  label,
  value,
  format,
  trend,
  trendPercent,
  icon: Icon,
  color,
  sparklineData,
  href,
  delay = 0,
}: {
  label: string;
  value: number;
  format: "number" | "currency" | "percentage";
  trend?: "up" | "down" | "neutral";
  trendPercent?: number;
  icon: typeof DollarSign;
  color: string;
  sparklineData?: number[];
  href?: string;
  delay?: number;
}) {
  const formatValue = (v: number) => {
    if (format === "currency") {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
      return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    if (format === "percentage") return `${v}%`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.4 }}
    >
      {/* @ts-expect-error polymorphic component */}
      <Wrapper
        {...wrapperProps}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:border-opacity-50 hover:shadow-lg",
          href && "cursor-pointer"
        )}
        style={{ borderColor: `${color}20` }}
      >
        {/* Glow background */}
        <div
          className="absolute inset-0 opacity-[0.03] transition-opacity duration-300 group-hover:opacity-[0.06]"
          style={{ background: `radial-gradient(circle at 30% 30%, ${color}, transparent 70%)` }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon size={15} style={{ color }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {formatValue(value)}
              </span>
              {trend && trendPercent !== undefined && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-semibold",
                    trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-400" : "text-[var(--text-muted)]"
                  )}
                >
                  {trend === "up" ? <TrendingUp size={12} /> : trend === "down" ? <TrendingDown size={12} /> : null}
                  {Math.abs(trendPercent)}%
                </span>
              )}
            </div>
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <Sparkline data={sparklineData} color={color} />
          )}
        </div>

        {href && (
          <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
            <span>Ver detalle</span>
            <ArrowUpRight size={10} />
          </div>
        )}
      </Wrapper>
    </motion.div>
  );
}

// ── Module Health Badge ──────────────────────────────
function ModuleHealthBadge({ health }: { health: ModuleHealth }) {
  const statusConfig = {
    healthy: { icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500" },
    warning: { icon: AlertTriangle, bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500" },
    critical: { icon: XCircle, bg: "bg-red-500/10", text: "text-red-500", dot: "bg-red-500" },
  };
  const config = statusConfig[health.status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${health.color}15` }}
      >
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: health.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">{health.label}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate">{health.metric}</p>
      </div>
      <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", config.bg)}>
        <StatusIcon size={10} className={config.text} />
        <span className={cn("text-[9px] font-bold uppercase", config.text)}>
          {health.status === "healthy" ? "OK" : health.status === "warning" ? "ALERTA" : "CRÍTICO"}
        </span>
      </div>
    </div>
  );
}

// ── Warehouse Occupancy Bar ──────────────────────────
function WarehouseBar({ warehouse }: { warehouse: WarehouseOccupancy }) {
  const occupancyColor =
    warehouse.occupancy >= 90 ? "#EF4444" : warehouse.occupancy >= 75 ? "#F59E0B" : "#10B981";

  return (
    <Link
      href={`/almacenes/${warehouse.id}`}
      className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 transition-all hover:border-emerald-500/30 hover:shadow-sm"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
        <Warehouse size={14} className="text-emerald-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
          {warehouse.name}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-muted)]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: occupancyColor }}
              initial={{ width: 0 }}
              animate={{ width: `${warehouse.occupancy}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color: occupancyColor }}
          >
            {warehouse.occupancy}%
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-[var(--text-muted)]">
          {warehouse.occupiedPositions}/{warehouse.totalPositions}
        </p>
      </div>
    </Link>
  );
}

// ── Activity Event Item ──────────────────────────────
function ActivityItem({ event, delay }: { event: ActivityEvent; delay: number }) {
  const moduleColors: Record<string, string> = {
    compras: "#F97316",
    almacenes: "#10B981",
    finanzas: "#8B5CF6",
    usuarios: "#F59E0B",
    ai: "#A855F7",
    sistema: "#6B7280",
  };
  const color = moduleColors[event.module] || "#6B7280";

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      LOGIN: "Inició sesión",
      LOGOUT: "Cerró sesión",
      PAGE_VIEW: "Visitó página",
      CREATE: "Creó recurso",
      UPDATE: "Actualizó recurso",
      DELETE: "Eliminó recurso",
    };
    return map[action] || action.replace(/_/g, " ").toLowerCase();
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay * 0.05 }}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-muted)]"
    >
      {/* User avatar */}
      <div className="relative h-6 w-6 shrink-0">
        {event.userAvatar ? (
          <Image
            src={event.userAvatar}
            alt={event.userName}
            width={24}
            height={24}
            className="rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[8px] font-bold text-[var(--text-muted)]">
            {event.userName.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Module dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)]"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[var(--text-secondary)] truncate">
          <span className="font-semibold text-[var(--text-primary)]">{event.userName.split(" ")[0]}</span>
          {" "}
          {formatAction(event.action)}
        </p>
      </div>

      <span className="shrink-0 text-[9px] font-medium text-[var(--text-muted)] tabular-nums">
        {timeAgo(event.createdAt)}
      </span>
    </motion.div>
  );
}

// ── Live Clock ───────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 text-[var(--text-muted)]">
      <Clock size={13} />
      <span className="text-xs font-mono tabular-nums">
        {time
          ? time.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "--:--:--"}
      </span>
    </div>
  );
}

// ── Main Content Component ───────────────────────────
export function CommandCenterContent({
  data,
  user,
}: {
  data: CommandCenterData;
  user: CommandCenterUser;
}) {
  const [liveActivity, setLiveActivity] = useState<ActivityEvent[]>(data.recentActivity);
  const [isPulsing, setIsPulsing] = useState(false);

  // Real-time subscription to audit_logs
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("command-center-pulse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload) => {
          const newEvent: ActivityEvent = {
            id: payload.new.id,
            action: payload.new.action,
            resourceType: payload.new.resource_type,
            createdAt: payload.new.created_at,
            userId: payload.new.user_id,
            userName: "Usuario",
            userAvatar: null,
            module: "sistema",
          };
          setLiveActivity((prev) => [newEvent, ...prev].slice(0, 20));
          setIsPulsing(true);
          setTimeout(() => setIsPulsing(false), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-4 pb-4">
      {/* ── Header ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          {/* Pulse indicator */}
          <div className="relative">
            <div className={cn(
              "h-3 w-3 rounded-full bg-emerald-500 transition-all",
              isPulsing && "animate-ping"
            )} />
            <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              CENTRO DE COMANDO
              <span className="hidden sm:inline text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-full">
                EN VIVO
              </span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              Bienvenido, {user.name.split(" ")[0]} — Visión 360° de tu operación
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LiveClock />
          <div className="hidden sm:flex h-5 w-px bg-[var(--border)]" />
          <div className="hidden sm:flex items-center gap-1.5">
            <Radio size={12} className={cn("text-emerald-500", isPulsing && "animate-pulse")} />
            <span className="text-[10px] font-medium text-emerald-500">CONECTADO</span>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Grid ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard
          label="Revenue"
          value={data.revenue}
          format="currency"
          trend={data.revenueTrend > 0 ? "up" : data.revenueTrend < 0 ? "down" : "neutral"}
          trendPercent={data.revenueTrend}
          icon={DollarSign}
          color="#10B981"
          sparklineData={data.revenueSparkline}
          href="/finanzas"
          delay={0}
        />
        <KPICard
          label="Gastos"
          value={data.expenses}
          format="currency"
          trend={data.expensesTrend > 0 ? "down" : data.expensesTrend < 0 ? "up" : "neutral"}
          trendPercent={data.expensesTrend}
          icon={TrendingDown}
          color="#EF4444"
          href="/finanzas"
          delay={1}
        />
        <KPICard
          label="OC Abiertas"
          value={data.openPOs}
          format="number"
          icon={ShoppingCart}
          color="#F97316"
          href="/compras"
          delay={2}
        />
        <KPICard
          label="Ocupación"
          value={data.stockOccupancy}
          format="percentage"
          icon={Warehouse}
          color="#10B981"
          href="/almacenes"
          delay={3}
        />
        <KPICard
          label="Productos"
          value={data.totalProducts}
          format="number"
          icon={Package}
          color="#06B6D4"
          delay={4}
        />
        <KPICard
          label="Online"
          value={data.activeUsers}
          format="number"
          icon={Users}
          color="#F59E0B"
          href="/usuarios"
          delay={5}
        />
      </div>

      {/* ── Main Grid: Module Health + Warehouses + Activity ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Module Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <Zap size={14} className="text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Estado de Módulos
            </h2>
          </div>
          <div className="space-y-2">
            {data.moduleHealth.map((health) => (
              <ModuleHealthBadge key={health.module} health={health} />
            ))}
          </div>
        </motion.div>

        {/* Warehouse Occupancy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <Warehouse size={14} className="text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Almacenes
            </h2>
          </div>
          <div className="space-y-2">
            {data.warehouseStats.map((w) => (
              <WarehouseBar key={w.id} warehouse={w} />
            ))}
          </div>
        </motion.div>

        {/* GRIXI Pulse — Live Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-violet-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                GRIXI Pulse
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <div className={cn(
                "h-1.5 w-1.5 rounded-full bg-emerald-500",
                isPulsing && "animate-ping"
              )} />
              <span className="text-[9px] font-bold uppercase text-emerald-500">Live</span>
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto space-y-0.5 scrollbar-thin">
            <AnimatePresence>
              {liveActivity.map((event, i) => (
                <ActivityItem key={event.id} event={event} delay={i} />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── Quick Stats Bar ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
      >
        <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#F97316]" />
            {data.pendingApproval} pendientes aprobación
          </span>
          <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" />
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#EF4444]" />
            {data.lowStockCount} productos stock bajo
          </span>
          <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" />
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#10B981]" />
            {data.vendorCount} proveedores activos
          </span>
          <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" />
          <span className="flex items-center gap-1.5">
            <DollarSign size={11} />
            ${data.openPOsTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} en OC abiertas
          </span>
        </div>
      </motion.div>
    </div>
  );
}
