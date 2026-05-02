/**
 * Admin — Feature Flags
 * 
 * Manage global feature flags and per-org overrides.
 * Platform admins can toggle defaults and set org-specific overrides.
 */
import { redirect, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.feature-flags";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import {
  Flag, ToggleLeft, ToggleRight, Building2, Search,
  Sparkles, Box, Zap, Settings, ChevronDown, ChevronRight,
  Plus, Trash2, X,
} from "lucide-react";
import { useState, useMemo } from "react";

const CATEGORY_META: Record<string, { label: string; color: string; icon: any }> = {
  module:       { label: "Módulos",       color: "#6366F1", icon: Box },
  beta:         { label: "Beta",          color: "#F59E0B", icon: Sparkles },
  experimental: { label: "Experimental",  color: "#EF4444", icon: Zap },
  general:      { label: "General",       color: "#10B981", icon: Settings },
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.flags.view", headers);

  const admin = createSupabaseAdminClient(env);

  const [flagsRes, overridesRes, orgsRes] = await Promise.all([
    admin.from("feature_flags").select("*").order("category").order("key"),
    admin.from("feature_flag_overrides").select("*, organizations(name, slug)"),
    admin.from("organizations").select("id, name, slug").order("name"),
  ]);

  return Response.json({
    flags: flagsRes.data || [],
    overrides: overridesRes.data || [],
    organizations: orgsRes.data || [],
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.flags.manage", headers);

  const admin = createSupabaseAdminClient(env);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "toggle_default") {
    const key = formData.get("key") as string;
    const { data: flag } = await admin.from("feature_flags").select("default_enabled").eq("key", key).single();
    if (!flag) return Response.json({ error: "Flag not found" }, { status: 404, headers });

    const newValue = !flag.default_enabled;
    await admin.from("feature_flags").update({ default_enabled: newValue }).eq("key", key);

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "feature_flag.toggle", entityType: "feature_flags",
      entityId: key, metadata: { key, default_enabled: newValue }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "add_override") {
    const flagKey = formData.get("flag_key") as string;
    const orgId = formData.get("organization_id") as string;
    const enabled = formData.get("enabled") === "true";

    const { error } = await admin.from("feature_flag_overrides").upsert({
      flag_key: flagKey, organization_id: orgId, enabled,
    }, { onConflict: "flag_key,organization_id" });

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "feature_flag.override", entityType: "feature_flag_overrides",
      entityId: `${flagKey}:${orgId}`, metadata: { flagKey, orgId, enabled }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove_override") {
    const id = formData.get("id") as string;
    await admin.from("feature_flag_overrides").delete().eq("id", id);

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "feature_flag.override_removed", entityType: "feature_flag_overrides",
      entityId: id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminFeatureFlags() {
  const { flags, overrides, organizations } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [addOverride, setAddOverride] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState("");

  const filtered = useMemo(() => {
    if (!search) return flags;
    const s = search.toLowerCase();
    return flags.filter((f: any) =>
      f.key.toLowerCase().includes(s) ||
      f.name.toLowerCase().includes(s) ||
      f.category.toLowerCase().includes(s)
    );
  }, [flags, search]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc: any, f: any) => {
      const cat = f.category || "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(f);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filtered]);

  const getOverridesForFlag = (key: string) =>
    overrides.filter((o: any) => o.flag_key === key);

  const handleToggle = (key: string) => {
    fetcher.submit({ intent: "toggle_default", key }, { method: "post" });
  };

  const handleAddOverride = (flagKey: string, enabled: boolean) => {
    if (!selectedOrg) return;
    fetcher.submit(
      { intent: "add_override", flag_key: flagKey, organization_id: selectedOrg, enabled: String(enabled) },
      { method: "post" }
    );
    setAddOverride(null);
    setSelectedOrg("");
  };

  const handleRemoveOverride = (id: string) => {
    fetcher.submit({ intent: "remove_override", id }, { method: "post" });
  };

  const enabledCount = flags.filter((f: any) => f.default_enabled).length;

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#F59E0B15" }}>
            <Flag size={17} style={{ color: "#F59E0B" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Feature Flags</h1>
            <p className="text-[11px] text-text-muted">
              {flags.length} flags · {enabledCount} activos · {overrides.length} overrides
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Search ═══ */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar flags por nombre, key o categoría..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-[12px] text-text-primary outline-none placeholder:text-text-muted focus:border-brand"
        />
      </div>

      {/* ═══ KPI Stats ═══ */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
          const count = (grouped[cat] || []).length;
          const Icon = meta.icon;
          return (
            <div key={cat} className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${meta.color}12` }}>
                <Icon size={15} style={{ color: meta.color }} />
              </div>
              <p className="text-lg font-bold tabular-nums text-text-primary">{count}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{meta.label}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ Flags by Category ═══ */}
      {Object.entries(grouped).map(([category, items]) => {
        const catMeta = CATEGORY_META[category] || { label: category, color: "#71717A", icon: Settings };
        const CatIcon = catMeta.icon;
        return (
          <div key={category} className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <CatIcon size={14} style={{ color: catMeta.color }} />
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-text-primary">{catMeta.label}</h2>
              <span className="ml-1 text-[10px] text-text-muted">{(items as any[]).length} flags</span>
            </div>
            <div className="divide-y divide-border">
              {(items as any[]).map((flag: any) => {
                const flagOverrides = getOverridesForFlag(flag.key);
                const isExpanded = expandedFlag === flag.key;
                const isAdding = addOverride === flag.key;

                return (
                  <div key={flag.key}>
                    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/20">
                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedFlag(isExpanded ? null : flag.key)}
                        className="shrink-0 text-text-muted hover:text-text-primary"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold text-text-primary">{flag.name}</p>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono text-text-muted">{flag.key}</code>
                        </div>
                        {flag.description && (
                          <p className="mt-0.5 text-[10px] text-text-muted">{flag.description}</p>
                        )}
                        {flagOverrides.length > 0 && (
                          <p className="mt-1 text-[9px] font-medium text-brand">
                            {flagOverrides.length} override{flagOverrides.length > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(flag.key)}
                        className="flex items-center gap-2 transition-all"
                      >
                        {flag.default_enabled ? (
                          <ToggleRight size={28} className="text-success" />
                        ) : (
                          <ToggleLeft size={28} className="text-text-muted" />
                        )}
                        <span className={`text-[11px] font-medium ${flag.default_enabled ? "text-success" : "text-text-muted"}`}>
                          {flag.default_enabled ? "ON" : "OFF"}
                        </span>
                      </button>
                    </div>

                    {/* ═══ Expanded: Overrides ═══ */}
                    {isExpanded && (
                      <div className="border-t border-border/50 bg-muted/10 px-5 py-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            Overrides por Organización
                          </p>
                          <button
                            onClick={() => setAddOverride(isAdding ? null : flag.key)}
                            className="flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-[10px] font-medium text-brand hover:bg-brand/20"
                          >
                            {isAdding ? <X size={10} /> : <Plus size={10} />}
                            {isAdding ? "Cancelar" : "Agregar Override"}
                          </button>
                        </div>

                        {/* Add override form */}
                        {isAdding && (
                          <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand/20 bg-surface p-3">
                            <select
                              value={selectedOrg}
                              onChange={(e) => setSelectedOrg(e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-[11px] text-text-primary outline-none"
                            >
                              <option value="">Seleccionar organización...</option>
                              {organizations.map((org: any) => (
                                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAddOverride(flag.key, true)}
                              className="rounded-lg bg-success/10 px-3 py-1.5 text-[10px] font-medium text-success hover:bg-success/20"
                            >
                              Activar
                            </button>
                            <button
                              onClick={() => handleAddOverride(flag.key, false)}
                              className="rounded-lg bg-error/10 px-3 py-1.5 text-[10px] font-medium text-error hover:bg-error/20"
                            >
                              Desactivar
                            </button>
                          </div>
                        )}

                        {/* Existing overrides */}
                        {flagOverrides.length > 0 ? (
                          <div className="space-y-2">
                            {flagOverrides.map((o: any) => (
                              <div key={o.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
                                <Building2 size={13} className="shrink-0 text-text-muted" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-medium text-text-primary">
                                    {o.organizations?.name || "Unknown"}
                                  </p>
                                  <p className="text-[9px] font-mono text-text-muted">
                                    {o.organizations?.slug || "—"}.grixi.ai
                                  </p>
                                </div>
                                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                                  o.enabled
                                    ? "bg-success/10 text-success"
                                    : "bg-error/10 text-error"
                                }`}>
                                  {o.enabled ? "ACTIVO" : "INACTIVO"}
                                </span>
                                <button
                                  onClick={() => handleRemoveOverride(o.id)}
                                  className="rounded-lg p-1 text-text-muted hover:bg-error/10 hover:text-error"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-[10px] text-text-muted py-2">
                            Sin overrides — se usa el valor por defecto ({flag.default_enabled ? "ON" : "OFF"})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
