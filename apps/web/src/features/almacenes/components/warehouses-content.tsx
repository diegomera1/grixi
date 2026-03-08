"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Warehouse, MapPin, Layers, BarChart3, Box, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type WarehouseData = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  is_active: boolean;
  rackCount: number;
  totalPositions: number;
  occupiedPositions: number;
  occupancy: number;
};

type WarehousesContentProps = {
  warehouses: WarehouseData[];
};

const typeLabels: Record<string, { label: string; icon: typeof Warehouse; color: string }> = {
  standard: { label: "Estándar", icon: Warehouse, color: "var(--brand)" },
  cross_docking: { label: "Cross-Docking", icon: Layers, color: "var(--info)" },
  cold_storage: { label: "Cámara Fría", icon: Thermometer, color: "var(--info)" },
};

export function WarehousesContent({ warehouses }: WarehousesContentProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Almacenes ({warehouses.length})
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Vista general de almacenes con estadísticas de ocupación
        </p>
      </motion.div>

      {/* Warehouse cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {warehouses.map((warehouse, index) => {
          const typeInfo = typeLabels[warehouse.type] || typeLabels.standard;
          const TypeIcon = typeInfo.icon;

          return (
            <motion.div
              key={warehouse.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all hover:border-[var(--border-hover)] hover:shadow-lg"
            >
              {/* Type banner */}
              <div
                className="flex items-center gap-2 px-5 py-3"
                style={{ backgroundColor: typeInfo.color + "10" }}
              >
                <TypeIcon size={16} style={{ color: typeInfo.color }} />
                <span className="text-xs font-medium" style={{ color: typeInfo.color }}>
                  {typeInfo.label}
                </span>
                {warehouse.is_active && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                    <span className="text-xs text-[var(--success)]">Activo</span>
                  </div>
                )}
              </div>

              <div className="p-5">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {warehouse.name}
                </h3>
                {warehouse.location && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <MapPin size={12} />
                    {warehouse.location}
                  </p>
                )}

                {/* Occupancy bar */}
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Ocupación</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {warehouse.occupancy}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${warehouse.occupancy}%`,
                        backgroundColor:
                          warehouse.occupancy > 85
                            ? "var(--error)"
                            : warehouse.occupancy > 60
                              ? "var(--warning)"
                              : "var(--success)",
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      {warehouse.rackCount}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Racks</p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      {warehouse.totalPositions}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Posiciones</p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      {warehouse.occupiedPositions}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Ocupadas</p>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-5 flex gap-2">
                  <Link href={`/almacenes/${warehouse.id}`} className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2 text-center text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)]">
                    Vista 2D
                  </Link>
                  <Link href={`/almacenes/${warehouse.id}?view=3d`} className="flex-1 rounded-xl bg-[var(--brand)] px-4 py-2 text-center text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--brand)]/20">
                    Vista 3D
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
