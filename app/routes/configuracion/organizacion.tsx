import { useOutletContext, useFetcher, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/configuracion.organizacion";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { Save, Building2, Globe, Palette, Mail, Calendar, Shield } from "lucide-react";
import { useState } from "react";

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
