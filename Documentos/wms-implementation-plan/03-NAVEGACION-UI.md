# 03 — Navegación y Estructura UI

## 3.1 Estructura de Tabs del Módulo Almacenes

El módulo de Almacenes se reorganiza completamente con una navegación por tabs premium (patrón Underline-Indicator de Finance):

```
/almacenes
├── Tab: Dashboard          → Vista general con KPIs, gráficas + AI Insights widget
├── Tab: Almacenes          → Lista de almacenes con cards (ya existe, mejorar)
├── Tab: Operaciones        → Sub-tabs operativas
│   ├── Sub-tab: Entradas   → Goods Receipt (Entrada de Mercancía)
│   ├── Sub-tab: Salidas    → Goods Issue (Salida de Mercancía)
│   ├── Sub-tab: Traspasos  → Transfer Orders
│   └── Sub-tab: Conteos    → Physical Inventory Counts
├── Tab: Inventario         → Stock actual por producto/ubicación
├── Tab: Lotes              → NUEVO — Gestión de lotes + alertas vencimiento
├── Tab: Movimientos        → Historial completo de movimientos
├── Tab: Análisis IA 🤖     → NUEVO — Insights, reportes, predicciones, chat contextual
└── Tab: 3D                 → Digital Twin (enlace al visor)
```

---

## 3.2 Layout Jerárquico

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sidebar (ya existe)                                                 │
│  └── 📦 Almacenes                                                  │
│       └── Click → /almacenes                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Header del Módulo ─────────────────────────────────────────────┐│
│  │ 📦 Módulo de Almacenes             [Selector de Almacén ▼]     ││
│  │ Gestión integral de inventarios     Almacén Central ▼           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ Tab Navigation (Underline-Indicator) ──────────────────────────┐│
│  │ Dashboard | Almacenes | Operaciones | Inventario | Lotes |       ││
│  │ Movimientos | Análisis IA 🤖 | 3D                                ││
│  │ ─────────                                                       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ Content Area ──────────────────────────────────────────────────┐│
│  │                                                                  ││
│  │  (Contenido dinámico según tab seleccionado)                    ││
│  │                                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.3 Selector de Almacén (Global)

Un componente sticky en el header que permite seleccionar el almacén activo. Filtra toda la data del módulo:

```
┌─────────────────────────────────────────┐
│ 🏭 Almacén: [Almacén Central ▾]        │
│                                          │
│  Opciones:                               │
│  ├── Todos los Almacenes                 │
│  ├── Almacén Central (Planta 1000)       │
│  ├── Almacén Materia Prima (Planta 1000) │
│  ├── Productos Terminados (Planta 2000)  │
│  ├── Cámara Fría (Planta 1000)           │
│  └── Centro Logístico Norte (Planta 3000)│
└─────────────────────────────────────────┘
```

**Comportamiento:**
- Al cambiar el almacén, todas las tabs se filtran
- El almacén seleccionado persiste en localStorage
- "Todos los Almacenes" muestra data agregada
- Badge con código SAP del centro/almacén

---

## 3.4 Tab: Dashboard

**Ruta:** `/almacenes` (default tab)

### Layout del Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    HERO HEADER KPIs                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 🔵 1,247 │  │ 🟢 89.2% │  │ 🟡 23    │  │ 🔴 5     │       │
│  │ Posiciones│  │ Ocupación│  │ Entregas │  │ Alertas  │       │
│  │ Totales   │  │ Promedio │  │ Pendient.│  │ Activas  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Actividad del Día ───────────────────┐  ┌─ Pipeline ──────┐│
│  │                                        │  │                  ││
│  │  📥 Entradas Hoy: 12 (450 unidades)   │  │ Pendientes: 23  ││
│  │  📤 Salidas Hoy: 8 (280 unidades)     │  │ En Proceso: 7   ││
│  │  🔄 Traspasos Hoy: 3                  │  │ Completados: 45 ││
│  │  📋 Conteos Activos: 1                │  │                  ││
│  │                                        │  │ [Visual Bars]   ││
│  └────────────────────────────────────────┘  └─────────────────┘│
│                                                                  │
│  ┌─ Gráfica: Movimientos (7 días) ──────────────────────────────┐│
│  │                                                                ││
│  │  AreaChart con 3 series:                                      ││
│  │  - Entradas (Emerald)                                         ││
│  │  - Salidas (Rose)                                             ││
│  │  - Traspasos (Blue)                                           ││
│  │                                                                ││
│  │  [═══════════════════════════════════════════]                ││
│  │  Lun   Mar   Mié   Jue   Vie   Sáb   Dom                    ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Ocupación x Almacén ──────────┐  ┌─ Top Productos ─────────┐│
│  │                                 │  │                          ││
│  │  Almacén Central      [▓▓▓░ 78%]│  │  1. Rodamiento SKF  120 ││
│  │  Materia Prima        [▓▓░░ 65%]│  │  2. Motor 5HP        85 ││
│  │  Prod. Terminados     [▓▓▓▓ 92%]│  │  3. Aceite SAE        72 ││
│  │  Cámara Fría          [▓▓░░ 58%]│  │  4. Casco 3M          68 ││
│  │  Centro Logístico     [▓▓▓░ 71%]│  │  5. Cable 12AWG       55 ││
│  └─────────────────────────────────┘  └──────────────────────────┘│
│                                                                  │
│  ┌─ Alertas Activas ────────────────────────────────────────────┐│
│  │  🔴 Almacén Central: Ocupación > 90% en Pasillo A           ││
│  │  🟡 Cámara Fría: Lote LOT-20260315 próximo a expirar        ││
│  │  🔵 OC-2026-0089: Entrega retrasada 3 días                  ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.5 Tab: Operaciones — Sub-tabs

### Sub-tab: Entradas

```
┌─────────────────────────────────────────────────────────────────┐
│  Sub-tabs: [ Entradas | Salidas | Traspasos | Conteos ]         │
│             ─────────                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Toolbar ─────────────────────────────────────────────────┐  │
│  │ [+ Nueva Entrada] [Filtros ▼] [Buscar...] [Exportar CSV] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Tabla de Goods Receipts ─────────────────────────────────────┐│
│  │ # Receipt    │ OC Ref.    │ Proveedor    │ Almacén  │ Estado ││
│  │──────────────┼────────────┼──────────────┼──────────┼────────││
│  │ GR-2026-0051 │ PO-2026-089│ MetalTech    │ Central  │ 🟢 OK  ││
│  │ GR-2026-0050 │ PO-2026-087│ Suministros  │ Mat.Prima│ 🟡 Insp.│
│  │ GR-2026-0049 │ PO-2026-085│ Ind.Pacífico │ Central  │ 🔵 Pend.│
│  └────────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Click row → Drawer lateral con detalle del GR                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sub-tab: Salidas

```
┌─────────────────────────────────────────────────────────────────┐
│  Sub-tabs: [ Entradas | Salidas | Traspasos | Conteos ]         │
│                         ───────                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─ Toolbar ─────────────────────────────────────────────────┐  │
│  │ [+ Nueva Salida] [Filtros ▼] [Buscar...]                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Tabla de Goods Issues ───────────────────────────────────────┐│
│  │ # Salida     │ Tipo       │ Referencia   │ Almacén  │ Estado ││
│  │──────────────┼────────────┼──────────────┼──────────┼────────││
│  │ GI-2026-0023 │ Ped. Venta │ SO-2026-0045 │ Central  │ 🟢 Post.│
│  │ GI-2026-0022 │ C. Costo   │ CC-MTTO      │ Mat.Prima│ 🟡 Pick.│
│  │ GI-2026-0021 │ Ped. Venta │ SO-2026-0044 │ Prod.Ter.│ 🔵 Pend.│
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.6 Tab: Inventario

Vista de stock actual con filtros avanzados:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ Filtros ─────────────────────────────────────────────────┐  │
│  │ [Producto ▼] [Categoría ▼] [Estado ▼] [Almacén ▼] [🔍]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Stock por Producto ──────────────────────────────────────────┐│
│  │ SKU          │ Producto         │ Almacén  │ Posición│ Cant. ││
│  │──────────────┼──────────────────┼──────────┼─────────┼───────││
│  │ MEC-BRD-001  │ Rodamiento SKF   │ Central  │ A01-3-2 │ 120   ││
│  │ MEC-BRD-001  │ Rodamiento SKF   │ Central  │ A02-1-3 │ 85    ││
│  │ HYD-PMP-001  │ Bomba Rexroth    │ Mat.Prima│ B01-2-1 │ 12    ││
│  │              │                  │          │ TOTAL   │ 217   ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Expandir fila → Detalle con lotes, fechas, proveedor, OC       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.7 Tab: Movimientos

Historial completo tipo audit log:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ Filtros ─────────────────────────────────────────────────┐  │
│  │ [Tipo Mov. ▼] [Fecha ▼] [Producto ▼] [Usuario ▼]        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Timeline de Movimientos ─────────────────────────────────────┐│
│  │                                                                ││
│  │  📥 hace 15min │ GR-2026-0051 │ 101 │ Rodamiento SKF → A01-3-2│
│  │  ──────────────────────────────────────────────────────────── ││
│  │  📤 hace 1h    │ GI-2026-0023 │ 201 │ Motor 5HP ← B02-1-4    │
│  │  ──────────────────────────────────────────────────────────── ││
│  │  🔄 hace 2h    │ TO-2026-0012 │ 311 │ Casco 3M: C01→A03      │
│  │  ──────────────────────────────────────────────────────────── ││
│  │  📋 hace 3h    │ PC-2026-0005 │ 501 │ Ajuste +5 Cable 12AWG  │
│  │                                                                ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.8 Componentes Reutilizables

| Componente | Descripción | Usado en |
|-----------|-------------|----------|
| `warehouse-selector.tsx` | Dropdown global de almacén | Header módulo |
| `document-status-badge.tsx` | Badge con color por estado | Todas las tablas |
| `movement-type-badge.tsx` | Badge con tipo SAP (101, 201) | Movimientos |
| `position-selector.tsx` | Selector de posición (rack, fila, col) | Formas operativas |
| `product-search.tsx` | Buscador de producto con autocompletado | Formas operativas |
| `document-drawer.tsx` | Drawer lateral con detalle de documento | Todas las tablas |
| `operation-form-modal.tsx` | Modal para crear nueva operación | Todas las operaciones |
| `kpi-card.tsx` | Card de KPI con animación | Dashboard |
| `activity-chart.tsx` | Gráfica de actividad (Recharts) | Dashboard |
| `toast-notification.tsx` | Toast animado de operación | Global |
| `lot-list.tsx` | Lista de lotes con alertas de vencimiento | Tab Lotes |
| `lot-detail.tsx` | Ficha de lote con historial y características | Tab Lotes |
| `lot-alerts.tsx` | Alertas agrupadas por severidad | Tab Lotes |
| `strategy-config.tsx` | Configuración de estrategias por almacén | Config Almacén |
| `ai-insights-widget.tsx` | Widget de insights proactivos | Dashboard |
| `ai-analysis-tab.tsx` | Tab completo de Análisis IA | Tab IA |
| `ai-report-card.tsx` | Card clickable de reporte rápido | Tab IA |

---

## 3.9 Archivo de Rutas

```
src/app/(platform)/almacenes/
├── page.tsx                    → Punto de entrada con tabs
├── layout.tsx                  → Layout con header y warehouse selector
└── [id]/
    └── page.tsx                → Vista detallada de 1 almacén + 3D
```

La navegación de tabs se maneja por estado en el componente principal, no por rutas separadas, para evitar recargas y mantener el selector de almacén en contexto.

---

## 3.10 Archivos Frontend Nuevos

```
src/features/almacenes/
├── components/
│   ├── almacenes-content.tsx        ← REESCRIBIR (contenedor principal con tabs)
│   ├── warehouse-selector.tsx       ← NUEVO
│   ├── wms-dashboard.tsx            ← NUEVO
│   ├── operations-tab.tsx           ← NUEVO (contenedor de sub-tabs)
│   │
│   │ ── Operaciones ──
│   ├── goods-receipt-list.tsx       ← NUEVO
│   ├── goods-receipt-form.tsx       ← NUEVO (modal/drawer crear GR)
│   ├── goods-receipt-detail.tsx     ← NUEVO (drawer detalle)
│   ├── goods-issue-list.tsx         ← NUEVO
│   ├── goods-issue-form.tsx         ← NUEVO
│   ├── goods-issue-detail.tsx       ← NUEVO
│   ├── picking-list.tsx             ← NUEVO (vista de picking con ruta)
│   ├── transfer-list.tsx            ← NUEVO
│   ├── transfer-form.tsx            ← NUEVO
│   ├── transfer-detail.tsx          ← NUEVO
│   ├── count-list.tsx               ← NUEVO
│   ├── count-form.tsx               ← NUEVO
│   ├── count-execution.tsx          ← NUEVO (vista de ejecución del conteo)
│   ├── count-variance.tsx           ← NUEVO (análisis de varianzas)
│   │
│   │ ── Inventario y Stock ──
│   ├── inventory-tab.tsx            ← NUEVO (stock actual)
│   ├── movements-tab.tsx            ← NUEVO (historial)
│   │
│   │ ── Lotes ──
│   ├── lot-list.tsx                 ← NUEVO (lista con alertas)
│   ├── lot-detail.tsx               ← NUEVO (ficha completa del lote)
│   ├── lot-alerts.tsx               ← NUEVO (alertas por severidad)
│   │
│   │ ── Estrategias ──
│   ├── strategy-config.tsx          ← NUEVO (config por almacén)
│   ├── putaway-suggestion.tsx       ← NUEVO (panel de sugerencia de ubicación)
│   ├── picking-strategy-selector.tsx← NUEVO (FIFO/FEFO/consolidación)
│   │
│   │ ── IA ──
│   ├── ai-insights-widget.tsx       ← NUEVO (widget en dashboard)
│   ├── ai-analysis-tab.tsx          ← NUEVO (tab completo de IA)
│   ├── ai-report-card.tsx           ← NUEVO (card de reporte clickable)
│   ├── ai-lot-alerts.tsx            ← NUEVO (alertas IA para lotes)
│   │
│   │ ── Shared UI ──
│   ├── position-selector.tsx        ← NUEVO
│   ├── document-status-badge.tsx    ← NUEVO
│   ├── process-badge.tsx            ← NUEVO (badge de proceso vs número)
│   ├── kpi-card.tsx                 ← NUEVO
│   ├── activity-chart.tsx           ← NUEVO
│   │
│   │ ── Existentes ──
│   ├── warehouses-content.tsx       ← MANTENER (cards de almacenes)
│   ├── warehouse-3d.tsx             ← REDISEÑAR
│   ├── warehouse-3d-hud.tsx         ← ACTUALIZAR
│   ├── warehouse-3d-overlays.tsx    ← ACTUALIZAR
│   ├── warehouse-detail.tsx         ← ACTUALIZAR
│   ├── box-detail-drawer.tsx        ← MANTENER
│   ├── product-locator.tsx          ← MANTENER
│   ├── rack-panel.tsx               ← MANTENER
│   └── warehouse-search.tsx         ← MANTENER
│
├── actions/
│   ├── goods-receipt-actions.ts     ← NUEVO
│   ├── goods-issue-actions.ts       ← NUEVO
│   ├── transfer-actions.ts          ← NUEVO
│   ├── count-actions.ts             ← NUEVO
│   ├── inventory-actions.ts         ← NUEVO
│   ├── dashboard-actions.ts         ← NUEVO
│   ├── lot-actions.ts               ← NUEVO (gestión de lotes)
│   ├── strategy-actions.ts          ← NUEVO (leer/guardar estrategias)
│   ├── ai-warehouse-context.ts      ← EXPANDIR (context enrichment WMS)
│   ├── ai-insights-action.ts        ← NUEVO (generación de insights)
│   ├── ai-reports-action.ts         ← NUEVO (reportes bajo demanda)
│   └── (existentes se mantienen)
│
├── hooks/
│   ├── use-warehouse-context.ts     ← NUEVO
│   ├── use-wms-realtime.ts          ← NUEVO
│   ├── use-document-number.ts       ← NUEVO
│   ├── use-lot-alerts.ts            ← NUEVO (polling alertas lotes)
│   └── use-wms-insights.ts          ← NUEVO (polling/refresh insights IA)
│
└── types.ts                         ← EXPANDIR (+ lot, strategy, insight types)
```
