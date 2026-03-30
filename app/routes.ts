import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes
  index("routes/login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/signout", "routes/auth.signout.tsx"),
  route("select-org", "routes/select-org.tsx"),
  route("unauthorized", "routes/unauthorized.tsx"),
  route("suspended", "routes/suspended.tsx"),

  // API resource routes (no layout)
  route("api/ai/chat", "routes/api.ai.chat.ts"),
  route("api/ai/conversations", "routes/api.ai.conversations.ts"),
  route("api/ai/upload", "routes/api.ai.upload.ts"),
  route("api/finance-analyze", "routes/api.finance-analyze.ts"),
  route("api/finance-notes", "routes/api.finance-notes.ts"),

  // ── Admin Portal (admin.grixi.ai) — layout independiente ──
  layout("routes/admin-layout.tsx", [
    route("admin", "routes/admin/index.tsx"),
    route("admin/organizations", "routes/admin/organizations.tsx"),
    route("admin/organizations/:id", "routes/admin/organizations.$id.tsx"),
    route("admin/users", "routes/admin/users.tsx"),
    route("admin/audit", "routes/admin/audit.tsx"),
    route("admin/plans", "routes/admin/plans.tsx"),
    route("admin/notifications", "routes/admin/notifications.tsx"),
    route("admin/settings", "routes/admin/settings.tsx"),
  ]),

  // ── Tenant Portal — authenticated routes (Orb layout) ──
  layout("routes/authenticated.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("finanzas", "routes/finanzas.tsx"),
    route("ai", "routes/ai.tsx"),

    // Tenant Configuration (owner/admin only)
    route("configuracion", "routes/configuracion.tsx", [
      index("routes/configuracion/equipo.tsx"),
      route("invitaciones", "routes/configuracion/invitaciones.tsx"),
      route("roles", "routes/configuracion/roles.tsx"),
      route("auditoria", "routes/configuracion/auditoria.tsx"),
      route("organizacion", "routes/configuracion/organizacion.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
