import {
  LayoutDashboard,
  DollarSign,
  Warehouse,
  ShoppingCart,
  Users,
  Shield,
  Sparkles,
  Crosshair,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ────────────────────────────────────────

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
};

// ── Primary Tabs (bottom bar on mobile) ──────────

export const PRIMARY_TABS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "#06B6D4" },
  { label: "Finanzas", href: "/finanzas", icon: DollarSign, color: "#8B5CF6" },
  { label: "Almacenes", href: "/almacenes", icon: Warehouse, color: "#10B981" },
  { label: "Compras", href: "/compras", icon: ShoppingCart, color: "#F97316" },
];

// ── Secondary Items ("Más" drawer on mobile) ─────

export const SECONDARY_ITEMS: NavItem[] = [
  { label: "Centro de Comando", href: "/command-center", icon: Crosshair, color: "#EC4899" },
  { label: "Usuarios", href: "/usuarios", icon: Users, color: "#F59E0B" },
  { label: "Administración", href: "/administracion", icon: Shield, color: "#F43F5E" },
  { label: "GRIXI AI", href: "/ai", icon: Sparkles, color: "#A855F7" },
];

// ── All nav items (combined) ─────────────────────

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_TABS, ...SECONDARY_ITEMS];
