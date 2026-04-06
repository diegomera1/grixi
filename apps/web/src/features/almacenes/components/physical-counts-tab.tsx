"use client";

import { useState, useTransition, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Plus, Search, CheckCircle2,
  Play, AlertCircle, Loader2, X, Warehouse,
  Target, XCircle, ChevronLeft,
  MapPin, Check, AlertTriangle,
  ChevronRight, Scan, Clock, CalendarDays,
  Package, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchCountItems, fetchWarehouseRacksForPreview } from "../actions/stock-hierarchy-actions";
import type { CountItem, MiniRack } from "../actions/stock-hierarchy-actions";
import { useTheme } from "next-themes";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Float, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ── Types ─────────────────────────────────────────────
type PhysicalCountRow = {
  id: string;
  count_number: string;
  warehouse_id: string;
  warehouse_name: string;
  status: string;
  count_type: string;
  total_positions: number;
  counted_positions: number;
  variance_count: number;
  start_date: string | null;
  notes: string | null;
};

const STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  planned:     { label: "Planificado",    color: "text-blue-400",    bg: "bg-blue-500/10",    icon: CalendarDays },
  in_progress: { label: "En Progreso",   color: "text-amber-400",   bg: "bg-amber-500/10",   icon: Play },
  completed:   { label: "Completado",    color: "text-indigo-400",  bg: "bg-indigo-500/10",  icon: Target },
  posted:      { label: "Contabilizado", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  cancelled:   { label: "Cancelado",     color: "text-zinc-400",    bg: "bg-zinc-500/10",    icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  cycle: "Cíclico", annual: "Anual", spot: "Spot Check", full: "Completo", abc: "ABC",
};

type PhysicalCountsTabProps = {
  counts: PhysicalCountRow[];
  warehouses: { id: string; name: string }[];
  onRefresh?: () => void;
};

// ══════════════════════════════════════════════════════════════
// ── MAIN TAB ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
export function PhysicalCountsTab({ counts, warehouses, onRefresh }: PhysicalCountsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [postingId, setPostingId] = useState<string | null>(null);

  const filtered = counts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || c.count_number.toLowerCase().includes(q) || c.warehouse_name.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCounts = counts.length;
  const activeCounts = counts.filter((c) => c.status === "in_progress").length;
  const avgAccuracy = (() => {
    const done = counts.filter((c) => ["completed", "posted"].includes(c.status) && c.total_positions > 0);
    if (!done.length) return 100;
    return Math.round(done.reduce((a, c) => a + ((c.total_positions - c.variance_count) / c.total_positions) * 100, 0) / done.length * 10) / 10;
  })();
  const pendingAdjust = counts.filter((c) => c.status === "completed").length;

  function handlePost(id: string) {
    setPostingId(id);
    startTransition(async () => {
      try {
        const resp = await fetch("/api/wms/operations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "adjust_physical_count", id }),
        });
        const res = await resp.json();
        if (res.success) { toast.success("Conteo contabilizado"); onRefresh?.(); }
        else toast.error(res.message);
      } catch { toast.error("Error al contabilizar"); }
      setPostingId(null);
    });
  }

  // Execution panel
  const activeCount = activeCountId ? counts.find((c) => c.id === activeCountId) : null;
  if (activeCount) {
    return <CountExecutionPanel count={activeCount} onBack={() => { setActiveCountId(null); onRefresh?.(); }} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4" data-tour="conteos-content">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Conteos", value: totalCounts, icon: ClipboardList, color: "text-indigo-400", bg: "bg-indigo-500/8" },
          { label: "En Progreso", value: activeCounts, icon: Play, color: "text-amber-400", bg: "bg-amber-500/8" },
          { label: "Precisión Prom.", value: `${avgAccuracy}%`, icon: Target, color: "text-emerald-400", bg: "bg-emerald-500/8" },
          { label: "Pendiente Ajuste", value: pendingAdjust, icon: AlertCircle,
            color: pendingAdjust > 0 ? "text-orange-400" : "text-emerald-400",
            bg: pendingAdjust > 0 ? "bg-orange-500/8" : "bg-emerald-500/8" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", kpi.bg)}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-text-primary">{kpi.value}</p>
              <p className="text-[10px] font-medium text-text-muted">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" placeholder="Buscar conteo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-colors" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "in_progress", "completed", "posted"].map((st) => (
            <button key={st} onClick={() => setStatusFilter(st)}
              className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors border",
                statusFilter === st ? "bg-brand/10 text-brand border-brand/20" : "text-text-muted hover:text-text-primary bg-surface border-border")}>
              {st === "all" ? "Todos" : STATUS[st]?.label || st}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:shadow-brand/20 transition-all">
          <Plus size={13} /> Nuevo Conteo
        </button>
      </div>

      {/* Counts Grid */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <ClipboardList size={32} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Sin conteos</p>
            <p className="text-[11px] mt-1">Crea uno con el botón de arriba</p>
          </div>
        ) : (
          filtered.map((c, i) => {
            const st = STATUS[c.status] || STATUS.planned;
            const StIcon = st.icon;
            const pct = c.total_positions > 0 ? Math.round((c.counted_positions / c.total_positions) * 100) : 0;
            const canExec = c.status === "in_progress";
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={cn("group rounded-xl border bg-surface p-4 transition-all",
                  canExec ? "border-amber-500/25 hover:border-amber-400/50 cursor-pointer hover:shadow-lg hover:shadow-amber-500/5" : "border-border")}
                onClick={canExec ? () => setActiveCountId(c.id) : undefined}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mt-0.5 shrink-0", st.bg)}>
                      <StIcon size={18} className={st.color} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-text-primary font-mono">{c.count_number}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", st.bg, st.color)}>{st.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-text-muted">{TYPE_LABELS[c.count_type] || c.count_type}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-text-secondary"><Warehouse size={11} /> {c.warehouse_name}</span>
                        <span className="flex items-center gap-1 text-[11px] text-text-muted">
                          <CalendarDays size={10} /> {c.start_date ? new Date(c.start_date).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}
                        </span>
                      </div>
                      {c.notes && <p className="text-[10px] text-text-muted mt-1 truncate max-w-md italic">{c.notes}</p>}
                      {canExec && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-amber-400 font-semibold group-hover:text-amber-300 transition-colors">
                          <Scan size={11} className="animate-pulse" /> Toca para iniciar conteo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right min-w-[100px]">
                      <div className="flex items-center justify-end gap-2 mb-1.5">
                        <span className="text-[10px] text-text-muted">{c.counted_positions}/{c.total_positions} pos.</span>
                        <span className={cn("text-xs font-bold tabular-nums", pct === 100 ? "text-emerald-400" : "text-text-primary")}>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? "bg-emerald-500" : "bg-brand")} style={{ width: `${pct}%` }} />
                      </div>
                      {c.variance_count > 0 && (
                        <span className="flex items-center gap-1 mt-1 justify-end text-[9px] text-amber-400 font-medium">
                          <AlertTriangle size={9} /> {c.variance_count} varianzas
                        </span>
                      )}
                    </div>
                    {c.status === "completed" && (
                      <button onClick={() => handlePost(c.id)} disabled={postingId === c.id || isPending}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {postingId === c.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        {postingId === c.id ? "Ajustando..." : "Contabilizar"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateCountModal warehouses={warehouses} onClose={() => setShowCreateModal(false)}
            onCreated={(id) => { setShowCreateModal(false); onRefresh?.(); setTimeout(() => setActiveCountId(id), 600); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── 3D HOLOGRAPHIC SINGLE-RACK VIEW (visual only) ────────────
// ══════════════════════════════════════════════════════════════
function PulsingBox({ position, size, color, emissive, status }: {
  position: [number, number, number]; size: [number, number, number];
  color: string; emissive: string; status: "active" | "counted" | "variance" | "pending";
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    if (status === "active") {
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.5 + 0.5;
      mat.emissiveIntensity = 0.5 + pulse * 1.5;
      ref.current.scale.setScalar(1 + pulse * 0.04);
    } else if (status === "counted") {
      mat.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
    } else if (status === "variance") {
      mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
  });

  return (
    <mesh ref={ref} position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={status === "pending" ? 0 : 0.4}
        roughness={status === "pending" ? 0.8 : 0.3}
        metalness={status === "pending" ? 0.05 : 0.4}
        transparent
        opacity={status === "pending" ? 0.35 : 0.95}
      />
    </mesh>
  );
}

function HoloRackScene({ rack, countStatus, activePosition, isDark }: {
  rack: MiniRack; countStatus: Map<string, "pending" | "counted" | "variance">;
  activePosition: { row: number; col: number } | null; isDark: boolean;
}) {
  const cw = 0.35;
  const ch = 0.3;
  const rW = rack.columns * cw;
  const rH = rack.rows * ch;
  const rD = 0.35;
  const center = useMemo(() => new THREE.Vector3(0, rH / 2, 0), [rH]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={isDark ? 0.3 : 0.6} />
      <directionalLight position={[3, 5, 4]} intensity={isDark ? 0.5 : 0.8} color={isDark ? "#c7d2fe" : "#ffffff"} />
      <pointLight position={[0, rH + 0.5, 0.5]} intensity={0.3} color="#6366f1" distance={4} />
      {activePosition && (
        <pointLight
          position={[
            (activePosition.col - 1) * cw - rW / 2 + cw / 2,
            (activePosition.row - 1) * ch + ch * 0.4,
            0.5,
          ]}
          intensity={1.2} color="#f59e0b" distance={1.5} decay={2}
        />
      )}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[rW + 1.5, rD + 1.5]} />
        <meshBasicMaterial color={isDark ? "#0c0f1a" : "#eaeaef"} />
      </mesh>
      {/* Base glow strip */}
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[rW + 0.06, 0.016, rD + 0.06]} />
        <meshStandardMaterial color="#4f46e5" metalness={0.7} roughness={0.2} emissive="#4f46e5" emissiveIntensity={isDark ? 0.3 : 0.08} />
      </mesh>

      {/* Posts */}
      {[-1, 1].map((xD) => [-1, 1].map((zD) => (
        <mesh key={`p-${xD}-${zD}`} position={[(xD * rW) / 2, rH / 2, (zD * rD) / 2]}>
          <boxGeometry args={[0.025, rH, 0.025]} />
          <meshStandardMaterial color="#818cf8" metalness={0.6} roughness={0.2} emissive="#6366f1" emissiveIntensity={isDark ? 0.12 : 0.04} />
        </mesh>
      )))}

      {/* Shelf beams + surfaces */}
      {Array.from({ length: rack.rows + 1 }, (_, i) => {
        const y = i * ch;
        return (
          <group key={`sh-${i}`}>
            <mesh position={[0, y, rD / 2]}>
              <boxGeometry args={[rW + 0.02, 0.015, 0.012]} />
              <meshStandardMaterial color="#818cf8" metalness={0.5} roughness={0.25} />
            </mesh>
            <mesh position={[0, y, -rD / 2]}>
              <boxGeometry args={[rW + 0.02, 0.015, 0.012]} />
              <meshStandardMaterial color="#818cf8" metalness={0.5} roughness={0.25} />
            </mesh>
            <mesh position={[0, y + 0.008, 0]}>
              <boxGeometry args={[rW - 0.01, 0.003, rD - 0.03]} />
              <meshStandardMaterial color={isDark ? "#1e1b4b" : "#ddd6fe"} transparent opacity={isDark ? 0.4 : 0.25} />
            </mesh>
          </group>
        );
      })}

      {/* Row markers (left) */}
      {Array.from({ length: rack.rows }, (_, i) => (
        <Text key={`rl-${i}`}
          position={[-rW / 2 - 0.08, i * ch + ch * 0.4, rD / 2 + 0.01]}
          fontSize={0.05} color={isDark ? "#a5b4fc" : "#6366f1"}
          anchorX="right" anchorY="middle">
          {`F${i + 1}`}
        </Text>
      ))}

      {/* Column markers (top) */}
      {Array.from({ length: rack.columns }, (_, i) => (
        <Text key={`cl-${i}`}
          position={[i * cw - rW / 2 + cw / 2, rH + 0.04, rD / 2 + 0.01]}
          fontSize={0.04} color={isDark ? "#a5b4fc" : "#6366f1"}
          anchorX="center" anchorY="middle">
          {`C${i + 1}`}
        </Text>
      ))}

      {/* Inventory boxes */}
      {rack.rack_positions.map((pos) => {
        const cx = (pos.column_number - 1) * cw - rW / 2 + cw / 2;
        const cy = (pos.row_number - 1) * ch + ch * 0.4;
        const key = `${rack.code}-${pos.row_number}-${pos.column_number}`;
        const st = countStatus.get(key);
        if (!st) return null;

        const isActive = activePosition?.row === pos.row_number && activePosition?.col === pos.column_number;
        const statusKey = isActive ? "active" : st;
        const colorMap = {
          active:   { box: "#f59e0b", emit: "#f59e0b" },
          counted:  { box: "#10b981", emit: "#10b981" },
          variance: { box: "#ef4444", emit: "#ef4444" },
          pending:  { box: isDark ? "#475569" : "#94a3b8", emit: "#000000" },
        };
        const c = colorMap[statusKey] || colorMap.pending;

        return (
          <group key={pos.id}>
            <PulsingBox
              position={[cx, cy, 0]}
              size={[cw * 0.7, ch * 0.55, rD * 0.5]}
              color={c.box} emissive={c.emit} status={statusKey}
            />
            {/* Tiny label on front face */}
            <Text position={[cx, cy, rD * 0.26]} fontSize={0.028}
              color={statusKey === "pending" ? (isDark ? "#94a3b8" : "#64748b") : "#ffffff"}
              anchorX="center" anchorY="middle">
              {`${pos.row_number}·${pos.column_number}`}
            </Text>
          </group>
        );
      })}

      {/* Rack code label floating above */}
      <Float speed={1} floatIntensity={0.04} rotationIntensity={0}>
        <Text position={[0, rH + 0.12, 0]} fontSize={0.09}
          color={isDark ? "#c7d2fe" : "#4f46e5"}
          anchorX="center" anchorY="middle">
          {rack.code}
        </Text>
      </Float>

      {/* OrbitControls — constrained around rack */}
      <OrbitControls
        target={center}
        enablePan={false}
        enableZoom={true}
        minDistance={0.8}
        maxDistance={4}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={0.2}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// ── COUNT EXECUTION PANEL ────────────────────────────────────
// ══════════════════════════════════════════════════════════════
function CountExecutionPanel({ count, onBack }: { count: PhysicalCountRow; onBack: () => void }) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [items, setItems] = useState<CountItem[]>([]);
  const [racks3D, setRacks3D] = useState<MiniRack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRack, setActiveRack] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [countedQty, setCountedQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [countItems, rackData] = await Promise.all([
      fetchCountItems(count.id),
      fetchWarehouseRacksForPreview(count.warehouse_id),
    ]);
    setItems(countItems);
    if (rackData?.racks) setRacks3D(rackData.racks);
    // Auto-select first rack with pending items
    if (countItems.length > 0) {
      const pending = countItems.find((i) => i.status === "pending");
      setActiveRack(pending ? pending.rack_code : countItems[0].rack_code);
    }
    setLoading(false);
  }, [count.id, count.warehouse_id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (activeItemId && inputRef.current) inputRef.current.focus(); }, [activeItemId]);

  // Active rack 3D data
  const activeRack3D = useMemo(() => {
    if (!activeRack) return null;
    return racks3D.find((r) => r.code === activeRack) || null;
  }, [activeRack, racks3D]);

  // Active position (from the selected item)
  const activePosition = useMemo(() => {
    if (!activeItemId) return null;
    const item = items.find((i) => i.id === activeItemId);
    if (!item) return null;
    return { row: item.row_number, col: item.column_number };
  }, [activeItemId, items]);

  // Computed
  const countedCount = items.filter((i) => i.status === "counted").length;
  const pendingCount = items.length - countedCount;
  const varianceCount = items.filter((i) => i.status === "counted" && i.variance !== 0).length;
  const progress = items.length > 0 ? Math.round((countedCount / items.length) * 100) : 0;

  const rackGroups = useMemo(() => {
    const m: Record<string, CountItem[]> = {};
    for (const it of items) { if (!m[it.rack_code]) m[it.rack_code] = []; m[it.rack_code].push(it); }
    return m;
  }, [items]);
  const rackCodes = Object.keys(rackGroups).sort();

  // 3D status map
  const countStatus = useMemo(() => {
    const m = new Map<string, "pending" | "counted" | "variance">();
    for (const it of items) {
      m.set(`${it.rack_code}-${it.row_number}-${it.column_number}`, it.status === "counted" ? (it.variance !== 0 ? "variance" : "counted") : "pending");
    }
    return m;
  }, [items]);

  const currentItems = activeRack ? (rackGroups[activeRack] || []) : [];
  const rackDoneCount = currentItems.filter((i) => i.status === "counted").length;

  // Save
  async function handleSave(itemId: string) {
    if (!countedQty.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/wms/operations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_count_item", item_id: itemId, counted_quantity: Number(countedQty) }),
      });
      const res = await resp.json();
      if (res.success) {
        const v = res.variance;
        toast.success(v === 0 ? "✓ Coincide con el sistema" : `Varianza: ${v > 0 ? "+" : ""}${v}`, { duration: 2000 });
        setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, counted_quantity: Number(countedQty), variance: v, status: "counted", counted_at: new Date().toISOString() } : i));
        setActiveItemId(null);
        setCountedQty("");
        // Auto-next
        const rackItems = rackGroups[activeRack || ""] || [];
        const idx = rackItems.findIndex((i) => i.id === itemId);
        const next = rackItems.find((i, ii) => ii > idx && i.status === "pending");
        if (next) setTimeout(() => setActiveItemId(next.id), 150);
        else {
          const nextRack = rackCodes.find((r) => r !== activeRack && (rackGroups[r] || []).some((i) => i.status === "pending"));
          if (nextRack) { toast.info(`✓ Rack ${activeRack} listo → ${nextRack}`); setTimeout(() => setActiveRack(nextRack), 400); }
        }
      } else toast.error(res.message);
    } catch { toast.error("Error al guardar"); }
    setSaving(false);
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const resp = await fetch("/api/wms/operations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_physical_count", id: count.id }),
      });
      const res = await resp.json();
      if (res.success) { toast.success("🎉 Conteo finalizado"); onBack(); }
      else toast.error(res.message);
    } catch { toast.error("Error al finalizar"); }
    setCompleting(false);
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} className="text-text-muted" /></button>
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        </div>
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {/* ── HEADER ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors border border-border">
            <ChevronLeft size={15} className="text-text-secondary" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary font-mono">{count.count_number}</span>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400">EN CONTEO</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-muted">
              <span className="flex items-center gap-1"><Warehouse size={10} /> {count.warehouse_name}</span>
              <span>{TYPE_LABELS[count.count_type] || count.count_type}</span>
            </div>
          </div>
        </div>
        {pendingCount === 0 ? (
          <button onClick={handleComplete} disabled={completing}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50">
            {completing ? <><Loader2 size={13} className="animate-spin" /> Finalizando...</> : <><CheckCircle2 size={14} /> Finalizar Conteo</>}
          </button>
        ) : (
          <div className="text-right">
            <span className="text-lg font-bold text-text-primary tabular-nums">{progress}%</span>
            <p className="text-[10px] text-text-muted">{countedCount} de {items.length} posiciones</p>
          </div>
        )}
      </div>

      {/* ── STATS STRIP ────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-3.5">
        <div className="flex items-center gap-5 mb-2.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-text-secondary">Contadas <span className="font-bold text-emerald-400">{countedCount}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
            <span className="text-text-secondary">Pendientes <span className="font-bold text-text-primary">{pendingCount}</span></span>
          </div>
          {varianceCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-text-secondary">Varianzas <span className="font-bold text-red-400">{varianceCount}</span></span>
            </div>
          )}
          <div className="flex-1" />
          <span className="text-text-muted">{rackCodes.length} racks · {items.length} posiciones</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full bg-linear-to-r from-blue-500 via-indigo-500 to-emerald-500"
            initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        </div>
      </div>

      {/* ── VARIANCE SUMMARY (shown after all counted) ── */}
      {pendingCount === 0 && varianceCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-red-400">Inconsistencias Detectadas</span>
                <p className="text-[10px] text-text-muted">Se encontraron {varianceCount} posiciones con diferencias</p>
              </div>
            </div>
            <span className="text-lg font-bold text-red-400 tabular-nums">{varianceCount}</span>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {items.filter(i => i.status === "counted" && i.variance !== 0).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-surface/50 border border-border/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[10px] font-mono font-bold text-text-primary">{item.rack_code} F{item.row_number}·C{item.column_number}</span>
                  <span className="text-[10px] text-text-secondary truncate">{item.product_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-text-muted tabular-nums">Sis: {item.system_quantity}</span>
                  <span className="text-[10px] text-text-muted tabular-nums">Cont: {item.counted_quantity}</span>
                  <span className={cn("text-xs font-bold tabular-nums min-w-[40px] text-right",
                    (item.variance ?? 0) > 0 ? "text-blue-400" : "text-red-400")}>
                    {(item.variance ?? 0) > 0 ? "+" : ""}{item.variance}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      {pendingCount === 0 && varianceCount === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400">Sin Inconsistencias</span>
              <p className="text-[10px] text-text-muted">Todas las posiciones coinciden con el sistema</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── SPLIT LAYOUT: 3D Banner + Rack Nav + Counting List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* LEFT: 3D + Rack Navigation */}
        <div className="lg:col-span-4 space-y-2">
          {/* 3D Holographic Rack View */}
          <div className={cn("rounded-xl border border-border overflow-hidden relative", isDark ? "bg-[#0c0f1a]" : "bg-[#f0f0f4]")} style={{ height: 250 }}>
            {/* HTML overlays — cleaner than 3D text */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 text-[8px] font-medium text-text-muted">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Activo</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />OK</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Var</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />Pend</span>
            </div>
            {activeRack3D && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-400 font-mono">{activeRack}</span>
                <span className="text-[9px] text-text-muted">{activeRack3D.rows}×{activeRack3D.columns}</span>
              </div>
            )}
            {activeRack3D ? (
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">Cargando rack...</div>}>
                <Canvas camera={{ position: [1.2, 0.8, 1.8], fov: 50 }} gl={{ antialias: true }} style={{ background: "transparent" }}>
                  <HoloRackScene rack={activeRack3D} countStatus={countStatus} activePosition={activePosition} isDark={isDark} />
                </Canvas>
              </Suspense>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                <ClipboardList size={20} className="text-text-muted/50" />
                <span className="text-[10px] text-text-muted">Selecciona un rack para visualizar</span>
              </div>
            )}
          </div>

          {/* Rack Navigation */}
          <div className="bg-surface border border-border rounded-xl p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-2">Racks del almacén</p>
            <div className="grid grid-cols-3 gap-1.5">
              {rackCodes.map((code) => {
                const ri = rackGroups[code] || [];
                const done = ri.filter((i) => i.status === "counted").length;
                const pct = ri.length > 0 ? Math.round((done / ri.length) * 100) : 0;
                const allDone = done === ri.length;
                const isActive = activeRack === code;
                const hasVariance = ri.some((i) => i.status === "counted" && i.variance !== 0);
                return (
                  <button key={code} onClick={() => setActiveRack(code)}
                    className={cn("rounded-lg p-2 text-left transition-all border",
                      isActive ? "bg-brand/10 border-brand/30 shadow-sm" :
                      allDone ? "bg-emerald-500/5 border-emerald-500/15" :
                      "bg-surface border-border hover:border-brand/20")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-[10px] font-mono font-bold",
                        isActive ? "text-brand" : allDone ? "text-emerald-400" : "text-text-primary")}>{code}</span>
                      {allDone && <Check size={10} className="text-emerald-400" />}
                      {hasVariance && !allDone && <AlertTriangle size={9} className="text-red-400" />}
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", allDone ? "bg-emerald-500" : hasVariance ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[8px] text-text-muted mt-0.5 block">{done}/{ri.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Counting List */}
        <div className="lg:col-span-8">
          {/* Active rack header */}
          {activeRack && (
            <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
                  <MapPin size={14} className="text-brand" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-primary font-mono">{activeRack}</span>
                    <span className="text-[10px] text-text-muted">{rackDoneCount}/{currentItems.length} contadas</span>
                  </div>
                  {rackDoneCount === currentItems.length && currentItems.length > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1"><Check size={10} /> Rack completado</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {rackCodes.map((code, i) => {
                  const isCurrent = code === activeRack;
                  const idx = rackCodes.indexOf(activeRack || "");
                  if (Math.abs(i - idx) > 2 && !isCurrent) return null;
                  return (
                    <button key={code} onClick={() => setActiveRack(code)}
                      className={cn("w-6 h-6 rounded text-[8px] font-bold font-mono transition-all",
                        isCurrent ? "bg-brand text-white" : "bg-muted text-text-muted hover:text-text-primary")}>
                      {code.split("-").pop()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Item list */}
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5" style={{ scrollbarGutter: "stable" }}>
            {currentItems.map((item, i) => {
              const isActive = activeItemId === item.id;
              const isCounted = item.status === "counted";
              const hasVar = isCounted && item.variance !== 0;

              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className={cn("rounded-xl border p-3 transition-all",
                    isActive ? "border-amber-400/40 bg-amber-500/5 shadow-md shadow-amber-500/5 ring-1 ring-amber-400/20" :
                    isCounted ? (hasVar ? "border-red-500/15 bg-surface" : "border-emerald-500/15 bg-surface") :
                    "border-border bg-surface hover:border-brand/20 cursor-pointer hover:shadow-sm")}
                  onClick={!isCounted && !isActive ? () => { setActiveItemId(item.id); setCountedQty(""); } : undefined}>

                  <div className="flex items-center gap-3">
                    {/* Status icon */}
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      isCounted ? (hasVar ? "bg-red-500/10" : "bg-emerald-500/10") :
                      isActive ? "bg-amber-500/10" : "bg-muted")}>
                      {isCounted ? (hasVar ? <AlertTriangle size={15} className="text-red-400" /> : <Check size={15} className="text-emerald-500" />) :
                       isActive ? <Scan size={15} className="text-amber-400 animate-pulse" /> :
                       <Package size={13} className="text-text-muted" />}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-text-primary">
                          F{item.row_number}·C{item.column_number}
                        </span>
                        <span className="text-[11px] text-text-secondary truncate">{item.product_name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[9px] text-text-muted font-mono">{item.product_sku}</span>
                        {item.lot_number && <span className="text-[9px] text-amber-400/60 flex items-center gap-0.5"><Hash size={8} />{item.lot_number}</span>}
                        {isCounted && item.counted_at && (
                          <span className="text-[8px] text-text-muted flex items-center gap-0.5">
                            <Clock size={7} /> {new Date(item.counted_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantities */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* System — hidden during active count for uncounted items to avoid bias */}
                      {isCounted ? (
                        <div className="text-center min-w-[50px] bg-muted/50 rounded-lg py-1.5 px-2">
                          <div className="text-[7px] text-text-muted uppercase tracking-wider font-semibold">Sistema</div>
                          <div className="text-sm font-bold text-text-primary tabular-nums">{item.system_quantity}</div>
                        </div>
                      ) : (
                        <div className="text-center min-w-[50px] bg-muted/50 rounded-lg py-1.5 px-2">
                          <div className="text-[7px] text-text-muted uppercase tracking-wider font-semibold">Sistema</div>
                          <div className="text-sm font-bold text-text-muted tabular-nums" title="Oculto hasta contar">?</div>
                        </div>
                      )}

                      {isActive ? (
                        <div className="flex items-center gap-1.5">
                          <div className="text-center">
                            <div className="text-[7px] text-amber-400 uppercase tracking-wider font-semibold mb-0.5">Contar</div>
                            <input ref={inputRef} type="number" value={countedQty}
                              onChange={(e) => setCountedQty(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSave(item.id); if (e.key === "Escape") { setActiveItemId(null); setCountedQty(""); } }}
                              placeholder="0"
                              className="w-[70px] rounded-lg border-2 border-amber-400/50 bg-elevated py-1.5 px-2 text-sm text-text-primary text-center font-bold tabular-nums focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <button onClick={() => handleSave(item.id)} disabled={saving || !countedQty.trim()}
                              className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 disabled:opacity-30 transition-colors shadow-sm">
                              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={() => { setActiveItemId(null); setCountedQty(""); }}
                              className="w-8 h-8 rounded-lg bg-muted text-text-muted flex items-center justify-center hover:text-text-primary transition-colors">
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ) : isCounted ? (
                        <>
                          <div className="text-center min-w-[50px] bg-muted/50 rounded-lg py-1.5 px-2">
                            <div className="text-[7px] text-text-muted uppercase tracking-wider font-semibold">Contado</div>
                            <div className="text-sm font-bold text-text-primary tabular-nums">{item.counted_quantity}</div>
                          </div>
                          <div className={cn("text-center min-w-[45px] rounded-lg py-1.5 px-2",
                            hasVar ? "bg-red-500/10" : "bg-emerald-500/10")}>
                            <div className="text-[7px] uppercase tracking-wider font-semibold text-text-muted">Var.</div>
                            <div className={cn("text-sm font-bold tabular-nums", hasVar ? "text-red-400" : "text-emerald-400")}>
                              {item.variance === 0 ? "✓" : `${(item.variance ?? 0) > 0 ? "+" : ""}${item.variance}`}
                            </div>
                          </div>
                        </>
                      ) : (
                        <ChevronRight size={14} className="text-text-muted" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {currentItems.length === 0 && <div className="text-center py-12 text-text-muted text-xs">Selecciona un rack a la izquierda</div>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── CREATE MODAL ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
function CreateCountModal({ warehouses, onClose, onCreated }: {
  warehouses: { id: string; name: string }[]; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [whId, setWhId] = useState("");
  const [type, setType] = useState("cycle");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string; id?: string } | null>(null);

  function handleCreate() {
    if (!whId) return;
    startTransition(async () => {
      try {
        const resp = await fetch("/api/wms/operations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_physical_count", warehouse_id: whId, count_type: type, notes: notes || undefined }),
        });
        const res = await resp.json();
        setResult(res);
        if (res.success && res.id) { toast.success(res.message); setTimeout(() => onCreated(res.id), 800); }
      } catch { setResult({ success: false, message: "Error al crear conteo" }); }
    });
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10">
              <ClipboardList size={17} className="text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Nuevo Conteo Físico</h3>
              <p className="text-[10px] text-text-muted">Las posiciones se generan automáticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={14} className="text-text-muted" /></button>
        </div>

        {result ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8">
            {result.success ? (
              <><CheckCircle2 size={36} className="text-emerald-500 mb-3" />
                <p className="text-sm font-bold text-text-primary">Conteo Creado</p>
                <p className="text-[11px] text-text-muted mt-1 text-center max-w-xs">{result.message}</p>
                <p className="text-[10px] text-brand mt-3 animate-pulse">Abriendo panel de conteo...</p></>
            ) : (
              <><AlertCircle size={36} className="text-red-500 mb-3" />
                <p className="text-sm font-bold text-red-400">Error</p>
                <p className="text-[11px] text-text-muted mt-1 max-w-xs text-center">{result.message}</p>
                <button onClick={() => setResult(null)} className="mt-3 text-[10px] text-brand hover:underline">Reintentar</button></>
            )}
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Almacén</label>
              <select value={whId} onChange={(e) => setWhId(e.target.value)}
                className="w-full rounded-xl border border-border bg-elevated py-2.5 px-3 text-xs text-text-primary focus:border-brand focus:outline-none transition-colors">
                <option value="">Seleccionar almacén...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Tipo de Conteo</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "cycle", l: "Cíclico", d: "Rotativo por zona" },
                  { v: "annual", l: "Anual", d: "Conteo completo anual" },
                  { v: "spot", l: "Spot Check", d: "Verificación puntual" },
                  { v: "full", l: "Completo", d: "Todo el almacén" },
                ].map((t) => (
                  <button key={t.v} onClick={() => setType(t.v)}
                    className={cn("rounded-xl border p-2.5 text-left transition-all",
                      type === t.v ? "border-brand bg-brand/5 shadow-sm" : "border-border hover:border-brand/30")}>
                    <p className={cn("text-[11px] font-semibold", type === t.v ? "text-brand" : "text-text-primary")}>{t.l}</p>
                    <p className="text-[9px] text-text-muted">{t.d}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Conteo zona A..." rows={2}
                className="w-full rounded-xl border border-border bg-elevated py-2 px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none resize-none transition-colors" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors border border-border">Cancelar</button>
              <button onClick={handleCreate} disabled={!whId || isPending}
                className="flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-40">
                {isPending ? <><Loader2 size={13} className="animate-spin" /> Generando posiciones...</> : <><Scan size={13} /> Crear Conteo</>}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
