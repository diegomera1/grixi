"use client";

import { motion } from "framer-motion";
import {
  Package,
  Lightbulb,
  BarChart3,
  AlertTriangle,
  DollarSign,
  Users,
  LayoutDashboard,
  TrendingUp,
  Search,
  Shield,
  Layers,
  FileText,
  ShoppingCart,
  Truck,
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

type QuickPrompt = {
  label: string;
  prompt: string;
  icon: LucideIcon;
};

const MODULE_PROMPTS: Record<AiModule, QuickPrompt[]> = {
  general: [
    {
      label: "Resumen general",
      prompt: "Dame un resumen completo del estado actual de la empresa: inventario, finanzas, usuarios activos y actividad reciente.",
      icon: LayoutDashboard,
    },
    {
      label: "Estado del inventario",
      prompt: "¿Cuál es el estado actual del inventario en todos los almacenes? ¿Hay productos bajo stock mínimo?",
      icon: Package,
    },
    {
      label: "Análisis financiero",
      prompt: "Dame un análisis de las últimas transacciones financieras y tendencias de gastos e ingresos.",
      icon: TrendingUp,
    },
    {
      label: "Optimización general",
      prompt: "¿Qué áreas de la empresa pueden mejorar según los datos actuales? Dame sugerencias de optimización.",
      icon: Lightbulb,
    },
  ],
  almacenes: [
    {
      label: "Estado del inventario",
      prompt: "¿Cuál es el estado actual del inventario en los almacenes? ¿Qué productos están cerca del stock mínimo?",
      icon: Package,
    },
    {
      label: "Optimizar almacenes",
      prompt: "Dame sugerencias para optimizar la ocupación y distribución de los almacenes.",
      icon: Lightbulb,
    },
    {
      label: "Productos críticos",
      prompt: "¿Qué productos están por debajo del stock mínimo? ¿Cuáles necesitan reabastecimiento urgente?",
      icon: AlertTriangle,
    },
    {
      label: "Análisis de movimientos",
      prompt: "Analiza los movimientos de inventario recientes. ¿Hay patrones inusuales o tendencias?",
      icon: BarChart3,
    },
  ],
  compras: [
    {
      label: "Estado de compras",
      prompt: "Dame un resumen del estado actual de las órdenes de compra: abiertas, pendientes, recibidas y su monto total.",
      icon: ShoppingCart,
    },
    {
      label: "Top proveedores",
      prompt: "¿Cuáles son los proveedores con mejor cumplimiento y calidad? ¿Hay alguno con problemas recurrentes?",
      icon: Users,
    },
    {
      label: "Entregas pendientes",
      prompt: "¿Qué órdenes de compra tienen entregas pendientes? ¿Hay retrasos de proveedores?",
      icon: Truck,
    },
    {
      label: "Análisis de costos",
      prompt: "Analiza las tendencias de precios de los materiales más comprados. ¿Hay oportunidades de ahorro?",
      icon: TrendingUp,
    },
  ],
  finanzas: [
    {
      label: "Últimas transacciones",
      prompt: "Muéstrame un resumen de las últimas transacciones financieras con sus montos y categorías.",
      icon: DollarSign,
    },
    {
      label: "Análisis de gastos",
      prompt: "¿Cómo se distribuyen los gastos por departamento y centro de costo?",
      icon: BarChart3,
    },
    {
      label: "Tendencias financieras",
      prompt: "¿Cuáles son las tendencias de ingresos vs gastos? ¿Hay áreas donde podemos reducir costos?",
      icon: TrendingUp,
    },
    {
      label: "Centros de costo",
      prompt: "Muéstrame el estado de los centros de costo activos con sus presupuestos anuales.",
      icon: Layers,
    },
  ],
  usuarios: [
    {
      label: "Usuarios activos",
      prompt: "¿Cuántos usuarios activos hay en el sistema? ¿Cuáles son los roles asignados?",
      icon: Users,
    },
    {
      label: "Actividad reciente",
      prompt: "¿Cuál es la actividad reciente de los usuarios? ¿Quién ha estado más activo?",
      icon: BarChart3,
    },
    {
      label: "Roles y permisos",
      prompt: "Explícame cómo están configurados los roles y permisos del sistema.",
      icon: Shield,
    },
    {
      label: "Sesiones activas",
      prompt: "¿Cuántas sesiones activas hay actualmente? ¿Desde qué dispositivos se conectan?",
      icon: Search,
    },
  ],
  dashboard: [
    {
      label: "KPIs principales",
      prompt: "Dame los KPIs principales del dashboard: usuarios, inventario, transacciones y actividad.",
      icon: LayoutDashboard,
    },
    {
      label: "Resumen del día",
      prompt: "Dame un resumen de la actividad del día de hoy en toda la plataforma.",
      icon: FileText,
    },
    {
      label: "Alertas y anomalías",
      prompt: "¿Hay alertas o anomalías en el sistema que necesiten atención inmediata?",
      icon: AlertTriangle,
    },
    {
      label: "Tendencias semanales",
      prompt: "¿Cuáles son las tendencias de uso de la plataforma en la última semana?",
      icon: TrendingUp,
    },
  ],
  administracion: [
    {
      label: "Auditoría reciente",
      prompt: "¿Cuáles son los últimos eventos de auditoría registrados en el sistema?",
      icon: Shield,
    },
    {
      label: "Configuración actual",
      prompt: "Muéstrame un resumen de la configuración actual de la organización.",
      icon: Layers,
    },
    {
      label: "Permisos del sistema",
      prompt: "¿Cómo están distribuidos los permisos entre los diferentes roles?",
      icon: Users,
    },
    {
      label: "Actividad sospechosa",
      prompt: "¿Hay actividad inusual o sospechosa en los registros de auditoría recientes?",
      icon: AlertTriangle,
    },
  ],
};

const MODULE_DESCRIPTIONS: Record<AiModule, string> = {
  general: "Tu asistente inteligente para toda la empresa. Pregunta sobre inventario, finanzas, usuarios, o cualquier otro aspecto de tu organización.",
  almacenes: "Asistente especializado en gestión de almacenes, inventario, rack positions y movimientos de productos.",
  compras: "Asistente especializado en compras, proveedores, órdenes de compra, solicitudes de pedido y recepciones de mercancía.",
  finanzas: "Asistente especializado en análisis financiero, transacciones, centros de costo y tendencias de gastos.",
  usuarios: "Asistente especializado en gestión de usuarios, roles, permisos y actividad del equipo.",
  dashboard: "Asistente especializado en métricas clave, KPIs, resúmenes ejecutivos y análisis de tendencias.",
  administracion: "Asistente especializado en auditoría, configuración del sistema, permisos y seguridad.",
};

export function WelcomeScreen({ module, onPrompt, userName, greeting }: WelcomeScreenProps) {
  const prompts = MODULE_PROMPTS[module] || MODULE_PROMPTS.general;
  const description = MODULE_DESCRIPTIONS[module] || MODULE_DESCRIPTIONS.general;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      {/* Personalized greeting */}
      {userName && greeting && (
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 text-2xl font-bold text-[var(--text-primary)]"
        >
          {greeting},{" "}
          <span className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">
            {userName.split(" ")[0]}
          </span>
        </motion.h1>
      )}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GrixiAiLogo size={56} showText animate />
      </motion.div>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mb-10 mt-4 max-w-md text-center text-sm text-[var(--text-secondary)]"
      >
        {description}
      </motion.p>

      {/* Quick prompts grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="grid w-full max-w-lg grid-cols-2 gap-3"
      >
        {prompts.map((qp, i) => (
          <motion.button
            key={qp.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            onClick={() => onPrompt(qp.prompt)}
            className="group flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left transition-all hover:border-[var(--brand)]/30 hover:shadow-md hover:shadow-[var(--brand)]/5"
          >
            <qp.icon
              size={18}
              className="mt-0.5 shrink-0 text-[var(--brand)] transition-transform group-hover:scale-110"
            />
            <span className="text-sm leading-snug text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
              {qp.label}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
