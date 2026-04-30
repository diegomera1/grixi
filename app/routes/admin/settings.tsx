import { redirect, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.settings";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import {
  Settings, ToggleLeft, ToggleRight, Puzzle, Shield,
  Server, Save, RefreshCw,
} from "lucide-react";
import { useState } from "react";

const CATEGORY_META: Record<string, { label: string; color: string; icon: any }> = {
  features: { label: "Features", color: "#8B5CF6", icon: ToggleLeft },
  limits: { label: "Límites", color: "#F59E0B", icon: Shield },
  system: { label: "Sistema", color: "#3B82F6", icon: Server },
};

const ALL_MODULES = [
  { id: "dashboard", name: "Dashboard", color: "#6366F1" },
  { id: "almacenes", name: "Almacenes", color: "#16A34A" },
  { id: "compras", name: "Compras", color: "#F59E0B" },
  { id: "finanzas", name: "Finanzas", color: "#3B82F6" },
  { id: "rrhh", name: "RRHH", color: "#EC4899" },
  { id: "flota", name: "Flota", color: "#06B6D4" },
  { id: "ai", name: "GRIXI AI", color: "#8B5CF6" },
  { id: "usuarios", name: "Usuarios", color: "#EF4444" },
  { id: "reportes", name: "Reportes", color: "#14B8A6" },
  { id: "notificaciones", name: "Notificaciones", color: "#F97316" },
  { id: "admin", name: "Administración", color: "#6D28D9" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.settings.view", headers);

  const admin = createSupabaseAdminClient(env);

  const { data: settings } = await admin.from("platform_settings").select("*").order("category").order("key");

  // System info
  const systemInfo = {
    supabaseUrl: env.SUPABASE_URL,
    region: "us-east-1",
    environment: env.ENVIRONMENT || "production",
    workerName: "grixi-app",
  };

  return Response.json({ settings: settings || [], systemInfo }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.settings.manage", headers);

  const admin = createSupabaseAdminClient(env);
  if (!pa) return Response.json({ error: "Unauthorized" }, { status: 403, headers });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "update_setting") {
    const key = formData.get("key") as string;
    const value = formData.get("value") as string;

    // Parse value to appropriate JSON
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    const { error } = await admin.from("platform_settings").update({
      value: parsedValue,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq("key", key);

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: user.id, action: "settings.update", entityType: "platform_settings",
      entityId: key, metadata: { key, value: parsedValue }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  if (intent === "toggle_setting") {
    const key = formData.get("key") as string;

    // Get current value and toggle
    const { data: current } = await admin.from("platform_settings").select("value").eq("key", key).single();
    const newValue = !(current?.value === true || current?.value === "true");

    await admin.from("platform_settings").update({
      value: newValue,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq("key", key);

    await logAuditEvent(admin, {
      actorId: user.id, action: "settings.toggle", entityType: "platform_settings",
      entityId: key, metadata: { key, enabled: newValue }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminSettings() {
  const { settings, systemInfo } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Group settings by category
  const grouped = settings.reduce((acc: any, s: any) => {
    const cat = s.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  const handleToggle = (key: string) => {
    fetcher.submit({ intent: "toggle_setting", key }, { method: "post" });
  };

  const handleSave = (key: string) => {
    fetcher.submit({ intent: "update_setting", key, value: editValue }, { method: "post" });
    setEditingKey(null);
    setEditValue("");
  };

  const isBooleanValue = (val: any) => val === true || val === false || val === "true" || val === "false";
  const isEnabled = (val: any) => val === true || val === "true";

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#6366F115" }}>
          <Settings size={17} style={{ color: "#6366F1" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Configuración</h1>
          <p className="text-[11px] text-text-muted">Configuración global de la plataforma · {settings.length} opciones</p>
        </div>
      </div>

      {/* ═══ Settings Groups ═══ */}
      {Object.entries(grouped).map(([category, items]) => {
        const catMeta = CATEGORY_META[category] || { label: category, color: "#71717A", icon: Settings };
        const CatIcon = catMeta.icon;
        return (
          <div key={category} className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <CatIcon size={14} style={{ color: catMeta.color }} />
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-text-primary">{catMeta.label}</h2>
              <span className="ml-1 text-[10px] text-text-muted">{(items as any[]).length} opciones</span>
            </div>
            <div className="divide-y divide-border">
              {(items as any[]).map((setting: any) => {
                const isBoolean = isBooleanValue(setting.value);
                const enabled = isEnabled(setting.value);
                const isEditing = editingKey === setting.key;

                return (
                  <div key={setting.key} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-text-primary">{setting.key}</p>
                      {setting.description && (
                        <p className="mt-0.5 text-[10px] text-text-muted">{setting.description}</p>
                      )}
                    </div>

                    {isBoolean ? (
                      <button
                        onClick={() => handleToggle(setting.key)}
                        className="flex items-center gap-2 transition-all"
                      >
                        {enabled ? (
                          <ToggleRight size={28} className="text-success" />
                        ) : (
                          <ToggleLeft size={28} className="text-text-muted" />
                        )}
                        <span className={`text-[11px] font-medium ${enabled ? "text-success" : "text-text-muted"}`}>
                          {enabled ? "Activo" : "Inactivo"}
                        </span>
                      </button>
                    ) : isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-40 rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-[11px] text-text-primary outline-none focus:border-brand"
                          autoFocus
                        />
                        <button onClick={() => handleSave(setting.key)}
                          className="rounded-lg bg-brand px-2 py-1.5 text-[10px] font-medium text-white"
                        >
                          <Save size={12} />
                        </button>
                        <button onClick={() => setEditingKey(null)}
                          className="text-[10px] text-text-muted hover:text-text-primary"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingKey(setting.key); setEditValue(JSON.stringify(setting.value)); }}
                        className="rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-text-secondary transition-colors hover:border-brand hover:text-brand"
                      >
                        {typeof setting.value === "object" ? JSON.stringify(setting.value) : String(setting.value)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ═══ Available Modules ═══ */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Puzzle size={14} className="text-brand" />
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-text-primary">Módulos Disponibles</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_MODULES.map((mod) => (
            <div key={mod.id} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-all hover:border-brand/20">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${mod.color}12` }}>
                <Puzzle size={14} style={{ color: mod.color }} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-text-primary">{mod.name}</p>
                <p className="text-[9px] font-mono text-text-muted">{mod.id}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ System Info ═══ */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Server size={14} className="text-text-muted" />
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-text-primary">Información del Sistema</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
          {[
            { label: "Supabase URL", value: systemInfo.supabaseUrl },
            { label: "Región", value: systemInfo.region },
            { label: "Entorno", value: systemInfo.environment },
            { label: "Worker", value: systemInfo.workerName },
          ].map((info) => (
            <div key={info.label}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{info.label}</p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-text-secondary">{info.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
