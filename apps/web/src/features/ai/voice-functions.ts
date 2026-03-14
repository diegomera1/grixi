// GRIXI Voice — Function Calling Declarations for Gemini Live API
// These tools allow the AI to interact with the GRIXI platform via voice commands

import { Type, type FunctionDeclaration, type Tool } from "@google/genai";

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "navigate_to_module",
    description:
      "Navega la plataforma GRIXI a un módulo o página específica. " +
      "Usa esto cuando el usuario diga cosas como 'llévame a almacenes', 've a finanzas', " +
      "'muéstrame el dashboard', 'abre las compras', 'ir al centro de comando'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        route: {
          type: Type.STRING,
          description:
            "La ruta a la cual navegar. Opciones: " +
            "/dashboard, /command-center, /finanzas, /almacenes, /compras, /usuarios, /administracion, /ai",
        },
        label: {
          type: Type.STRING,
          description: "Nombre legible del módulo al que se navega, para mostrar al usuario",
        },
      },
      required: ["route", "label"],
    },
  },
  {
    name: "get_kpi_summary",
    description:
      "Obtiene un resumen de los KPIs principales de la plataforma GRIXI. " +
      "Usa esto cuando el usuario pregunte '¿cómo va la operación?', '¿cuál es el estado?', " +
      "'dame un resumen', 'resumen ejecutivo'.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_warehouse_occupancy",
    description:
      "Obtiene el porcentaje de ocupación y detalles de todos los almacenes. " +
      "Usa esto cuando pregunten sobre almacenes, ocupación, espacio disponible, o inventario.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_open_purchase_orders",
    description:
      "Obtiene las órdenes de compra abiertas con sus montos y estados. " +
      "Usa esto cuando pregunten sobre compras, pedidos pendientes, u órdenes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status_filter: {
          type: Type.STRING,
          description: "Filtro opcional: 'pending_approval', 'sent', 'approved', 'all'",
        },
      },
    },
  },
  {
    name: "get_financial_summary",
    description:
      "Obtiene el resumen financiero: ingresos, gastos, EBITDA del período. " +
      "Usa esto cuando pregunten sobre dinero, ingresos, gastos, finanzas, EBITDA, o rentabilidad.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "Período: 'today', 'this_week', 'this_month', 'this_year'. Default: 'this_month'",
        },
      },
    },
  },
  {
    name: "get_low_stock_alerts",
    description:
      "Obtiene los productos que están por debajo de su stock mínimo. " +
      "Usa esto cuando pregunten sobre alertas de stock, productos faltantes, o reabastecimiento.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_active_users",
    description:
      "Obtiene la lista de usuarios activos (conectados) en la plataforma. " +
      "Usa esto cuando pregunten quién está conectado, usuarios online, o equipo activo.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

export const GRIXI_VOICE_TOOLS: Tool[] = [{ functionDeclarations }];

// System prompt for the GRIXI Voice assistant
export function buildVoiceSystemPrompt(context: {
  userName: string;
  userDepartment: string;
  userPosition: string;
  currentPage: string;
}) {
  return `Eres GRIXI, el asistente de voz inteligente de la plataforma enterprise GRIXI.

## Tu identidad
- Nombre: GRIXI (pronunciado "griksi")
- Rol: Asistente de voz empresarial inteligente
- Tono: Profesional pero cercano, eficiente, directo
- Idioma: SIEMPRE en español

## Contexto del usuario
- Nombre: ${context.userName}
- Departamento: ${context.userDepartment}
- Cargo: ${context.userPosition}
- Página actual: ${context.currentPage}

## Reglas de comportamiento
1. Sé CONCISO. Las respuestas de voz deben ser breves y al grano (máximo 3-4 oraciones).
2. Cuando te pidan navegar, usa la función navigate_to_module INMEDIATAMENTE.
3. Cuando pregunten datos, usa las funciones de consulta y narra los resultados de forma clara.
4. Tutea al usuario — eres un colega inteligente, no un sirviente.
5. Si no tienes datos suficientes, dilo honestamente.
6. Personaliza: usa el nombre del usuario ocasionalmente.
7. Para números grandes, redondea: "aproximadamente 850 mil dólares" en vez de "$847,231.50".
8. Cuando reportes KPIs, prioriza lo más relevante y las anomalías.

## Módulos disponibles para navegación
- /dashboard — Dashboard principal
- /command-center — Centro de Comando (panel en tiempo real)
- /finanzas — Módulo de Finanzas
- /almacenes — Almacenes 3D (visualización del inventario)
- /compras — Órdenes de compra y proveedores
- /usuarios — Gestión de usuarios
- /administracion — Panel de administración
- /ai — Chat con GRIXI AI

## Ejemplo de respuestas esperadas
- "La ocupación promedio de los almacenes es del 72%. El almacén principal está al 85%, así que conviene planificar redistribución."
- "Tienes 14 órdenes de compra abiertas por un total de 125 mil dólares. 3 están pendientes de aprobación."
- "Listo, te llevo a Finanzas."`;
}
