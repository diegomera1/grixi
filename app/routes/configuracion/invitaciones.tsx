import { useOutletContext, useFetcher, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/configuracion.invitaciones";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { sendInvitationEmail } from "~/lib/email.server";
import { schemas } from "~/lib/validation/schemas";
import { validateAction } from "~/lib/validation/parse";
import { Mail, Copy, Check, X, Clock, UserCheck, UserX } from "lucide-react";
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
    .select("id, name").eq("slug", tenantSlug).maybeSingle();
  if (!org) return redirect("/dashboard", { headers });

  const { data: invitations } = await admin.from("invitations")
    .select("*, roles(name)")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  const { data: roles } = await admin.from("roles")
    .select("id, name, hierarchy_level")
    .eq("organization_id", org.id)
    .order("hierarchy_level", { ascending: false });

  return Response.json({
    orgId: org.id,
    orgSlug: tenantSlug,
    invitations: invitations || [],
    roles: roles || [],
  }, { headers });
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
    .select("id, name").eq("slug", tenantSlug).maybeSingle();
  if (!org) return Response.json({ error: "Org not found" }, { status: 404, headers });

  if (intent === "invite") {
    const validated = validateAction(formData, schemas.invite, headers);
    if (validated instanceof Response) return validated;
    const { email, role_id: roleId } = validated;

    // Check if already invited
    const { data: existing } = await admin.from("invitations")
      .select("id").eq("organization_id", org.id).eq("email", email).eq("status", "pending").maybeSingle();
    if (existing) return Response.json({ error: "Ya existe una invitación pendiente para este email" }, { status: 400, headers });

    // Check if already a member
    const { data: authUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const existingUser = authUser?.users?.find((u: any) => u.email === email);
    if (existingUser) {
      const { data: membership } = await admin.from("memberships")
        .select("id").eq("user_id", existingUser.id).eq("organization_id", org.id).maybeSingle();
      if (membership) return Response.json({ error: "Este usuario ya es miembro de la organización" }, { status: 400, headers });
    }

    const { data: invitation, error } = await admin.from("invitations").insert({
      organization_id: org.id,
      email,
      role_id: roleId,
      invited_by: user.id,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    // Get role name for the email
    const { data: role } = await admin.from("roles").select("name").eq("id", roleId).maybeSingle();
    const inviterName = user.user_metadata?.full_name || user.email || "Un administrador";
    const invitationLink = `https://${tenantSlug}.grixi.ai/?invitation=${invitation?.id}`;

    // Send invitation email via Resend
    const resendKey = (env as any).RESEND_API_KEY;
    if (resendKey) {
      const emailResult = await sendInvitationEmail(resendKey, {
        to: email,
        inviterName,
        orgName: org.name || tenantSlug || "GRIXI",
        roleName: role?.name || "miembro",
        invitationLink,
        expiresAt: invitation?.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (!emailResult.success) {
        console.error("[INVITE] Email failed:", emailResult.error);
      }
    } else {
      console.warn("[INVITE] RESEND_API_KEY not configured — email not sent");
    }

    await logAuditEvent(admin, {
      actorId: user.id, action: "invitation.create", entityType: "invitation",
      entityId: invitation?.id, organizationId: org.id,
      metadata: { email, roleId, emailSent: !!resendKey }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  if (intent === "cancel") {
    const validated = validateAction(formData, schemas.cancelInvitation, headers);
    if (validated instanceof Response) return validated;
    const { invitation_id: invId } = validated;
    await admin.from("invitations").update({ status: "cancelled" }).eq("id", invId);
    await logAuditEvent(admin, {
      actorId: user.id, action: "invitation.cancel", entityType: "invitation",
      entityId: invId, organizationId: org.id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "resend") {
    const validated = validateAction(formData, schemas.resendInvitation, headers);
    if (validated instanceof Response) return validated;
    const { invitation_id: invId } = validated;
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("invitations")
      .update({ expires_at: newExpiry })
      .eq("id", invId);

    // Re-send the email
    const { data: inv } = await admin.from("invitations")
      .select("email, role_id, roles(name)").eq("id", invId).maybeSingle();
    const resendKey = (env as any).RESEND_API_KEY;
    if (resendKey && inv) {
      const inviterName = user.user_metadata?.full_name || user.email || "Un administrador";
      await sendInvitationEmail(resendKey, {
        to: inv.email,
        inviterName,
        orgName: org.name || tenantSlug || "GRIXI",
        roleName: (inv as any).roles?.name || "miembro",
        invitationLink: `https://${tenantSlug}.grixi.ai/?invitation=${invId}`,
        expiresAt: newExpiry,
      });
    }

    await logAuditEvent(admin, {
      actorId: user.id, action: "invitation.resend", entityType: "invitation",
      entityId: invId, organizationId: org.id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string; icon: any }> = {
  pending: { bg: "#F59E0B15", color: "#F59E0B", label: "Pendiente", icon: Clock },
  accepted: { bg: "#16A34A15", color: "#16A34A", label: "Aceptada", icon: UserCheck },
  cancelled: { bg: "#EF444415", color: "#EF4444", label: "Cancelada", icon: UserX },
  expired: { bg: "#6B728015", color: "#6B7280", label: "Expirada", icon: X },
};

export default function InvitacionesTab() {
  const { invitations, roles, orgSlug } = useLoaderData<typeof loader>() as any;
  const config = useOutletContext<ConfigContext>();
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");
  const [copied, setCopied] = useState<string | null>(null);

  const invite = () => {
    if (!email) return;
    fetcher.submit({ intent: "invite", email, role_id: roleId }, { method: "post" });
    setEmail("");
  };

  const copyLink = (invId: string) => {
    const link = `https://${orgSlug}.grixi.ai/?invitation=${invId}`;
    navigator.clipboard.writeText(link);
    setCopied(invId);
    setTimeout(() => setCopied(null), 2000);
  };

  const pending = invitations.filter((i: any) => i.status === "pending");
  const history = invitations.filter((i: any) => i.status !== "pending");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Invite Form */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--foreground)" }}>Invitar nuevo miembro</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              onKeyDown={(e) => e.key === "Enter" && invite()}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Rol</label>
            <select
              value={roleId} onChange={(e) => setRoleId(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-purple-500/20"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name} (nivel {r.hierarchy_level})</option>)}
            </select>
          </div>
          <button
            onClick={invite}
            disabled={!email || fetcher.state !== "idle"}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: "#7c3aed" }}
          >
            <Mail size={16} /> Enviar Invitación
          </button>
        </div>
        {fetcher.data?.error && (
          <p className="mt-3 text-xs font-medium" style={{ color: "#EF4444" }}>{(fetcher.data as any).error}</p>
        )}
      </div>

      {/* Pending Invitations */}
      {pending.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Pendientes ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((inv: any) => {
              const style = STATUS_STYLES[inv.status] || STATUS_STYLES.pending;
              return (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-white/[0.02]"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: style.bg, color: style.color }}>
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{inv.email}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        Rol: {inv.roles?.name || "—"} · Enviada {new Date(inv.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                        {inv.expires_at && ` · Expira ${new Date(inv.expires_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyLink(inv.id)}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
                      style={{ color: "var(--muted-foreground)" }}>
                      {copied === inv.id ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Link</>}
                    </button>
                    <button onClick={() => fetcher.submit({ intent: "resend", invitation_id: inv.id }, { method: "post" })}
                      className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-purple-500/10"
                      style={{ color: "#7c3aed" }}>
                      Reenviar
                    </button>
                    <button onClick={() => fetcher.submit({ intent: "cancel", invitation_id: inv.id }, { method: "post" })}
                      className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-red-500/10"
                      style={{ color: "#EF4444" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Historial ({history.length})
        </h3>
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Email", "Rol", "Estado", "Fecha"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((inv: any) => {
                const style = STATUS_STYLES[inv.status] || STATUS_STYLES.pending;
                return (
                  <tr key={inv.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 text-sm" style={{ color: "var(--foreground)" }}>{inv.email}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                        {inv.roles?.name || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: style.bg, color: style.color }}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {new Date(inv.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin historial de invitaciones</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
