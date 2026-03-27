import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes
  index("routes/login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/signout", "routes/auth.signout.tsx"),
  route("select-org", "routes/select-org.tsx"),

  // Authenticated routes (sidebar + topbar layout)
  layout("routes/authenticated.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("finanzas", "routes/finanzas.tsx"),

    // Admin (platform_admin only)
    route("admin", "routes/admin/index.tsx"),
    route("admin/organizations", "routes/admin/organizations.tsx"),
    route("admin/organizations/:id", "routes/admin/organizations.$id.tsx"),
    route("admin/users", "routes/admin/users.tsx"),
    route("admin/audit", "routes/admin/audit.tsx"),
  ]),
] satisfies RouteConfig;
