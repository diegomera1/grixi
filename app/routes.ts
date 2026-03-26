import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/signout", "routes/auth.signout.tsx"),
  route("select-org", "routes/select-org.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
] satisfies RouteConfig;
