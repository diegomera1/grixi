# 01 — Visión General y Arquitectura WMS

## 1.1 Contexto de Negocio

### ¿Qué es SAP IM?
SAP Inventory Management (IM) es el submódulo de SAP MM que gestiona las cantidades y valores de materiales en los almacenes. Cuando una empresa utiliza SAP **sin** el módulo WMS (Extended Warehouse Management), toda la gestión interna del almacén — ubicaciones exactas, slotting, optimización de picking — queda fuera de SAP.

**Ahí entra GRIXI:** actúa como el WMS que complementa a SAP IM, gestionando:
- Las ubicaciones exactas (rack, fila, columna) de cada material
- El movimiento físico de mercancía dentro del almacén
- La visibilidad 3D del estado de la bodega
- La optimización de rutas de picking y putaway

### Flujo de Integración SAP ↔ GRIXI

```
┌─────────────────────────────────────────────────────────┐
│                        SAP ECC/S4                        │
│                                                          │
│  Compras (MM)    Ventas (SD)    Contabilidad (FI-CO)     │
│     │                │                │                  │
│     ▼                ▼                ▼                  │
│  Orden de         Pedido de      Documento                │
│  Compra (PO)      Venta (SO)     Contable                │
│     │                │                ▲                  │
└─────┼────────────────┼────────────────┼──────────────────┘
      │                │                │
      ▼                ▼                │
┌─────────────────────────────────────────────────────────┐
│                     GRIXI WMS                            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Entrada  │  │ Salida   │  │Traspasos │  │ Conteo  │ │
│  │ Mercancía│  │ Mercancía│  │  Internos│  │ Cíclico │ │
│  │  (GR)    │  │  (GI)    │  │  (TP)    │  │  (PI)   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│       ▼              ▼              ▼              ▼      │
│  ┌──────────────────────────────────────────────────────┐│
│  │          Motor de Movimientos de Inventario          ││
│  │        (inventory_movements + rack_positions)         ││
│  └──────────────────────────────────────────────────────┘│
│       │                                                   │
│       ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │              3D Digital Twin View                     ││
│  │         (Actualización en tiempo real)                ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 1.2 Procesos de Movimiento de Inventario

En GRIXI, los movimientos no son simples códigos numéricos — son **procesos de negocio completos** con flujos, validaciones, estrategias y trazabilidad. Cada proceso tiene un equivalente SAP pero se ejecuta como un workflow guiado.

### Procesos Principales

| Proceso | Cod. SAP | Descripción del Proceso | Estrategia Asociada | Impacto |
|---------|----------|------------------------|--------------------|---------|
| **Recepción de Mercancía** | 101 | Flujo guiado: OC → Verificación → Putaway → Contabilización. Incluye inspección de calidad, asignación de lote y ubicación inteligente | Putaway (zona, peso, fijo) | Stock ↑ |
| **Anulación de Recepción** | 102 | Proceso de reversa controlada: deshace GR, libera posiciones, reversa movimientos | — | Stock ↓ |
| **Consumo Interno** | 201 | Flujo de salida por centro de costo con aprobación y localización automática | Picking (FIFO/FEFO) | Stock ↓ |
| **Despacho por Pedido** | 261 | Flujo completo: SO → Picking List → Ruta Optimizada → Confirmación → Contabilización | Picking (FIFO/FEFO) + Ruta | Stock ↓ |
| **Traspaso Interno** | 311 | Movimiento entre posiciones del mismo almacén. Usado para reslotting, consolidación, reposición | Transferencia | Stock = |
| **Traspaso entre Plantas** | 301/302 | Movimiento entre almacenes con tránsito. Genera salida (301) + entrada (302) | Transferencia + Putaway | Stock = |
| **Entrada sin Referencia** | 501 | Ajuste positivo por conteo físico, inventario inicial o hallazgo | Putaway | Stock ↑ |
| **Ajuste Negativo** | 502 | Ajuste por diferencia en conteo, merma o scrap | — | Stock ↓ |

### Cada Proceso Incluye:

```
┌─ PROCESO WMS ─────────────────────────────────────────────┐
│                                                            │
│  📋 Documento ─── Generación automática de número (#)     │
│  🔍 Validación ── Verificación de stock, permisos, lotes  │
│  🧠 Estrategia ── Algoritmo de ubicación/consumo (FIFO..) │
│  🔔 Notificación ─ Toast premium + actualizaciones 3D     │
│  📊 Registro ──── Audit trail + inventory_movements       │
│  🤖 IA ────────── Insights proactivos post-operación      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 1.3 Propuesta de Valor para el Cliente

### ¿Por qué GRIXI WMS es diferente?

| Característica | WMS Tradicional | GRIXI WMS |
|---------------|----------------|-----------|
| Visualización | Tablas y reportes 2D | **Gemelo Digital 3D** con navegación inmersiva |
| Integración SAP | Configuración pesada | **Simulación inteligente** con data pre-cargada |
| Dashboard | Reportes estáticos | **KPIs en tiempo real** con animaciones |
| Experiencia | Interface técnica | **UI premium** enterprise-grade |
| Inteligencia | Análisis manual | **IA integrada** — análisis, predicción, reportes automáticos |
| Estrategias | Configuración fija | **Algoritmos adaptativos** — FIFO, FEFO, ABC, zona, peso |
| Lotes | Tracking básico | **Control de características** — temp., peligrosidad, cert. |
| Notificaciones | Email básico | **Alertas in-app** con toasts animados |
| Conteo | Procesos manuales | **Conteo guiado** con validación visual |

### Elementos WOW para la Demo

1. **3D en tiempo real:** Cuando se acepta una entrada de mercancía, la posición del rack cambia de color en el 3D instantáneamente
2. **IA Copilot:** El asistente analiza inventario, predice desabasto, genera reportes con gráficas interactivas y sugiere optimizaciones
3. **Estrategias inteligentes:** FIFO/FEFO automático, putaway por zona y peso, picking con ruta optimizada
4. **Pipeline visual:** Un pipeline tipo Kanban muestra el estado de cada operación en curso
5. **Simulación SAP:** La data llega como si viniera de SAP, con números de documento reales
6. **Flujo completo:** Desde la OC hasta el producto en su ubicación exacta, todo trazable
7. **Control de lotes:** Trazabilidad completa con alertas de vencimiento, cuarentena y características especiales
8. **Conteo guiado:** El operador recorre posiciones con validación visual y ajuste automático

---

## 1.4 Arquitectura Técnica

### Stack del Módulo

```
Frontend (Next.js 16 + React 19)
├── Pages: /almacenes → Sub-tabs WMS + Análisis IA
├── Components: features/almacenes/components/
├── Actions: features/almacenes/actions/ (Server Actions)
├── Hooks: features/almacenes/hooks/
├── Types: features/almacenes/types.ts
├── AI: Context enrichment + insights engine
└── 3D: React Three Fiber + drei

Backend (Supabase PostgreSQL 17.6)
├── Tables: warehouses, racks, rack_positions, inventory, lot_tracking, etc.
├── RPC Functions: wms_* prefix (operaciones + analytics)
├── RLS Policies: org_id based
├── Realtime: Suscripciones para 3D
├── Strategies: warehouse_strategies (putaway, picking, transfer)
└── AI Context: RPCs para enrichment (ABC, trends, projections)

IA (Gemini 2.0 Flash Lite)
├── Prompt Enrichment: buildWMSContext()
├── Rich Outputs: Charts, tables, images
├── Proactive Insights: generateWMSInsights()
└── Predictive: Stock-out forecasting, ABC reclassification
```

### Flujo de Datos por Operación

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  UI Form    │────▶│ Server Action │────▶│  Supabase RPC │
│  (Client)   │     │  (Validate)  │     │  (Transaction)│
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                    ┌─────────────────────────────┤
                    │                             │
              ┌─────▼──────┐              ┌──────▼───────┐
              │ inventory  │              │   rack_      │
              │ _movements │              │   positions  │
              └────────────┘              └──────────────┘
                    │                             │
                    └─────────────┬───────────────┘
                                  │
                          ┌───────▼────────┐
                          │   Realtime     │
                          │   Broadcast    │
                          └───────┬────────┘
                                  │
                          ┌───────▼────────┐
                          │   3D Scene     │
                          │   Update       │
                          └────────────────┘
```

---

## 1.5 Principios de Diseño

1. **Procesos, no transacciones:** Cada movimiento es un flujo de negocio completo con validaciones, estrategias y notificaciones — no un simple registro en una tabla
2. **Todo es trazable:** Cada movimiento genera un registro en `inventory_movements` con referencia al documento origen
3. **Inteligencia embedded:** La IA no es un add-on — está integrada en cada proceso (sugerir ubicación, detectar anomalías, generar insights)
4. **Estrategias configurables:** Cada almacén puede tener sus propias reglas de putaway, picking y transfer (por defecto FIFO)
5. **Control de lotes:** Trazabilidad completa con características especiales (temperatura, peligrosidad, certificaciones)
6. **Transaccional:** Las operaciones que afectan múltiples tablas se ejecutan en una sola transacción SQL (RPC)
7. **Optimistic UI:** La UI se actualiza inmediatamente, revierte si falla
8. **Mobile-ready:** Las interfaces operativas (entrada, conteo) deben funcionar en tablet
9. **SAP-like numeración:** Documentos con prefijo y secuencia (GR-2026-0001, GI-2026-0001)
10. **Audit trail completo:** Quién hizo qué, cuándo, desde dónde
