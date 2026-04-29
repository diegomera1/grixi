import { redirect, useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/admin.organizations.$id";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { sendInvitationEmail } from "~/lib/email.server";
import {
  ArrowLeft, Users, Mail, Globe, Settings, Save, Shield, Trash2, Plus,
  ToggleLeft, ToggleRight, Flag, Sparkles, Box, Zap,
  LayoutDashboard, ScrollText, Lock, AlertTriangle, Clock, Activity,
  Key, MonitorSmartphone, ChevronDown, ChevronRight, Archive, Pause, Play,
} from "lucide-react";
import { useState, useMemo } from "react";

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

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Platform admin routes ONLY accessible from grixi.grixi.ai
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  const orgId = params.id;

  const [orgRes, membersRes, invitationsRes, domainsRes, rolesRes, permsRes, flagsRes, overridesRes, auditRes, passkeysRes] = await Promise.all([
    admin.from("organizations").select("*").eq("id", orgId).single(),
    admin.from("memberships").select("*, roles(name, hierarchy_level)")
      .eq("organization_id", orgId).eq("status", "active"),
    admin.from("invitations").select("*, roles(name)").eq("organization_id", orgId).order("created_at", { ascending: false }),
    admin.from("domain_whitelists").select("*").eq("organization_id", orgId),
    admin.from("roles").select("id, name, hierarchy_level, is_system, is_default, description, role_permissions(permission_id, permissions(id, key, description, module))").eq("organization_id", orgId).order("hierarchy_level", { ascending: false }),
    admin.from("permissions").select("id, key, description, module").order("module").order("key"),
    admin.from("feature_flags").select("*").order("category").order("name"),
    admin.from("feature_flag_overrides").select("*").eq("organization_id", orgId),
    admin.from("audit_logs").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    admin.from("user_passkeys").select("user_id"),
  ]);

  // Fetch login history for org members (needs membersRes first)
  const memberUserIds = (membersRes.data || []).map((m: any) => m.user_id);
  const loginHistRes = memberUserIds.length > 0
    ? await admin.from("login_history").select("*").in("user_id", memberUserIds).order("created_at", { ascending: false }).limit(50)
    : { data: [] };

  if (!orgRes.data) return redirect("/admin/organizations", { headers });

  // Get auth user data for members (paginated)
  const memberUsers: Record<string, any> = {};
  if (membersRes.data) {
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (!authData?.users?.length) break;
      allUsers.push(...authData.users);
      if (authData.users.length < 1000) break;
      page++;
    }
    allUsers.forEach((u: any) => {
      memberUsers[u.id] = { email: u.email, name: u.user_metadata?.full_name || u.email, avatar: u.user_metadata?.avatar_url };
    });
  }

  // Build resolved flags for this org
  const allFlags = flagsRes.data || [];
  const orgOverrides = overridesRes.data || [];
  const overrideMap: Record<string, { id: string; enabled: boolean }> = {};
  for (const o of orgOverrides) {
    overrideMap[o.flag_key] = { id: o.id, enabled: o.enabled };
  }

  // Build login history per user for members tab
  const loginsByUser: Record<string, any[]> = {};
  for (const lh of (loginHistRes.data || [])) {
    if (!loginsByUser[lh.user_id]) loginsByUser[lh.user_id] = [];
    loginsByUser[lh.user_id].push(lh);
  }

  // Passkey users
  const passKeyUserIds = new Set((passkeysRes.data || []).map((p: any) => p.user_id));

  return Response.json({
    org: orgRes.data,
    members: (membersRes.data || []).map((m: any) => ({
      ...m,
      user: memberUsers[m.user_id] || { email: "—", name: "—" },
      lastLogin: loginsByUser[m.user_id]?.[0]?.created_at || null,
      loginCount: loginsByUser[m.user_id]?.length || 0,
      hasPasskey: passKeyUserIds.has(m.user_id),
    })),
    invitations: invitationsRes.data || [],
    domains: domainsRes.data || [],
    roles: rolesRes.data || [],
    allPermissions: permsRes.data || [],
    featureFlags: allFlags,
    flagOverrides: overrideMap,
    auditLogs: auditRes.data || [],
    loginHistory: loginHistRes.data || [],
    securityStats: {
      totalLogins: (loginHistRes.data || []).length,
      passkeysEnabled: memberUserIds.filter(uid => passKeyUserIds.has(uid)).length,
      uniqueIPs: new Set((loginHistRes.data || []).map((l: any) => l.ip_address).filter(Boolean)).size,
    },
  }, { headers });
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // CRITICAL: Block mutations from non-platform tenants
  if (!isPlatformTenant(context)) return Response.json({ error: "Forbidden" }, { status: 403, headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return Response.json({ error: "Unauthorized" }, { status: 403, headers });

  const orgId = params.id;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "invite") {
    const email = formData.get("email") as string;
    const roleId = formData.get("role_id") as string;
    if (!email || !roleId) return Response.json({ error: "Email y rol requeridos" }, { status: 400, headers });

    // Check if already a member
    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const targetUser = authUsers?.users?.find((u: any) => u.email === email);
    if (targetUser) {
      const { data: existing } = await admin.from("memberships").select("id").eq("organization_id", orgId).eq("user_id", targetUser.id).eq("status", "active").maybeSingle();
      if (existing) return Response.json({ error: "Este usuario ya es miembro de la organización" }, { status: 400, headers });
    }
    // Check pending invitation
    const { data: pendingInv } = await admin.from("invitations").select("id").eq("organization_id", orgId).eq("email", email).eq("status", "pending").maybeSingle();
    if (pendingInv) return Response.json({ error: "Ya existe una invitación pendiente para este email" }, { status: 400, headers });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitation, error } = await admin.from("invitations").insert({
      organization_id: orgId, email, role_id: roleId, invited_by: user.id,
      status: "pending", expires_at: expiresAt,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    // Send invitation email
    const resendKey = (env as any).RESEND_API_KEY;
    if (resendKey) {
      const { data: orgData } = await admin.from("organizations").select("name, slug").eq("id", orgId).maybeSingle();
      const { data: roleData } = await admin.from("roles").select("name").eq("id", roleId).maybeSingle();
      const inviterName = user.user_metadata?.full_name || user.email || "Un administrador";
      const slug = orgData?.slug || "app";
      const result = await sendInvitationEmail(resendKey, {
        to: email,
        inviterName,
        orgName: orgData?.name || "GRIXI",
        roleName: roleData?.name || "miembro",
        invitationLink: `https://${slug}.grixi.ai/?invitation=${invitation?.id}`,
        expiresAt,
      });
      if (!result.success) console.error("[ADMIN-INVITE] Email failed:", result.error);
    } else {
      console.warn("[ADMIN-INVITE] RESEND_API_KEY not configured");
    }

    await logAuditEvent(admin, { actorId: user.id, action: "invitation.create", entityType: "invitation", entityId: invitation?.id, metadata: { email, orgId, emailSent: !!resendKey }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "cancel_invitation") {
    const invId = formData.get("invitation_id") as string;
    await admin.from("invitations").update({ status: "revoked" }).eq("id", invId);
    await logAuditEvent(admin, { actorId: user.id, action: "invitation.cancel", entityType: "invitation", entityId: invId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "resend_invitation") {
    const invId = formData.get("invitation_id") as string;
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("invitations").update({ expires_at: newExpiry, updated_at: new Date().toISOString() }).eq("id", invId);

    // Re-send the email
    const resendKey = (env as any).RESEND_API_KEY;
    if (resendKey) {
      const { data: inv } = await admin.from("invitations").select("email, role_id, roles(name)").eq("id", invId).maybeSingle();
      const { data: orgData } = await admin.from("organizations").select("name, slug").eq("id", orgId).maybeSingle();
      if (inv) {
        const inviterName = user.user_metadata?.full_name || user.email || "Un administrador";
        const slug = orgData?.slug || "app";
        await sendInvitationEmail(resendKey, {
          to: inv.email,
          inviterName,
          orgName: orgData?.name || "GRIXI",
          roleName: (inv as any).roles?.name || "miembro",
          invitationLink: `https://${slug}.grixi.ai/?invitation=${invId}`,
          expiresAt: newExpiry,
        });
      }
    }

    await logAuditEvent(admin, { actorId: user.id, action: "invitation.resend", entityType: "invitation", entityId: invId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "change_member_role") {
    const memberId = formData.get("membership_id") as string;
    const newRoleId = formData.get("role_id") as string;
    await admin.from("memberships").update({ role_id: newRoleId }).eq("id", memberId);
    await logAuditEvent(admin, { actorId: user.id, action: "member.change_role", entityType: "membership", entityId: memberId, metadata: { newRoleId, orgId }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "suspend_member") {
    const memberId = formData.get("membership_id") as string;
    const currentStatus = formData.get("current_status") as string;
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    await admin.from("memberships").update({ status: newStatus, deactivated_at: newStatus === "suspended" ? new Date().toISOString() : null, deactivated_by: newStatus === "suspended" ? user.id : null }).eq("id", memberId);
    await logAuditEvent(admin, { actorId: user.id, action: `member.${newStatus === "suspended" ? "suspend" : "reactivate"}`, entityType: "membership", entityId: memberId, metadata: { newStatus, orgId }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove_member") {
    const memberId = formData.get("membership_id") as string;
    await admin.from("memberships").delete().eq("id", memberId);
    await logAuditEvent(admin, { actorId: user.id, action: "member.remove", entityType: "membership", entityId: memberId, metadata: { orgId }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_modules") {
    const modulesStr = formData.get("modules") as string;
    const modules = JSON.parse(modulesStr);
    const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).single();
    const settings = { ...(org?.settings || {}), enabled_modules: modules };
    await admin.from("organizations").update({ settings }).eq("id", orgId);
    await logAuditEvent(admin, { actorId: user.id, action: "organization.update_modules", entityType: "organization", entityId: orgId, metadata: { modules }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "toggle_feature") {
    const flagKey = formData.get("flag_key") as string;
    const enabled = formData.get("enabled") === "true";
    const useDefault = formData.get("use_default") === "true";

    if (useDefault) {
      // Remove override → fall back to global default
      await admin.from("feature_flag_overrides").delete()
        .eq("flag_key", flagKey).eq("organization_id", orgId);
    } else {
      // Upsert override for this org
      await admin.from("feature_flag_overrides").upsert({
        flag_key: flagKey, organization_id: orgId, enabled,
      }, { onConflict: "flag_key,organization_id" });
    }

    // Also sync to org.settings.enabled_modules for backwards compat
    if (flagKey.startsWith("module_")) {
      const moduleId = flagKey.replace("module_", "");
      const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).single();
      const settings = org?.settings || {};
      let modules: string[] = settings.enabled_modules || ["dashboard"];
      const resolvedEnabled = useDefault
        ? (await admin.from("feature_flags").select("default_enabled").eq("key", flagKey).single()).data?.default_enabled ?? false
        : enabled;
      if (resolvedEnabled && !modules.includes(moduleId)) {
        modules = [...modules, moduleId];
      } else if (!resolvedEnabled) {
        modules = modules.filter((m: string) => m !== moduleId);
      }
      await admin.from("organizations").update({ settings: { ...settings, enabled_modules: modules } }).eq("id", orgId);
    }

    await logAuditEvent(admin, {
      actorId: user.id, action: "feature_flag.toggle", entityType: "feature_flag_overrides",
      entityId: `${flagKey}:${orgId}`, metadata: { flagKey, enabled, useDefault, orgId }, ipAddress: ip,
      organizationId: orgId,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_settings") {
    const plan = formData.get("plan") as string;
    const maxUsers = parseInt(formData.get("max_users") as string) || 10;
    const primaryColor = formData.get("primary_color") as string;
    const billingEmail = formData.get("billing_email") as string;
    const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).single();
    const settings = { ...(org?.settings || {}), plan, max_users: maxUsers, primary_color: primaryColor, billing_email: billingEmail };
    await admin.from("organizations").update({ settings }).eq("id", orgId);
    await logAuditEvent(admin, { actorId: user.id, action: "organization.update_settings", entityType: "organization", entityId: orgId, metadata: { plan, maxUsers }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "add_domain") {
    const domain = formData.get("domain") as string;
    const autoRole = formData.get("auto_role") as string;
    if (!domain) return Response.json({ error: "Dominio requerido" }, { status: 400, headers });
    const { error } = await admin.from("domain_whitelists").insert({ organization_id: orgId, domain, auto_role: autoRole || "member", created_by: user.id });
    if (error) return Response.json({ error: error.message }, { status: 400, headers });
    await logAuditEvent(admin, { actorId: user.id, action: "domain.add", entityType: "domain_whitelist", metadata: { domain, orgId }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove_domain") {
    const domainId = formData.get("domain_id") as string;
    await admin.from("domain_whitelists").delete().eq("id", domainId);
    await logAuditEvent(admin, { actorId: user.id, action: "domain.remove", entityType: "domain_whitelist", entityId: domainId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "create_role") {
    const roleName = formData.get("role_name") as string;
    const roleDesc = formData.get("role_desc") as string;
    const hierarchyLevel = parseInt(formData.get("hierarchy_level") as string) || 30;
    if (!roleName) return Response.json({ error: "Nombre requerido" }, { status: 400, headers });
    const { data: newRole, error } = await admin.from("roles").insert({
      organization_id: orgId, name: roleName.toLowerCase().replace(/\s+/g, "_"),
      description: roleDesc || roleName, is_system: false, hierarchy_level: hierarchyLevel, is_default: false,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400, headers });
    await logAuditEvent(admin, { actorId: user.id, action: "role.create", entityType: "role", entityId: newRole.id, metadata: { roleName, hierarchyLevel }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_role_permissions") {
    const roleId = formData.get("role_id") as string;
    const permissionIds = JSON.parse(formData.get("permission_ids") as string) as string[];
    // Delete existing role_permissions, then re-insert
    await admin.from("role_permissions").delete().eq("role_id", roleId);
    if (permissionIds.length > 0) {
      await admin.from("role_permissions").insert(permissionIds.map((pid: string) => ({ role_id: roleId, permission_id: pid })));
    }
    await logAuditEvent(admin, { actorId: user.id, action: "role.update_permissions", entityType: "role", entityId: roleId, metadata: { permissionCount: permissionIds.length }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "delete_role") {
    const roleId = formData.get("role_id") as string;
    await admin.from("role_permissions").delete().eq("role_id", roleId);
    await admin.from("roles").delete().eq("id", roleId).eq("is_system", false);
    await logAuditEvent(admin, { actorId: user.id, action: "role.delete", entityType: "role", entityId: roleId, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "change_org_status") {
    const newStatus = formData.get("new_status") as string;
    if (!["active", "suspended", "archived"].includes(newStatus)) {
      return Response.json({ error: "Estado inválido" }, { status: 400, headers });
    }
    await admin.from("organizations").update({ status: newStatus }).eq("id", orgId);
    await logAuditEvent(admin, {
      actorId: user.id, action: `organization.${newStatus}`, entityType: "organization",
      entityId: orgId, metadata: { newStatus }, ipAddress: ip, organizationId: orgId,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const TABS = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
  { id: "members", label: "Miembros", icon: <Users size={16} /> },
  { id: "roles", label: "Roles", icon: <Shield size={16} /> },
  { id: "features", label: "Features", icon: <Flag size={16} /> },
  { id: "invitations", label: "Invitaciones", icon: <Mail size={16} /> },
  { id: "domains", label: "Dominios", icon: <Globe size={16} /> },
  { id: "audit", label: "Auditoría", icon: <ScrollText size={16} /> },
  { id: "security", label: "Seguridad", icon: <Lock size={16} /> },
  { id: "settings", label: "Config", icon: <Settings size={16} /> },
];

export default function OrgDetail() {
  const { org, members, invitations, domains, roles, allPermissions, featureFlags, flagOverrides, auditLogs, loginHistory, securityStats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState("overview");
  const settings = org.settings || {};
  const color = settings.primary_color || "#6366F1";
  const age = Math.floor((Date.now() - new Date(org.created_at).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/organizations" className="rounded-lg p-2 hover:bg-white/5 transition-colors" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: color + "20", color }}>
              {org.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{org.name}</h1>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span>{org.slug}.grixi.ai</span>
                <span>·</span>
                <span>{age} días activo</span>
                <span>·</span>
                <span>{members.length} miembros</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{
            backgroundColor: org.status === "active" ? "#16A34A20" : org.status === "suspended" ? "#F59E0B20" : "#EF444420",
            color: org.status === "active" ? "#16A34A" : org.status === "suspended" ? "#F59E0B" : "#EF4444"
          }}>{org.status}</span>
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{settings.plan || "demo"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.id ? "border-purple-500 text-white" : "border-transparent hover:text-white/70"}`}
            style={{ color: activeTab === tab.id ? "var(--foreground)" : "var(--muted-foreground)" }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab org={org} members={members} roles={roles} featureFlags={featureFlags} flagOverrides={flagOverrides} auditLogs={auditLogs} invitations={invitations} domains={domains} settings={settings} securityStats={securityStats} color={color} />}
      {activeTab === "members" && <MembersTab members={members} roles={roles} fetcher={fetcher} />}
      {activeTab === "roles" && <RolesTab roles={roles} allPermissions={allPermissions} settings={settings} fetcher={fetcher} />}
      {activeTab === "features" && <FeaturesTab featureFlags={featureFlags} flagOverrides={flagOverrides} fetcher={fetcher} />}
      {activeTab === "invitations" && <InvitationsTab invitations={invitations} roles={roles} fetcher={fetcher} />}
      {activeTab === "domains" && <DomainsTab domains={domains} fetcher={fetcher} />}
      {activeTab === "audit" && <AuditTab auditLogs={auditLogs} />}
      {activeTab === "security" && <SecurityTab loginHistory={loginHistory} members={members} securityStats={securityStats} />}
      {activeTab === "settings" && <SettingsTab settings={settings} fetcher={fetcher} org={org} />}
    </div>
  );
}

function OverviewTab({ org, members, roles, featureFlags, flagOverrides, auditLogs, invitations, domains, settings, securityStats, color }: any) {
  const resolveFlag = (f: any) => flagOverrides[f.key] ? flagOverrides[f.key].enabled : f.default_enabled;
  const activeFlags = featureFlags.filter((f: any) => resolveFlag(f)).length;
  const pendingInvites = invitations.filter((i: any) => i.status === "pending").length;
  const kpis = [
    { label: "Miembros", value: members.length, max: settings.max_users || 10, color: "#6366F1", icon: Users },
    { label: "Roles", value: roles.length, color: "#10B981", icon: Shield },
    { label: "Features Activos", value: activeFlags, max: featureFlags.length, color: "#F59E0B", icon: Flag },
    { label: "Eventos Auditoría", value: auditLogs.length, color: "#8B5CF6", icon: ScrollText },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: k.color + "15" }}>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{k.label}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{k.value}</p>
              {k.max && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>de {k.max} máximo</p>}
            </div>
          );
        })}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Invitaciones Pendientes", value: pendingInvites, color: "#F97316" },
          { label: "Dominios", value: domains.length, color: "#06B6D4" },
          { label: "Logins Recientes", value: securityStats.totalLogins, color: "#3B82F6" },
          { label: "Passkeys Activos", value: securityStats.passkeysEnabled, color: "#16A34A" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Org Info + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Org Info */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>Información</h3>
          <div className="space-y-2.5">
            {[
              ["Nombre", org.name],
              ["Slug", org.slug + ".grixi.ai"],
              ["Plan", (settings.plan || "demo").toUpperCase()],
              ["Estado", org.status],
              ["Creada", new Date(org.created_at).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })],
              ["Color", settings.primary_color || "#6366F1"],
              ["Email Billing", settings.billing_email || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{k}</span>
                <span className="text-[11px] font-medium" style={{ color: k === "Color" ? (v as string) : "var(--foreground)" }}>{v as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>Actividad Reciente</h3>
          <div className="space-y-2">
            {auditLogs.slice(0, 8).map((log: any, i: number) => (
              <div key={log.id || i} className="flex items-start gap-2.5">
                <div className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#6366F1" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate" style={{ color: "var(--foreground)" }}>{log.action}</p>
                  <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(log.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {log.ip_address && ` · ${log.ip_address}`}
                  </p>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="text-[11px] italic" style={{ color: "var(--muted-foreground)" }}>Sin actividad registrada</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersTab({ members, roles, fetcher }: { members: any[]; roles: any[]; fetcher: any }) {
  const [search, setSearch] = useState("");
  const filtered = members.filter((m: any) => !search || m.user.name?.toLowerCase().includes(search.toLowerCase()) || m.user.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{members.length} miembros activos</p>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembro…" className="rounded-lg border px-3 py-1.5 text-xs outline-none w-64" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Usuario", "Rol", "Último Login", "Passkey", "Acciones"].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((m: any) => (
              <tr key={m.id} className="border-b last:border-b-0 transition-colors hover:bg-white/[0.02]" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {m.user.avatar ? <img src={m.user.avatar} className="h-8 w-8 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>{m.user.name?.charAt(0)?.toUpperCase()}</div>}
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{m.user.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{m.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <select value={m.role_id} onChange={e => fetcher.submit({ intent: "change_member_role", membership_id: m.id, role_id: e.target.value }, { method: "post" })} className="rounded-lg border px-2 py-1 text-[11px] font-medium outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "#6366F1" }}>
                    {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3.5">
                  {m.lastLogin ? (
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--foreground)" }}>{new Date(m.lastLogin).toLocaleDateString("es", { day: "2-digit", month: "short" })}</p>
                      <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{m.loginCount} logins</p>
                    </div>
                  ) : <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {m.hasPasskey ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#16A34A15", color: "#16A34A" }}><Key size={10} /> Activo</span>
                  ) : <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => fetcher.submit({ intent: "suspend_member", membership_id: m.id, current_status: m.status || "active" }, { method: "post" })} className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5" style={{ color: "#F59E0B" }}>Suspender</button>
                    <button onClick={() => { if (confirm("¿Eliminar este miembro de la organización?")) fetcher.submit({ intent: "remove_member", membership_id: m.id }, { method: "post" }); }} className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5" style={{ color: "#EF4444" }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>{search ? "Sin resultados" : "Sin miembros"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}



function RolesTab({ roles, allPermissions, settings, fetcher }: { roles: any[]; allPermissions: any[]; settings: any; fetcher: any }) {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLevel, setNewLevel] = useState("30");

  // Track local permission edits per role
  const [editedPerms, setEditedPerms] = useState<Record<string, string[]>>({});

  const orgPlan = settings.plan || "demo";

  // Group permissions by module
  const permsByModule = allPermissions.reduce((acc: Record<string, any[]>, p: any) => {
    const mod = p.module || "general";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  const getPermsForRole = (role: any): string[] => {
    if (editedPerms[role.id]) return editedPerms[role.id];
    return (role.role_permissions || []).map((rp: any) => rp.permission_id);
  };

  const togglePerm = (roleId: string, permId: string, currentPerms: string[]) => {
    const newPerms = currentPerms.includes(permId) ? currentPerms.filter(id => id !== permId) : [...currentPerms, permId];
    setEditedPerms(prev => ({ ...prev, [roleId]: newPerms }));
  };

  const savePerms = (roleId: string) => {
    const perms = editedPerms[roleId];
    if (!perms) return;
    fetcher.submit({ intent: "update_role_permissions", role_id: roleId, permission_ids: JSON.stringify(perms) }, { method: "post" });
    setEditedPerms(prev => { const next = { ...prev }; delete next[roleId]; return next; });
  };

  const createRole = () => {
    if (!newName) return;
    fetcher.submit({ intent: "create_role", role_name: newName, role_desc: newDesc, hierarchy_level: newLevel }, { method: "post" });
    setNewName(""); setNewDesc(""); setNewLevel("30"); setShowCreate(false);
  };

  const deleteRole = (roleId: string) => {
    if (!confirm("¿Eliminar este rol? Los usuarios asignados deberán ser reasignados.")) return;
    fetcher.submit({ intent: "delete_role", role_id: roleId }, { method: "post" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Roles de la Organización</h3>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Gestionar roles y sus permisos granulares</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>
          <Plus size={14} /> Crear Rol Custom
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Nombre</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="supervisor" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Descripción</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Supervisor de área" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Nivel Jerárquico (10-79)</label>
              <input type="number" min={10} max={79} value={newLevel} onChange={e => setNewLevel(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createRole} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>Crear</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Roles list */}
      <div className="space-y-2">
        {roles.map((role: any) => {
          const isExpanded = expandedRole === role.id;
          const currentPerms = getPermsForRole(role);
          const hasEdits = !!editedPerms[role.id];

          return (
            <div key={role.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: isExpanded ? "#7c3aed" : "var(--border)" }}>
              {/* Role header */}
              <button onClick={() => setExpandedRole(isExpanded ? null : role.id)} className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                    {role.hierarchy_level}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{role.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{role.description || "—"} · {currentPerms.length} permisos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {role.is_system && <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>Sistema</span>}
                  {role.is_default && <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: "#16A34A15", color: "#16A34A" }}>Default</span>}
                  <Shield size={14} style={{ color: "var(--muted-foreground)", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                </div>
              </button>

              {/* Expanded: permission matrix */}
              {isExpanded && (
                <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: "var(--border)" }}>
                  {Object.entries(permsByModule).map(([mod, perms]) => (
                    <div key={mod} className="mb-4">
                      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{mod}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {(perms as any[]).map((perm: any) => {
                          const isChecked = currentPerms.includes(perm.id);
                          return (
                            <label key={perm.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer hover:bg-white/[0.03]">
                              <input type="checkbox" checked={isChecked} onChange={() => togglePerm(role.id, perm.id, currentPerms)}
                                className="h-3.5 w-3.5 rounded border accent-purple-500" />
                              <span style={{ color: "var(--foreground)" }}>{perm.key}</span>
                              <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{perm.description}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                    <button onClick={() => savePerms(role.id)} disabled={!hasEdits} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-all ${hasEdits ? "" : "opacity-40 cursor-not-allowed"}`} style={{ backgroundColor: "#7c3aed" }}>
                      <Save size={13} /> Guardar Permisos
                    </button>
                    {!role.is_system && (
                      <button onClick={() => deleteRole(role.id)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-red-500/10" style={{ color: "#EF4444" }}>
                        <Trash2 size={13} /> Eliminar Rol
                      </button>
                    )}
                    <span className="ml-auto text-[10px]" style={{ color: "var(--muted-foreground)" }}>{currentPerms.length} de {allPermissions.length} permisos asignados</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CATEGORY_META: Record<string, { label: string; description: string; color: string; icon: any }> = {
  module:       { label: "Módulos", description: "Módulos principales de la plataforma", color: "#6366F1", icon: Box },
  general:      { label: "General", description: "Funcionalidades generales del sistema", color: "#10B981", icon: Settings },
  beta:         { label: "Beta", description: "Funcionalidades en prueba", color: "#F59E0B", icon: Sparkles },
  experimental: { label: "Experimental", description: "Features experimentales", color: "#EF4444", icon: Zap },
};

function FeaturesTab({ featureFlags, flagOverrides, fetcher }: { featureFlags: any[]; flagOverrides: Record<string, { id: string; enabled: boolean }>; fetcher: any }) {
  const grouped = useMemo(() => {
    return featureFlags.reduce((acc: Record<string, any[]>, f: any) => {
      const cat = f.category || "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(f);
      return acc;
    }, {} as Record<string, any[]>);
  }, [featureFlags]);

  const handleToggle = (flagKey: string, currentEnabled: boolean) => {
    fetcher.submit(
      { intent: "toggle_feature", flag_key: flagKey, enabled: String(!currentEnabled), use_default: "false" },
      { method: "post" }
    );
  };

  const handleResetToDefault = (flagKey: string) => {
    fetcher.submit(
      { intent: "toggle_feature", flag_key: flagKey, enabled: "false", use_default: "true" },
      { method: "post" }
    );
  };

  const resolveFlag = (flag: any): { enabled: boolean; isOverridden: boolean } => {
    const override = flagOverrides[flag.key];
    if (override) return { enabled: override.enabled, isOverridden: true };
    return { enabled: flag.default_enabled, isOverridden: false };
  };

  const totalEnabled = featureFlags.filter((f: any) => resolveFlag(f).enabled).length;
  const totalOverrides = Object.keys(flagOverrides).length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-4 rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#6366F115" }}>
          <Flag size={18} style={{ color: "#6366F1" }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Features de esta Organización</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {totalEnabled} de {featureFlags.length} activos · {totalOverrides} override{totalOverrides !== 1 ? "s" : ""} configurado{totalOverrides !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* By Category */}
      {Object.entries(CATEGORY_META).map(([catKey, catMeta]) => {
        const flags = grouped[catKey];
        if (!flags || flags.length === 0) return null;
        const CatIcon = catMeta.icon;

        return (
          <div key={catKey} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {/* Category header */}
            <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
              <CatIcon size={15} style={{ color: catMeta.color }} />
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground)" }}>{catMeta.label}</h3>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{catMeta.description}</p>
              </div>
              <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${catMeta.color}15`, color: catMeta.color }}>
                {flags.filter((f: any) => resolveFlag(f).enabled).length}/{flags.length}
              </span>
            </div>

            {/* Flag rows */}
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {flags.map((flag: any) => {
                const { enabled, isOverridden } = resolveFlag(flag);
                return (
                  <div key={flag.key} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{flag.name}</p>
                        <code className="rounded px-1.5 py-0.5 text-[9px] font-mono" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{flag.key}</code>
                        {isOverridden && (
                          <span className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: "#F59E0B15", color: "#F59E0B" }}>Override</span>
                        )}
                      </div>
                      {flag.description && (
                        <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{flag.description}</p>
                      )}
                      {!isOverridden && (
                        <p className="mt-0.5 text-[9px] italic" style={{ color: "var(--muted-foreground)" }}>
                          Usando default global: {flag.default_enabled ? "ON" : "OFF"}
                        </p>
                      )}
                    </div>

                    {/* Reset to default */}
                    {isOverridden && (
                      <button
                        onClick={() => handleResetToDefault(flag.key)}
                        className="rounded-lg px-2.5 py-1 text-[9px] font-medium transition-colors hover:bg-white/5"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Reset
                      </button>
                    )}

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(flag.key, enabled)}
                      className="flex items-center gap-2 transition-all"
                    >
                      {enabled ? (
                        <ToggleRight size={28} style={{ color: "#16A34A" }} />
                      ) : (
                        <ToggleLeft size={28} style={{ color: "var(--muted-foreground)" }} />
                      )}
                      <span className="w-7 text-[11px] font-bold" style={{ color: enabled ? "#16A34A" : "var(--muted-foreground)" }}>
                        {enabled ? "ON" : "OFF"}
                      </span>
                    </button>
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

function InvitationsTab({ invitations, roles, fetcher }: { invitations: any[]; roles: any[]; fetcher: any }) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");

  const invite = () => {
    if (!email) return;
    fetcher.submit({ intent: "invite", email, role_id: roleId }, { method: "post" });
    setEmail("");
  };

  const pending = invitations.filter((i: any) => i.status === "pending");
  const others = invitations.filter((i: any) => i.status !== "pending");

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="mb-3 text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Enviar Invitación</h3>
        {fetcher.data?.error && <div className="mb-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: "#EF444415", color: "#EF4444" }}>{fetcher.data.error}</div>}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Rol</label>
            <select value={roleId} onChange={e => setRoleId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button onClick={invite} disabled={!email} className="rounded-lg px-4 py-2 text-sm font-medium text-white whitespace-nowrap disabled:opacity-40" style={{ backgroundColor: "#7c3aed" }}>
            <Mail size={14} className="inline mr-1.5" />Invitar
          </button>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#F59E0B" }}>Pendientes ({pending.length})</h4>
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Email", "Rol", "Expira", "Acciones"].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {pending.map((inv: any) => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  return (
                    <tr key={inv.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                      <td className="px-5 py-3.5 text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{inv.email}</td>
                      <td className="px-5 py-3.5"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{inv.roles?.name || "—"}</span></td>
                      <td className="px-5 py-3.5"><span className="text-[11px]" style={{ color: isExpired ? "#EF4444" : "var(--muted-foreground)" }}>{isExpired ? "Expirada" : new Date(inv.expires_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}</span></td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1">
                          <button onClick={() => fetcher.submit({ intent: "resend_invitation", invitation_id: inv.id }, { method: "post" })} className="rounded-lg px-2 py-1 text-[10px] font-medium hover:bg-white/5" style={{ color: "#3B82F6" }}>Reenviar</button>
                          <button onClick={() => fetcher.submit({ intent: "cancel_invitation", invitation_id: inv.id }, { method: "post" })} className="rounded-lg px-2 py-1 text-[10px] font-medium hover:bg-white/5" style={{ color: "#EF4444" }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      {others.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Historial ({others.length})</h4>
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Email", "Rol", "Estado", "Fecha"].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {others.map((inv: any) => (
                  <tr key={inv.id} className="border-b last:border-b-0 opacity-60" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 text-[12px]" style={{ color: "var(--foreground)" }}>{inv.email}</td>
                    <td className="px-5 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{inv.roles?.name || "—"}</span></td>
                    <td className="px-5 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: inv.status === "accepted" ? "#16A34A20" : "#EF444420", color: inv.status === "accepted" ? "#16A34A" : "#EF4444" }}>{inv.status}</span></td>
                    <td className="px-5 py-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{new Date(inv.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invitations.length === 0 && <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>Sin invitaciones enviadas</p>}
    </div>
  );
}

function DomainsTab({ domains, fetcher }: { domains: any[]; fetcher: any }) {
  const [domain, setDomain] = useState("");
  const [autoRole, setAutoRole] = useState("member");

  const add = () => {
    if (!domain) return;
    fetcher.submit({ intent: "add_domain", domain, auto_role: autoRole }, { method: "post" });
    setDomain("");
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border p-4" style={{ backgroundColor: "#6366F108", borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Los dominios configurados auto-aprueban usuarios al registrarse con un email que coincida.
        </p>
      </div>
      <div className="mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Dominio</label>
          <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="empresa.com"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Rol auto-asignado</label>
          <select value={autoRole} onChange={e => setAutoRole(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            <option value="member">member</option><option value="viewer">viewer</option><option value="admin">admin</option><option value="owner">owner</option>
          </select>
        </div>
        <button onClick={add} className="rounded-lg px-4 py-2 text-sm font-medium text-white whitespace-nowrap" style={{ backgroundColor: "#7c3aed" }}>Agregar</button>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Dominio", "Rol", "Fecha", ""].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {domains.map((d: any) => (
              <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <td className="px-6 py-4"><code className="text-sm font-mono" style={{ color: "var(--foreground)" }}>@{d.domain}</code></td>
                <td className="px-6 py-4"><span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{d.auto_role}</span></td>
                <td className="px-6 py-4 text-xs" style={{ color: "var(--muted-foreground)" }}>{new Date(d.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td className="px-6 py-4"><button onClick={() => fetcher.submit({ intent: "remove_domain", domain_id: d.id }, { method: "post" })} className="text-xs hover:bg-white/5 rounded px-2 py-1" style={{ color: "#EF4444" }}>Eliminar</button></td>
              </tr>
            ))}
            {domains.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin dominios configurados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab({ auditLogs }: { auditLogs: any[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const actions = useMemo(() => [...new Set(auditLogs.map((l: any) => l.action))], [auditLogs]);
  const filtered = auditLogs.filter((l: any) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search && !l.action.toLowerCase().includes(search.toLowerCase()) && !l.entity_type?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const ACTION_COLORS: Record<string, string> = {
    "organization": "#6366F1", "membership": "#10B981", "feature_flag": "#F59E0B",
    "role": "#3B82F6", "invitation": "#EC4899", "domain": "#06B6D4",
  };
  const getColor = (action: string) => {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.includes(key)) return color;
    }
    return "#6366F1";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar acción…" className="rounded-lg border px-3 py-1.5 text-xs outline-none flex-1" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="rounded-lg border px-3 py-1.5 text-xs outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          <option value="all">Todas las acciones</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{filtered.length}</span>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Fecha", "Acción", "Entidad", "IP", "Detalles"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.slice(0, 50).map((log: any, i: number) => (
              <tr key={log.id || i} className="border-b last:border-b-0 transition-colors hover:bg-white/[0.02]" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3">
                  <span className="text-[11px] tabular-nums" style={{ color: "var(--foreground)" }}>
                    {new Date(log.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: getColor(log.action) + "15", color: getColor(log.action) }}>{log.action}</span>
                </td>
                <td className="px-4 py-3"><span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{log.entity_type || "—"}</span></td>
                <td className="px-4 py-3"><span className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>{log.ip_address || "—"}</span></td>
                <td className="px-4 py-3">
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <code className="text-[9px] rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>{JSON.stringify(log.metadata).slice(0, 80)}</code>
                  ) : <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin eventos de auditoría</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityTab({ loginHistory, members, securityStats }: { loginHistory: any[]; members: any[]; securityStats: any }) {
  const memberMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const mem of members) m[mem.user_id] = mem.user;
    return m;
  }, [members]);

  return (
    <div className="space-y-5">
      {/* Security KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Logins Recientes", value: securityStats.totalLogins, color: "#3B82F6", icon: Activity },
          { label: "Passkeys Habilitados", value: `${securityStats.passkeysEnabled}/${members.length}`, color: "#16A34A", icon: Key },
          { label: "IPs Únicas", value: securityStats.uniqueIPs, color: "#F59E0B", icon: MonitorSmartphone },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: s.color + "15" }}>
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{s.value}</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Login History Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Historial de Logins</h3>
        </div>
        <table className="w-full">
          <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Usuario", "Fecha", "IP", "Método"].map(h => <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loginHistory.slice(0, 30).map((lh: any, i: number) => {
              const user = memberMap[lh.user_id];
              return (
                <tr key={lh.id || i} className="border-b last:border-b-0 hover:bg-white/[0.02]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-2.5"><span className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>{user?.name || user?.email || lh.user_id?.slice(0, 8)}</span></td>
                  <td className="px-5 py-2.5"><span className="text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{new Date(lh.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></td>
                  <td className="px-5 py-2.5"><span className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>{lh.ip_address || "—"}</span></td>
                  <td className="px-5 py-2.5"><span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{lh.provider || "email"}</span></td>
                </tr>
              );
            })}
            {loginHistory.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin logins registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({ settings, fetcher, org }: { settings: any; fetcher: any; org: any }) {
  const [plan, setPlan] = useState(settings.plan || "demo");
  const [maxUsers, setMaxUsers] = useState(settings.max_users || 10);
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || "#7c3aed");
  const [billingEmail, setBillingEmail] = useState(settings.billing_email || "");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const save = () => {
    fetcher.submit({ intent: "update_settings", plan, max_users: String(maxUsers), primary_color: primaryColor, billing_email: billingEmail }, { method: "post" });
  };

  const changeStatus = (newStatus: string) => {
    fetcher.submit({ intent: "change_org_status", new_status: newStatus }, { method: "post" });
    setConfirmAction(null);
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>Configuración General</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              <option value="demo">Demo</option><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Máximo de usuarios</label>
            <input type="number" value={maxUsers} onChange={e => setMaxUsers(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Color primario</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
              <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Email de facturación</label>
            <input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="billing@empresa.com" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
        </div>
        <button onClick={save} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>
          <Save size={16} /> Guardar Configuración
        </button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border-2 p-6" style={{ borderColor: "#EF444440" }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} style={{ color: "#EF4444" }} />
          <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#EF4444" }}>Zona de Peligro</h3>
        </div>

        <div className="space-y-3">
          {/* Suspend */}
          {org.status === "active" && (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>Suspender organización</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Los miembros no podrán acceder. Reversible.</p>
              </div>
              {confirmAction === "suspend" ? (
                <div className="flex gap-2">
                  <button onClick={() => changeStatus("suspended")} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white" style={{ backgroundColor: "#F59E0B" }}>Confirmar</button>
                  <button onClick={() => setConfirmAction(null)} className="rounded-lg px-3 py-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmAction("suspend")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: "#F59E0B40", color: "#F59E0B" }}>
                  <Pause size={12} /> Suspender
                </button>
              )}
            </div>
          )}

          {/* Restore from suspended */}
          {org.status === "suspended" && (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>Restaurar organización</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Reactivar acceso para todos los miembros.</p>
              </div>
              <button onClick={() => changeStatus("active")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium text-white" style={{ backgroundColor: "#16A34A" }}>
                <Play size={12} /> Restaurar
              </button>
            </div>
          )}

          {/* Archive */}
          {org.status !== "archived" && (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>Archivar organización</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Mover a archivo. Los datos se conservan pero la org queda inactiva.</p>
              </div>
              {confirmAction === "archive" ? (
                <div className="flex gap-2">
                  <button onClick={() => changeStatus("archived")} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white" style={{ backgroundColor: "#EF4444" }}>Confirmar Archivo</button>
                  <button onClick={() => setConfirmAction(null)} className="rounded-lg px-3 py-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmAction("archive")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: "#EF444440", color: "#EF4444" }}>
                  <Archive size={12} /> Archivar
                </button>
              )}
            </div>
          )}

          {/* Restore from archived */}
          {org.status === "archived" && (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>Restaurar desde archivo</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Reactivar la organización archivada.</p>
              </div>
              <button onClick={() => changeStatus("active")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium text-white" style={{ backgroundColor: "#16A34A" }}>
                <Play size={12} /> Restaurar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
