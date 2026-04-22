import { useOutletContext, useFetcher, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/configuracion.organizacion";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { invalidateOrgCache } from "~/lib/cache/kv";
import { Save, Building2, Globe, Palette, Mail, Calendar, Shield, Image, Upload } from "lucide-react";
import { useState, useRef } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const tenantSlug = (context as any).tenantSlug as string | null;
  if (!tenantSlug) return redirect("/dashboard", { headers });

  const { data: org } = await admin.from("organizations")
    .select("*").eq("slug", tenantSlug).maybeSingle();
  if (!org) return redirect("/dashboard", { headers });

  // Domain whitelists
  const { data: domains } = await admin.from("domain_whitelists")
    .select("*").eq("organization_id", org.id);

  return Response.json({ org, domains: domains || [] }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);
  const tenantSlug = (context as any).tenantSlug as string | null;

  const { data: org } = await admin.from("organizations")
    .select("id, settings").eq("slug", tenantSlug).maybeSingle();
  if (!org) return Response.json({ error: "Org not found" }, { status: 404, headers });

  // ── RBAC: Verify actor has org management permission ──
  const { data: pa } = await admin.from("platform_admins")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) {
    const { data: actorMembership } = await admin.from("memberships")
      .select("roles(role_permissions(permissions(key)))")
      .eq("user_id", user.id).eq("organization_id", org.id).eq("status", "active")
      .maybeSingle();
    const perms = ((actorMembership as any)?.roles?.role_permissions || [])
      .map((rp: any) => rp.permissions?.key).filter(Boolean);
    if (!perms.includes("org.manage") && !perms.includes("org.settings.update")) {
      return Response.json({ error: "Sin permisos para modificar la organización" }, { status: 403, headers });
    }
  }

  if (intent === "update_org") {
    const name = formData.get("name") as string;
    const timezone = formData.get("timezone") as string;
    const currency = formData.get("currency") as string;
    const primaryColor = formData.get("primary_color") as string;
    const billingEmail = formData.get("billing_email") as string;

    const settings = {
      ...(org.settings || {}),
      timezone,
      currency,
      primary_color: primaryColor,
      billing_email: billingEmail,
    };

    const { error } = await admin.from("organizations")
      .update({ name, settings })
      .eq("id", org.id);

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: user.id, action: "organization.update", entityType: "organization",
      entityId: org.id, organizationId: org.id,
      metadata: { name, timezone, currency, primaryColor, billingEmail }, ipAddress: ip,
    });

    // Invalidate cached org config (settings/branding changed)
    const kv = (env as any).KV_CACHE as KVNamespace | undefined;
    await invalidateOrgCache(kv, org.id);

    return Response.json({ success: true }, { headers });
  }

  if (intent === "add_domain") {
    const domain = formData.get("domain") as string;
    const autoRole = formData.get("auto_role") as string;
    if (!domain) return Response.json({ error: "Dominio requerido" }, { status: 400, headers });

    const { error } = await admin.from("domain_whitelists").insert({
      organization_id: org.id, domain, auto_role: autoRole || "member", created_by: user.id,
    });
    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: user.id, action: "domain.add", entityType: "domain_whitelist",
      organizationId: org.id, metadata: { domain, autoRole }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove_domain") {
    const domainId = formData.get("domain_id") as string;
    await admin.from("domain_whitelists").delete().eq("id", domainId);
    await logAuditEvent(admin, {
      actorId: user.id, action: "domain.remove", entityType: "domain_whitelist",
      entityId: domainId, organizationId: org.id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "upload_logo") {
    // Need to re-parse as multipart — but since we already consumed formData, we use the same
    const file = formData.get("logo") as File;
    if (!file || file.size === 0) return Response.json({ error: "No file" }, { status: 400, headers });
    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: "Archivo muy grande (máx 2MB)" }, { status: 400, headers });
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "Formato no soportado (jpg/png/webp/svg)" }, { status: 400, headers });
    }
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1] === "svg+xml" ? "svg" : file.type.split("/")[1];
    const key = `org/${org.id}/logo.${ext}`;
    try {
      const bucket = (context.cloudflare.env as any).ASSETS_BUCKET;
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { orgId: org.id, uploadedAt: new Date().toISOString() },
      });
      const logoUrl = `https://assets.grixi.ai/${key}`;
      await admin.from("organizations").update({ logo_url: logoUrl }).eq("id", org.id);
      await logAuditEvent(admin, {
        actorId: user.id, action: "org.logo.upload", entityType: "organization",
        entityId: org.id, organizationId: org.id, metadata: { key, ext }, ipAddress: ip,
      });
      return Response.json({ success: true, logoUrl }, { headers });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500, headers });
    }
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const TIMEZONES = [
  "America/Guayaquil", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Bogota", "America/Lima", "America/Santiago",
  "America/Sao_Paulo", "America/Mexico_City", "Europe/London", "Europe/Madrid",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
];

const CURRENCIES = [
  { code: "USD", name: "Dólar Americano" },
  { code: "EUR", name: "Euro" },
  { code: "MXN", name: "Peso Mexicano" },
  { code: "COP", name: "Peso Colombiano" },
  { code: "PEN", name: "Sol Peruano" },
  { code: "CLP", name: "Peso Chileno" },
  { code: "BRL", name: "Real Brasileño" },
];

export default function OrganizacionTab() {
  const { org, domains } = useLoaderData<typeof loader>() as any;
  const config = useOutletContext<ConfigContext>();
  const fetcher = useFetcher();
  const settings = org.settings || {};

  const [name, setName] = useState(org.name);
  const [timezone, setTimezone] = useState(settings.timezone || "America/Guayaquil");
  const [currency, setCurrency] = useState(settings.currency || "USD");
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || "#7c3aed");
  const [billingEmail, setBillingEmail] = useState(settings.billing_email || "");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Domain form
  const [newDomain, setNewDomain] = useState("");
  const [autoRole, setAutoRole] = useState("member");

  const save = () => {
    fetcher.submit({
      intent: "update_org", name, timezone, currency,
      primary_color: primaryColor, billing_email: billingEmail,
    }, { method: "post" });
  };

  const addDomain = () => {
    if (!newDomain) return;
    fetcher.submit({ intent: "add_domain", domain: newDomain, auto_role: autoRole }, { method: "post" });
    setNewDomain("");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Logo Upload ── */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <Image size={16} /> Logo de la Organización
        </h3>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="h-20 w-20 rounded-xl overflow-hidden border-2 flex items-center justify-center"
              style={{ borderColor: primaryColor }}>
              {(logoPreview || org.logo_url) ? (
                <img src={logoPreview || org.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: primaryColor + "15", color: primaryColor }}>
                  {(org.name || "G").charAt(0)}
                </div>
              )}
            </div>
            <button
              onClick={() => logoInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white dark:bg-gray-800 shadow-lg transition-transform hover:scale-110"
              style={{ borderColor: "var(--border)" }}
            >
              <Upload size={12} style={{ color: "var(--foreground)" }} />
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { alert("Máximo 2MB"); return; }
                const reader = new FileReader();
                reader.onload = () => setLogoPreview(reader.result as string);
                reader.readAsDataURL(file);
                const form = new FormData();
                form.append("intent", "upload_logo");
                form.append("logo", file);
                fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
              }}
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Logo visible en toda la plataforma</p>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>JPG, PNG, WebP o SVG · Máximo 2MB</p>
            {fetcher.data?.logoUrl && (
              <p className="text-xs font-medium" style={{ color: "#16A34A" }}>✓ Logo actualizado</p>
            )}
          </div>
        </div>
      </div>
      {/* Organization Info (readonly) */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <Building2 size={16} /> Información General
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Slug</p>
            <p className="text-sm font-mono" style={{ color: "var(--foreground)" }}>{org.slug}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Plan</p>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: "#7c3aed15", color: "#7c3aed" }}>{settings.plan || "demo"}</span>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Estado</p>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: org.status === "active" ? "#16A34A15" : "#EF444415", color: org.status === "active" ? "#16A34A" : "#EF4444" }}>
              {org.status}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Creado</p>
            <p className="text-sm" style={{ color: "var(--foreground)" }}>
              {new Date(org.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Editable Settings */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <Palette size={16} /> Configuración
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Nombre de la organización</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Email de facturación</label>
            <input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="billing@empresa.com"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Zona horaria</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Moneda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Color primario</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500/20"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
        </div>
        <button onClick={save} disabled={fetcher.state !== "idle"}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: "#7c3aed" }}>
          <Save size={16} /> Guardar Configuración
        </button>
        {fetcher.data?.success && (
          <p className="mt-3 text-xs font-medium" style={{ color: "#16A34A" }}>✓ Configuración guardada</p>
        )}
      </div>

      {/* Domain Whitelists */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          <Globe size={16} /> Dominios Autorizados
        </h3>
        <p className="mb-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
          Los usuarios con estos dominios de email son auto-aprobados al registrarse.
        </p>

        {/* Add domain */}
        <div className="mb-4 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Dominio</label>
            <input type="text" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="empresa.com"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Rol auto-asignado</label>
            <select value={autoRole} onChange={(e) => setAutoRole(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button onClick={addDomain}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white whitespace-nowrap"
            style={{ backgroundColor: "#7c3aed" }}>Agregar</button>
        </div>

        {/* Domain list */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Dominio", "Rol", "Fecha", ""].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map((d: any) => (
                <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3"><code className="text-sm font-mono" style={{ color: "var(--foreground)" }}>@{d.domain}</code></td>
                  <td className="px-5 py-3">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{d.auto_role}</span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(d.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => fetcher.submit({ intent: "remove_domain", domain_id: d.id }, { method: "post" })}
                      className="text-xs hover:bg-red-500/10 rounded px-2 py-1 transition-colors"
                      style={{ color: "#EF4444" }}
                    >Eliminar</button>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin dominios configurados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
