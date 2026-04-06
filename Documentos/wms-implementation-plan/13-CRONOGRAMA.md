# 13 — Cronograma de Ejecución

## 13.1 Timeline General

> **Deadline:** Martes 7 de abril 2026
> **Días disponibles:** Miércoles 2, Jueves 3, ~~Viernes 4 (feriado)~~, Sábado 5, Domingo 6, Lunes 7
> **Días efectivos:** 5 días (miérc → lunes)

---

## 13.2 Sprints por Día

### 🟢 Día 1 — Miércoles 2 abril: FUNDACIONES

**Objetivo:** Base de datos lista + estructura frontend montada

| Hora | Tarea | Archivos | Duración |
|------|-------|----------|----------|
| 09:00 | Revisar plan completo con Calixto | MDs | 1h |
| 10:00 | Migración SQL: tablas nuevas | Supabase migrations | 1.5h |
| 11:30 | Migración SQL: alteraciones a tablas existentes | Supabase migrations | 1h |
| 12:30 | RPC functions: `wms_post_goods_receipt` | Supabase functions | 1.5h |
| 14:00 | RPC functions: `wms_post_goods_issue`, `wms_post_transfer` | Supabase functions | 2h |
| 16:00 | RLS policies para todas las tablas nuevas | Supabase policies | 1h |
| 17:00 | Seed data: sales_orders, ajuste OCs, movimientos | SQL scripts | 1.5h |
| 18:30 | Frontend: Tipos (`types.ts`) + estructura de archivos | TypeScript | 1h |
| 19:30 | Frontend: `almacenes-content.tsx` con nuevo sistema de tabs | TSX | 1.5h |
| 21:00 | Frontend: `warehouse-selector.tsx` global | TSX | 1h |

**Entregable Día 1:** DB lista, tabs navegables, selector funcional

---

### 🔵 Día 2 — Jueves 3 abril: DASHBOARD + ENTRADAS

**Objetivo:** Dashboard WMS funcional + flujo de Goods Receipt completo

| Hora | Tarea | Archivos | Duración |
|------|-------|----------|----------|
| 09:00 | Dashboard: `wms-dashboard.tsx` — Hero KPIs | TSX | 1.5h |
| 10:30 | Dashboard: `dashboard-actions.ts` — Server Action + RPC | TS | 1h |
| 11:30 | Dashboard: Pipeline de operaciones + gráfica Recharts | TSX | 2h |
| 13:30 | Dashboard: Ocupación por almacén + alertas + activity feed | TSX | 1.5h |
| 15:00 | Entradas: `goods-receipt-list.tsx` | TSX | 1h |
| 16:00 | Entradas: `goods-receipt-form.tsx` — Paso 1 (seleccionar OC) | TSX | 1.5h |
| 17:30 | Entradas: `goods-receipt-form.tsx` — Paso 2 (verificar qty) | TSX | 1.5h |
| 19:00 | Entradas: `position-selector.tsx` + putaway | TSX | 1h |
| 20:00 | Entradas: `goods-receipt-actions.ts` — Server Action + posting | TS | 1.5h |
| 21:30 | Entradas: `goods-receipt-detail.tsx` — Drawer detalle | TSX | 1h |

**Entregable Día 2:** Dashboard con data real + Entrada de Mercancía end-to-end

---

### ~~🟡 Día 3 — Viernes 4 abril: FERIADO~~

---

### 🟣 Día 3 — Sábado 5 abril: SALIDAS + PEDIDOS DE VENTA

**Objetivo:** Flujo de Salida de Mercancía + Pedidos de Venta

| Hora | Tarea | Archivos | Duración |
|------|-------|----------|----------|
| 09:00 | Pedidos: Vista de lista de SO + KPIs | TSX | 1.5h |
| 10:30 | Pedidos: Drawer de detalle SO | TSX | 1h |
| 11:30 | Pedidos: Formulario nuevo SO (para demo) | TSX | 1.5h |
| 13:00 | Salidas: `goods-issue-list.tsx` | TSX | 1h |
| 14:00 | Salidas: `goods-issue-form.tsx` — Auto-localización FIFO | TSX | 2h |
| 16:00 | Salidas: Picking list visual | TSX | 1.5h |
| 17:30 | Salidas: `goods-issue-actions.ts` — Posting + actualizar SO | TS | 1.5h |
| 19:00 | Salidas: Notificación stock bajo + toast premium | TSX | 1h |
| 20:00 | Testing e2e: Crear SO → Crear GI → Picking → Post | Manual | 1.5h |

**Entregable Día 3:** Salidas completas, Pedidos de Venta funcionales

---

### 🟠 Día 4 — Domingo 6 abril: TRASPASOS + CONTEOS + 3D

**Objetivo:** Flujos restantes + mejoras 3D

| Hora | Tarea | Archivos | Duración |
|------|-------|----------|----------|
| 09:00 | Traspasos: `transfer-list.tsx` + `transfer-form.tsx` | TSX | 2h |
| 11:00 | Traspasos: `transfer-actions.ts` — Posting | TS | 1h |
| 12:00 | Lotes: `lot-tracking-list.tsx` + `lot-detail-drawer.tsx` | TSX | 1.5h |
| 13:30 | Lotes: Alertas de vencimiento + cuarentena | TSX | 1h |
| 14:30 | Estrategias: `warehouse-strategies-config.tsx` | TSX | 1.5h |
| 16:00 | Conteos: `count-list.tsx` + `count-form.tsx` (planificación) | TSX | 1.5h |
| 17:30 | Conteos: `count-execution.tsx` — vista checklist | TSX | 1.5h |
| 19:00 | 3D: Integración Realtime (`use-wms-realtime.ts`) | TSX | 1.5h |
| 20:30 | 3D: Overlay de operaciones activas + flash colors | TSX | 1.5h |
| 22:00 | Tab Inventario + Tab Movimientos (historial) | TSX | 1.5h |

**Entregable Día 4:** Todas las operaciones + lotes + estrategias + 3D mejorado

---

### 🔴 Día 5 — Lunes 7 abril: PULIDO + QA + DEMO PREP

**Objetivo:** Todo pulido, data perfecta, listo para demo

| Hora | Tarea | Archivos | Duración |
|------|-------|----------|----------|
| 09:00 | IA WMS: `ai-warehouse-context.ts` — Expandir enrichment | TS | 1h |
| 10:00 | IA WMS: `ai-insights-widget.tsx` en Dashboard | TSX | 1.5h |
| 11:30 | IA WMS: `ai-analysis-tab.tsx` con reportes y chat contextual | TSX | 1.5h |
| 13:00 | QA: Probar todos los flujos end-to-end | Manual | 2h |
| 15:00 | Fix bugs y edge cases encontrados | Mixed | 1.5h |
| 16:30 | Ajustar data demo para escenarios específicos | SQL | 1h |
| 17:30 | Pulir animaciones, transiciones y responsive | CSS/TSX | 1h |
| 18:30 | Preparar script de demo (guión paso a paso) | MD | 1h |
| 19:30 | Dry run completo de la demo | Manual | 1.5h |
| 21:00 | Últimos ajustes basados en dry run | Mixed | 1h |
| 22:00 | Deploy final a producción + verificar | Vercel | 30min |

**Entregable Día 5:** Demo 100% lista en producción con IA integrada

---

## 13.3 Riesgos y Mitigación

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Complejidad del 3D Realtime | Media | Simplificar a polling si Realtime falla |
| Bugs en RPCs transaccionales | Media | Testear cada RPC aislada antes de frontend |
| Data inconsistente | Baja | Script de limpieza + rebuild |
| Performance con mucha data | Baja | Paginación + lazy loading |
| IA context token bloat | Baja | Limitar queries a top 10 resultados |
| Falta de tiempo | Media | Priorizar: Dashboard › Entradas › Salidas › IA › 3D |

---

## 13.4 Prioridades (si no alcanza el tiempo)

**Must Have (P0):**
1. Dashboard WMS con KPIs + AI Insights widget
2. Entrada de Mercancía (Goods Receipt) completa con estrategia putaway
3. Salida de Mercancía con Pedido de Venta + picking FIFO
4. IA integrada: context enrichment del módulo Almacenes
5. Data demo alignada

**Should Have (P1):**
6. Traspasos internos
7. Control de lotes con alertas de vencimiento
8. Tab Análisis IA con reportes y chat contextual
9. Mejoras 3D básicas (colores by status)
10. Tab inventario y movimientos

**Nice to Have (P2):**
11. Conteo cíclico
12. Estrategias configurables por almacén (UI)
13. Insights proactivos de IA (predicción stock-out, ABC)
14. Animaciones 3D de movimiento
15. Traspasos entre almacenes
16. Reportes avanzados IA (eficiencia, utilización)

