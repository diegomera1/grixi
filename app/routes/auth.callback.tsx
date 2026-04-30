import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { createNotification } from "~/lib/notifications.server";

/**
 * Parse user-agent into browser/OS/device for login history
 */
function parseUserAgent(ua: string) {
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|Brave)\/[\d.]+/)?.[0]?.split("/")[0]
    || (ua.includes("CriOS") ? "Chrome" : ua.includes("FxiOS") ? "Firefox" : "Unknown");
  const os = ua.includes("Windows") ? "Windows"
    : ua.includes("Mac") ? "macOS"
    : ua.includes("Linux") ? "Linux"
    : ua.includes("Android") ? "Android"
    : ua.includes("iPhone") || ua.includes("iPad") ? "iOS"
    : "Unknown";
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  return {
    browser,
    os,
    deviceType: isTablet ? "tablet" : isMobile ? "mobile" : "desktop",
  };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const isLinking = url.searchParams.get("linking") === "true";

  // Detect admin portal for proper redirect targets
  const host = request.headers.get("host") || "";
  const isAdminPortal = host.startsWith("admin.") || host.startsWith("admin.grixi.ai");
  const defaultRedirect = isAdminPortal ? "/admin" : "/dashboard";

  if (!code) {
    return redirect(isAdminPortal ? "/login?error=generic" : "/?error=generic");
  }

  const { supabase, headers } = createSupabaseServerClient(request, env);

  // Exchange code for session (PKCE: code_verifier cookie must be on same origin)
  const { data: sessionData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

  if (authError || !sessionData.user) {
    console.error("Auth callback error:", authError);
    return redirect(isLinking ? "/perfil?tab=accounts&error=link_failed" : "/?error=auth_failed");
  }

  // ── Identity Linking flow: redirect back to profile ──
  if (isLinking) {
    const admin = createSupabaseAdminClient(env);
    const ip = getClientIP(request);
    await logAuditEvent(admin, {
      actorId: sessionData.user.id,
      action: "identity.linked",
      entityType: "identity",
      metadata: { provider: sessionData.user.app_metadata?.provider || "unknown", ip },
      ipAddress: ip,
    });
    return redirect("/perfil?tab=accounts&linked=success", { headers });
  }

  const userEmail = sessionData.user.email;
  if (!userEmail) {
    return redirect(isAdminPortal ? "/login?error=no_email" : "/?error=no_email");
  }

  // ── Record login history + audit ──
  const admin = createSupabaseAdminClient(env);
  const ip = getClientIP(request);
  const ua = request.headers.get("user-agent") || "";
  const { browser, os, deviceType } = parseUserAgent(ua);

  // ═══ ADMIN PORTAL FAST-PATH ═══
  // Platform admins on admin.grixi.ai skip org membership checks entirely
  if (isAdminPortal) {
    const { data: platformAdmin } = await admin
      .from("platform_admins")
      .select("id")
      .eq("user_id", sessionData.user.id)
      .maybeSingle();

    if (platformAdmin) {
      // Log admin login
      await logAuditEvent(admin, {
        actorId: sessionData.user.id,
        action: "admin.login",
        entityType: "platform_admin",
        metadata: { browser, os, deviceType, ip, portal: "admin.grixi.ai" },
        ipAddress: ip,
      });
      return redirect("/admin", { headers });
    }

    // Not a platform admin → sign out and redirect to login with error
    await supabase.auth.signOut();
    return redirect("/login?error=not_admin", { headers });
  }

  // 1. Check existing memberships
  const { data: existingMemberships } = await admin
    .from("memberships")
    .select("organization_id, organizations(slug, name)")
    .eq("user_id", sessionData.user.id);

  if (existingMemberships && existingMemberships.length > 0) {
    // Record login for each org (fire-and-forget)
    const orgId = existingMemberships[0].organization_id;
    const orgName = (existingMemberships[0] as any).organizations?.name || "GRIXI";
    const userName = sessionData.user.user_metadata?.full_name || sessionData.user.email || "Usuario";
    await Promise.all([
      admin.from("login_history").insert({
        user_id: sessionData.user.id, organization_id: orgId,
        ip_address: ip, user_agent: ua, browser, os, device_type: deviceType,
      }),
      logAuditEvent(admin, {
        actorId: sessionData.user.id, action: "user.login", entityType: "session",
        organizationId: orgId, metadata: { browser, os, deviceType, ip },
        ipAddress: ip,
      }),
    ]);

    // Notify platform admins of login (fire & forget)
    const { data: admins } = await admin.from("platform_admins")
      .select("user_id").neq("user_id", sessionData.user.id);
    if (admins && admins.length > 0) {
      const timeStr = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
      const notifEnv = {
        VAPID_PUBLIC_KEY: (env as any).VAPID_PUBLIC_KEY || "",
        VAPID_PRIVATE_KEY: (env as any).VAPID_PRIVATE_KEY || "",
      };
      Promise.all(
        admins.map((a) =>
          createNotification(admin, {
            userId: a.user_id,
            organizationId: orgId,
            title: `${userName} inició sesión`,
            body: `Accedió a ${orgName} a las ${timeStr}`,
            type: "info",
            module: "system",
            actionUrl: "/configuracion",
            actorId: sessionData.user.id,
            actorName: userName,
            metadata: { event: "login", userEmail: sessionData.user.email },
            sendPush: true,
          }, notifEnv)
        )
      ).catch(() => {});
    }

    // User already has access — route appropriately
    if (isAdminPortal) {
      return redirect("/admin", { headers });
    }
    if (existingMemberships.length === 1) {
      return redirect("/dashboard", { headers });
    }
    return redirect("/select-org", { headers });
  }

  // 2. Verify whitelist (invitations + domain whitelists)
  const { data: whitelistAccess, error: whitelistError } = await admin.rpc(
    "verify_whitelist_access",
    { user_email: userEmail }
  );

  if (whitelistError || !whitelistAccess || whitelistAccess.length === 0) {
    // No access — sign out and redirect
    await supabase.auth.signOut();
    return redirect(isAdminPortal ? "/login?error=unauthorized" : "/?error=unauthorized", { headers });
  }

  // 3. Create memberships for each whitelisted org
  for (const access of whitelistAccess) {
    // Find the role
    const { data: role } = await admin
      .from("roles")
      .select("id")
      .eq("name", access.role_name)
      .eq("organization_id", access.organization_id)
      .single();

    if (role) {
      await admin.from("memberships").upsert(
        {
          user_id: sessionData.user.id,
          organization_id: access.organization_id,
          role_id: role.id,
        },
        { onConflict: "user_id,organization_id" }
      );
    }

    // Mark invitation as accepted if source is invitation
    if (access.source === "invitation") {
      await admin
        .from("invitations")
        .update({ status: "accepted" })
        .eq("email", userEmail)
        .eq("organization_id", access.organization_id)
        .eq("status", "pending");
    }
  }

  // Route based on context
  if (isAdminPortal) {
    return redirect("/admin", { headers });
  }
  if (whitelistAccess.length === 1) {
    return redirect("/dashboard", { headers });
  }
  return redirect("/select-org", { headers });
}
