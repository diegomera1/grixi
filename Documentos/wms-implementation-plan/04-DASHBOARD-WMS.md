# 04 — Dashboard WMS

## 4.1 Filosofía del Dashboard

El dashboard WMS de GRIXI debe ser un **Centro de Comando Operativo** en tiempo real. No es un reporte estático — es una ventana viva a lo que está pasando en el almacén ahora mismo.

**Principios:**
- Priorizar información accionable sobre estadísticas históricas
- Colores con significado (status-driven, no decorativos)
- Animaciones sutiles que indiquen data en vivo
- Densidad informativa alta sin saturar
- Un vistazo (< 5 segundos) debe dar contexto completo

---

## 4.2 Hero Header — KPIs Principales

4 KPI cards principales con animación de entrada (stagger) y pulse dot verde de "live":

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  🟢 live       │  │  🟢 live       │  │  🟢 live       │  │  🟢 live       │
│                │  │                │  │                │  │                │
│    8,163       │  │    82.4%       │  │    $2.4M       │  │    47          │
│   Posiciones   │  │   Ocupación    │  │  Valor Stock   │  │  Mov. Hoy     │
│   Totales      │  │   General      │  │  Total         │  │               │
│                │  │                │  │                │  │               │
│  ▲ 306 racks   │  │  ▼ -1.2% vs   │  │  ▲ +5.3% vs   │  │  12📥 8📤 3🔄 │
│  5 almacenes   │  │  ayer          │  │  mes pasado    │  │  Hoy          │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

### KPI Definitions

| KPI | Fuente | Cálculo | Color |
|-----|--------|---------|-------|
| Posiciones Totales | `rack_positions` | COUNT(*) | Emerald |
| Ocupación General | `rack_positions` | COUNT(occupied) / COUNT(*) × 100 | Dinámico (>90% Rojo, >70% Amber, <70% Emerald) |
| Valor Stock Total | `inventory` JOIN `products` | SUM(quantity × valuation_price) | Indigo |
| Movimientos Hoy | `inventory_movements` | COUNT(*) WHERE created_at >= today | Blue |

---

## 4.3 Sección: Actividad en Tiempo Real

Panel izquierdo que muestra las últimas operaciones como un feed live:

```
┌─ Actividad en Tiempo Real ──────────────────────────────────────┐
│                                                        [Ver todo]│
│                                                                  │
│  🟢 hace 3 min                                                  │
│  📥 Entrada de Mercancía GR-2026-0051                           │
│  45 × Rodamiento SKF 6205 → Almacén Central, Rack A01           │
│  Por: Carlos Mendoza                                             │
│  ─────────────────────────────────────────────────────────────── │
│  🟢 hace 15 min                                                 │
│  📤 Salida de Mercancía GI-2026-0023                            │
│  20 × Motor Eléctrico 5HP ← Materia Prima, Rack B02             │
│  Pedido: SO-2026-0045 | Cliente: Industrias del Pacífico        │
│  ─────────────────────────────────────────────────────────────── │
│  🟡 hace 45 min                                                 │
│  🔄 Traspaso TO-2026-0012                                       │
│  30 × Casco de Seguridad 3M: C01-3-2 → A03-1-4                 │
│  Motivo: Reslotting por ABC                                      │
│  ─────────────────────────────────────────────────────────────── │
│  🔵 hace 1h                                                     │
│  📋 Conteo Cíclico PC-2026-0005                                 │
│  Pasillo A, 24 posiciones | 2 varianzas encontradas             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4.4 Sección: Pipeline de Operaciones

Barras horizontales que muestran el estado de cada tipo de operación:

```
┌─ Pipeline de Operaciones ───────────────────────────────────────┐
│                                                                  │
│  Entradas de Mercancía                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │████████ Pendientes (23)  ██ Inspección (7)  ████ OK (45)│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Salidas de Mercancía                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │████ Pendientes (12)  ██████ Picking (15)  █████████ (38)│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Traspasos                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │██ Pendientes (5)  ████ En Tránsito (8)  ██████████ (32) │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Pedidos de Venta                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │██████ Confirmados (18)  ████ Picking (10)  ██ Despach.(6)│  │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4.5 Sección: Gráfica de Movimientos (7 días)

AreaChart con Recharts, 3 series superpuestas:

```
┌─ Movimientos últimos 7 días ────────────────────────────────────┐
│                                                                  │
│  200 ┤                                                           │
│      │           ████                                            │
│  150 ┤      ████ ████ ████                                       │
│      │ ████ ████ ████ ████                                       │
│  100 ┤ ████ ████ ████ ████ ████                                  │
│      │ ████ ████ ████ ████ ████                                  │
│   50 ┤ ████ ████ ████ ████ ████ ████                             │
│      │ ████ ████ ████ ████ ████ ████ ████                        │
│    0 ┤─────┬─────┬─────┬─────┬─────┬─────┬─────                │
│      │ Lun   Mar   Mié   Jue   Vie   Sáb   Dom                 │
│                                                                  │
│  Legend: ■ Entradas (Emerald)  ■ Salidas (Rose)  ■ Traspasos (Blue)│
└──────────────────────────────────────────────────────────────────┘
```

**Especificaciones técnicas:**
- Componente: `Recharts.AreaChart` con gradient fill
- Datos: RPC `wms_get_movement_trends(org_id, days := 7)`
- Tooltip: Muestra cantidad y valor por día
- Responsive: Se colapsa en mobile a barras simples

---

## 4.6 Sección: Ocupación por Almacén

Cards con anillos SVG animados (patrón existente) + health badges:

```
┌─ Ocupación por Almacén ─────────────────────────────────────────┐
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  ╭──╮            │  │  ╭──╮            │  │  ╭──╮          │ │
│  │  │78│ %          │  │  │92│ %          │  │  │65│ %        │ │
│  │  ╰──╯            │  │  ╰──╯            │  │  ╰──╯          │ │
│  │  Almacén Central │  │  Prod.Terminados │  │  Mat.Prima     │ │
│  │  🟢 Óptimo      │  │  🔴 Crítico      │  │  🟢 Óptimo    │ │
│  │  1,247 posiciones│  │  896 posiciones  │  │  720 posiciones│ │
│  │  [Ver 3D →]      │  │  [Ver 3D →]      │  │  [Ver 3D →]   │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  ╭──╮            │  │  ╭──╮            │                     │
│  │  │58│ %          │  │  │71│ %          │                     │
│  │  ╰──╯            │  │  ╰──╯            │                     │
│  │  Cámara Fría     │  │  Centro Logístico│                     │
│  │  🟢 Óptimo      │  │  🟡 Alto         │                     │
│  │  480 posiciones  │  │  960 posiciones  │                     │
│  │  [Ver 3D →]      │  │  [Ver 3D →]      │                     │
│  └──────────────────┘  └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4.7 Sección: Top Productos por Movimiento

BarChart horizontal mostrando los productos más movidos:

```
┌─ Top 10 Productos por Movimiento (30 días) ─────────────────────┐
│                                                                  │
│  Rodamiento SKF 6205    ████████████████████████████  287        │
│  Motor Eléctrico 5HP    █████████████████████         215        │
│  Aceite Hidráulico 68   ████████████████              185        │
│  Casco Seguridad 3M     ████████████████              180        │
│  Cable Eléctrico 12AWG  ███████████████               172        │
│  Bomba Rexroth A10      ██████████████                155        │
│  Guantes Nitrilo        ████████████                  138        │
│  Válvula Solenoide      ███████████                   125        │
│  Banda Gates B68         ██████████                   112        │
│  Cemento Portland       █████████                     98         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4.8 Sección: Alertas Activas

Cards de alertas con severidad y acción:

```
┌─ Alertas Activas ───────────────────────────────────────────────┐
│                                                                  │
│  🔴 CRÍTICO | Almacén Productos Terminados                     │
│  Ocupación al 92% — Supera límite de capacidad                 │
│  Acción: Programar transferencia a Centro Logístico             │
│  [Crear Traspaso]                                     hace 2h   │
│  ─────────────────────────────────────────────────────────────── │
│  🟡 ADVERTENCIA | Cámara Fría                                  │
│  3 lotes próximos a vencer (< 30 días)                          │
│  LOT-20260115-042, LOT-20260120-089, LOT-20260125-103          │
│  [Ver Lotes]                                          hace 5h   │
│  ─────────────────────────────────────────────────────────────── │
│  🔵 INFO | OC PO-2026-0089                                     │
│  Entrega retrasada 3 días. Proveedor: Industrial del Pacífico  │
│  [Ver OC] [Notificar Proveedor]                       hace 1d   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4.9 Sección: GRIXI AI — Insights del Almacén

Widget integrado directamente en el dashboard con insights generados por IA:

```
┌─ GRIXI AI — Insights del Almacén ────────────────────────────────┐
│  🤖 Generado automáticamente | Actualizado hace 15 min          │
│                                                                   │
│  ┌─ 🔴 Alta Prioridad ──────────────────────────────────────┐   │
│  │ 📈 Riesgo de desabasto en 14 días                        │   │
│  │ Motor Eléctrico 5HP: Consumo ∅ 12 UN/día,                │   │
│  │ Stock actual 85 UN → Se agota ~7 abril                    │   │
│  │ [Crear Sol. Compra]  [Analizar Detalle →]                 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ 🟡 Optimización ────────────────────────────────────────┐   │
│  │ 🔄 Desbalance de ocupación detectado                      │   │
│  │ Prod.Terminados: 92% vs Cámara Fría: 58%                 │   │
│  │ Traspasar 45 posiciones ahorraría $2,100/mes              │   │
│  │ [Generar Plan de Traspaso]                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ 🔵 Información ─────────────────────────────────────────┐   │
│  │ 📊 5 productos cambiaron de ABC-B a ABC-A este mes        │   │
│  │ Un reslotting mejoraría tiempos de picking un ~15%         │   │
│  │ [Ver Análisis ABC]                                        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [🤖 Preguntar a GRIXI AI sobre el almacén →]                   │
│  [🔄 Regenerar Análisis]                                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Implementación:**
- Server Action: `generateWMSInsights(orgId)` — detallado en `16-IA-WMS.md`
- Refresh: Cada 15 min o on-demand (botón regenerar)
- Insights persistidos en tabla `wms_ai_insights` para evitar re-generación innecesaria
- Acciones clickeables que redirigen a la operación correspondiente (crear traspaso, SOL compra, etc.)
- Ver `16-IA-WMS.md` para el detalle completo del motor de insights

---

## 4.10 KPIs Secundarios (Cards compactas)

```
┌─ Métricas Operativas ──────────────────────────────────────────┐
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ 2.3 días   │ │ 98.5%      │ │ 4.2        │ │ 15 min     │   │
│  │ Dock-to-   │ │ Precisión  │ │ Rotación   │ │ Tiempo     │   │
│  │ Stock Avg  │ │ Inventario │ │ Inventario │ │ Picking ∅  │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ 96.8%      │ │ 12         │ │ $0.42      │ │ 3          │   │
│  │ Precisión  │ │ Pedidos    │ │ Costo por  │ │ Conteos    │   │
│  │ Picking    │ │ Pendientes │ │ Movimiento │ │ Activos    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4.10 Implementación Técnica

### Data Fetching (Server Action)

```typescript
// features/almacenes/actions/dashboard-actions.ts

'use server'

export async function getWMSDashboardData(orgId: string, warehouseId?: string) {
  // 1. KPIs principales
  // 2. Actividad reciente (últimos 20 movimientos)
  // 3. Pipeline por tipo de operación
  // 4. Tendencias 7 días
  // 5. Ocupación por almacén
  // 6. Top productos
  // 7. Alertas activas
  // 8. KPIs secundarios
}
```

### Componente Principal

```typescript
// features/almacenes/components/wms-dashboard.tsx

// Server Component que fetchea y pasa data
// Usa Suspense boundaries por sección
// Skeleton loading para cada card/gráfica
// Framer Motion stagger para entrada
```

### Recharts Config

```typescript
// Paleta de colores del dashboard:
const DASHBOARD_COLORS = {
  entries: '#10B981',    // Emerald (Entradas)
  exits: '#F43F5E',      // Rose (Salidas)
  transfers: '#3B82F6',  // Blue (Traspasos)
  counts: '#8B5CF6',     // Violet (Conteos)
  critical: '#EF4444',   // Red
  warning: '#F59E0B',    // Amber
  optimal: '#10B981',    // Emerald
  brand: '#7C3AED',      // GRIXI Violet
}
```
