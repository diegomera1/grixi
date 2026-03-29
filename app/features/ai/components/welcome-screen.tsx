import { motion } from "framer-motion";
import {
  Package, Lightbulb, BarChart3, AlertTriangle,
  DollarSign, Users, LayoutDashboard, TrendingUp,
  Search, Shield, Layers, FileText, ShoppingCart, Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GrixiAiLogo } from "./grixi-ai-logo";
import type { AiModule } from "../types";

type WelcomeScreenProps = {
  module: AiModule;
  onPrompt: (prompt: string) => void;
  userName?: string;
  greeting?: string;
};

type QuickPrompt = { label: string; prompt: string; icon: LucideIcon };

const MODULE_PROMPTS: Record<AiModule, QuickPrompt[]> = {
  general: [
    { label: "Resumen general", prompt: "Dame un resumen completo del estado actual de la empresa: inventario, finanzas, usuarios activos y actividad reciente.", icon: LayoutDashboard },
    { label: "Estado del inventario", prompt: "¿Cuál es el estado actual del inventario en todos los almacenes? ¿Hay productos bajo stock mínimo?", icon: Package },
    { label: "Análisis financiero", prompt: "Dame un análisis de las últimas transacciones financieras y tendencias de gastos e ingresos.", icon: TrendingUp },
    { label: "Optimización general", prompt: "¿Qué áreas de la empresa pueden mejorar según los datos actuales? Dame sugerencias de optimización.", icon: Lightbulb },
  ],
  almacenes: [
    { label: "Estado del inventario", prompt: "¿Cuál es el estado actual del inventario en los almacenes? ¿Qué productos están cerca del stock mínimo?", icon: Package },
    { label: "Optimizar almacenes", prompt: "Dame sugerencias para optimizar la ocupación y distribución de los almacenes.", icon: Lightbulb },
    { label: "Productos críticos", prompt: "¿Qué productos están por debajo del stock mínimo? ¿Cuáles necesitan reabastecimiento urgente?", icon: AlertTriangle },
    { label: "Análisis de movimientos", prompt: "Analiza los movimientos de inventario recientes. ¿Hay patrones inusuales o tendencias?", icon: BarChart3 },
  ],
  compras: [
    { label: "Estado de compras", prompt: "Dame un resumen del estado actual de las órdenes de compra.", icon: ShoppingCart },
    { label: "Top proveedores", prompt: "¿Cuáles son los proveedores con mejor cumplimiento y calidad?", icon: Users },
    { label: "Entregas pendientes", prompt: "¿Qué órdenes de compra tienen entregas pendientes?", icon: Truck },
    { label: "Análisis de costos", prompt: "Analiza las tendencias de precios de los materiales más comprados.", icon: TrendingUp },
  ],
  finanzas: [
    { label: "Últimas transacciones", prompt: "Muéstrame un resumen de las últimas transacciones financieras.", icon: DollarSign },
    { label: "Análisis de gastos", prompt: "¿Cómo se distribuyen los gastos por departamento y centro de costo?", icon: BarChart3 },
    { label: "Tendencias financieras", prompt: "¿Cuáles son las tendencias de ingresos vs gastos?", icon: TrendingUp },
    { label: "Centros de costo", prompt: "Muéstrame el estado de los centros de costo activos.", icon: Layers },
  ],
  usuarios: [
    { label: "Usuarios activos", prompt: "¿Cuántos usuarios activos hay en el sistema? ¿Cuáles son los roles asignados?", icon: Users },
    { label: "Actividad reciente", prompt: "¿Cuál es la actividad reciente de los usuarios?", icon: BarChart3 },
    { label: "Roles y permisos", prompt: "Explícame cómo están configurados los roles y permisos del sistema.", icon: Shield },
    { label: "Sesiones activas", prompt: "¿Cuántas sesiones activas hay actualmente?", icon: Search },
  ],
  dashboard: [
    { label: "KPIs principales", prompt: "Dame los KPIs principales del dashboard.", icon: LayoutDashboard },
    { label: "Resumen del día", prompt: "Dame un resumen de la actividad del día de hoy.", icon: FileText },
    { label: "Alertas y anomalías", prompt: "¿Hay alertas o anomalías que necesiten atención?", icon: AlertTriangle },
    { label: "Tendencias semanales", prompt: "¿Cuáles son las tendencias de uso de la última semana?", icon: TrendingUp },
  ],
  administracion: [
    { label: "Auditoría reciente", prompt: "¿Cuáles son los últimos eventos de auditoría registrados?", icon: Shield },
    { label: "Configuración actual", prompt: "Muéstrame la configuración actual de la organización.", icon: Layers },
    { label: "Permisos del sistema", prompt: "¿Cómo están distribuidos los permisos entre los roles?", icon: Users },
    { label: "Actividad sospechosa", prompt: "¿Hay actividad inusual en los registros de auditoría?", icon: AlertTriangle },
  ],
};

const MODULE_DESCRIPTIONS: Record<AiModule, string> = {
  general: "Tu asistente inteligente para toda la empresa.",
  almacenes: "Asistente especializado en gestión de almacenes e inventario.",
  compras: "Asistente especializado en compras y proveedores.",
  finanzas: "Asistente especializado en análisis financiero.",
  usuarios: "Asistente especializado en gestión de usuarios y roles.",
  dashboard: "Asistente especializado en métricas y KPIs.",
  administracion: "Asistente especializado en auditoría y configuración.",
};

export function WelcomeScreen({ module, onPrompt, userName, greeting }: WelcomeScreenProps) {
  const prompts = MODULE_PROMPTS[module] || MODULE_PROMPTS.general;
  const description = MODULE_DESCRIPTIONS[module] || MODULE_DESCRIPTIONS.general;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      {userName && greeting && (
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 md:mb-6 text-lg md:text-2xl font-bold text-text-primary"
        >
          {greeting},{" "}
          <span className="bg-linear-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">
            {userName.split(" ")[0]}
          </span>
        </motion.h1>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <GrixiAiLogo size={40} showText animate />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mb-6 md:mb-10 mt-3 md:mt-4 max-w-xs md:max-w-md text-center text-xs md:text-sm text-text-secondary"
      >
        {description}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="grid w-full max-w-lg grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 px-2 md:px-0"
      >
        {prompts.map((qp, i) => (
          <motion.button
            key={qp.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            onClick={() => onPrompt(qp.prompt)}
            className="group flex items-center sm:items-start gap-2.5 md:gap-3 rounded-xl md:rounded-2xl border border-border bg-surface p-3 md:p-4 text-left transition-all hover:border-brand/30 hover:shadow-md hover:shadow-(--brand)/5 active:scale-[0.98]"
          >
            <qp.icon size={18} className="mt-0.5 shrink-0 text-brand transition-transform group-hover:scale-110" />
            <span className="text-xs md:text-sm leading-snug text-text-secondary group-hover:text-text-primary">
              {qp.label}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
