"use client";

import { motion } from "framer-motion";
import {
  Wifi, WifiOff, RefreshCw, Cloud, CloudOff, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OfflineStatus } from "../hooks/use-offline-sync";

export function OfflineIndicator({ status, onSync }: {
  status: OfflineStatus;
  onSync: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        status.isOnline
          ? "border-green-500/20 bg-green-500/5"
          : "border-amber-500/20 bg-amber-500/5"
      )}
    >
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        {status.isOnline ? (
          <Wifi size={13} className="text-green-500" />
        ) : (
          <WifiOff size={13} className="text-amber-500" />
        )}
        <span className={cn(
          "font-medium",
          status.isOnline ? "text-green-600" : "text-amber-600"
        )}>
          {status.isOnline ? "Conectado" : "Sin Conexión"}
        </span>
      </div>

      <span className="text-[var(--text-muted)]">·</span>

      {/* Last sync */}
      <span className="text-[10px] text-[var(--text-muted)]">
        {status.timeSinceSync}
      </span>

      {/* Pending count */}
      {status.pendingCount > 0 && (
        <>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
            <CloudOff size={10} />
            {status.pendingCount} pendientes
          </span>
        </>
      )}

      {status.pendingCount === 0 && status.isOnline && (
        <>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="flex items-center gap-1 text-[10px] text-green-500">
            <CheckCircle2 size={10} />
            Sincronizado
          </span>
        </>
      )}

      {/* Sync button */}
      {status.isOnline && status.pendingCount > 0 && (
        <button
          onClick={onSync}
          disabled={status.isSyncing}
          className={cn(
            "ml-auto flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-all",
            status.isSyncing
              ? "bg-[#0EA5E9]/10 text-[#0EA5E9]/50"
              : "bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/80"
          )}
        >
          <RefreshCw size={10} className={cn(status.isSyncing && "animate-spin")} />
          {status.isSyncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      )}

      {!status.isOnline && (
        <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold text-amber-500">
          <Cloud size={9} />
          Datos guardados localmente
        </span>
      )}
    </motion.div>
  );
}
