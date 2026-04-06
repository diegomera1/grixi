# 16 — Inteligencia Artificial WMS

## 16.1 Visión

GRIXI AI no es un chatbot decorativo — es un **Copilot de Almacén** que razona sobre data operativa en tiempo real. Integrado con el motor de IA existente (Gemini 2.0 Flash Lite + prompt enrichment + rich outputs), el módulo WMS inyecta contexto profundo para que la IA pueda:

1. **Analizar** — KPIs, tendencias, anomalías, comparaciones
2. **Informar** — Generar reportes visuales con gráficas interactivas
3. **Recomendar** — Sugerir acciones operativas inteligentes
4. **Predecir** — Anticipar stock-outs, demanda, optimizar rutas
5. **Asistir** — Guiar al operador en procesos complejos

---

## 16.2 Arquitectura de Integración IA + WMS

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GRIXI AI + WMS                               │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────────┐    ┌───────────────┐  │
│  │ AI Widget / │    │   buildSystemPrompt   │    │   Gemini      │  │
│  │ AI Canvas   │───▶│   + WMS Context       │───▶│   2.0 Flash   │  │
│  │ (Frontend)  │    │   Enrichment          │    │   Lite        │  │
│  └─────────────┘    └──────────┬───────────┘    └───────┬───────┘  │
│                                │                         │          │
│                     ┌──────────▼───────────┐    ┌───────▼───────┐  │
│                     │  WMS Data Queries    │    │  Rich Output  │  │
│                     │  (Server Actions)    │    │  <!--CHART:--> │  │
│                     │                      │    │  <!--IMAGE:--> │  │
│                     │  • KPIs del día      │    │  Tables, etc. │  │
│                     │  • Stock por producto │    └───────────────┘  │
│                     │  • Alertas activas   │                        │
│                     │  • Movimientos 7d    │                        │
│                     │  • Lotes por vencer  │                        │
│                     │  • Ocupación racks   │                        │
│                     │  • Top operaciones   │                        │
│                     └──────────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 16.3 Prompt Enrichment: Contexto WMS

Cuando el módulo `almacenes` está seleccionado en el AI widget, se inyecta este contexto enriquecido:

```typescript
// features/almacenes/actions/ai-warehouse-context.ts
'use server'

export async function buildWMSContext(orgId: string, warehouseId?: string) {
  const supabase = await createServerClient();
  
  // 1. KPIs Globales de Almacenes
  const { data: warehouseStats } = await supabase.rpc('wms_get_dashboard_kpis', {
    p_org_id: orgId,
    p_warehouse_id: warehouseId || null
  });

  // 2. Movimientos recientes (últimas 24h)
  const { data: recentMovements } = await supabase
    .from('inventory_movements')
    .select('*, products(name, sku)')
    .eq('org_id', orgId)
    .gte('created_at', new Date(Date.now() - 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  // 3. Alertas activas
  const { data: expiringLots } = await supabase
    .from('lot_tracking')
    .select('*, products(name)')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .lte('expiry_date', new Date(Date.now() + 30 * 86400000).toISOString())
    .order('expiry_date', { ascending: true });

  // 4. Stock bajo mínimo
  const { data: lowStock } = await supabase.rpc('wms_get_low_stock_products', {
    p_org_id: orgId
  });

  // 5. Ocupación por almacén
  const { data: occupancy } = await supabase.rpc('wms_get_warehouse_occupancy', {
    p_org_id: orgId
  });

  // 6. Operaciones pendientes
  const { data: pendingOps } = await supabase.rpc('wms_get_pending_operations', {
    p_org_id: orgId
  });

  // 7. Tendencias de movimiento (7 días)
  const { data: trends } = await supabase.rpc('wms_get_movement_trends', {
    p_org_id: orgId,
    p_days: 7
  });

  // 8. Estrategias activas
  const { data: strategies } = await supabase
    .from('warehouse_strategies')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true);

  return `
## Datos de Almacenes en Tiempo Real

### KPIs Actuales
- Posiciones totales: ${warehouseStats?.total_positions}
- Ocupación general: ${warehouseStats?.occupancy_pct}%
- Valor del stock: $${warehouseStats?.stock_value?.toLocaleString()}
- Movimientos hoy: ${warehouseStats?.movements_today}
  - Entradas: ${warehouseStats?.entries_today}
  - Salidas: ${warehouseStats?.exits_today}
  - Traspasos: ${warehouseStats?.transfers_today}

### Ocupación por Almacén
${occupancy?.map((w: any) => 
  `- ${w.name}: ${w.occupancy_pct}% (${w.occupied}/${w.total}) ${
    w.occupancy_pct > 90 ? '🔴 CRÍTICO' : 
    w.occupancy_pct > 70 ? '🟡 ALTO' : '🟢 ÓPTIMO'
  }`
).join('\n')}

### Alertas Activas
${expiringLots?.length ? expiringLots.map((l: any) => 
  `- ⚠️ Lote ${l.lot_number} (${l.products?.name}) vence el ${l.expiry_date}`
).join('\n') : '- No hay lotes próximos a vencer'}
${lowStock?.length ? lowStock.map((p: any) => 
  `- ⚠️ Stock bajo: ${p.product_name} — ${p.current_qty} UN (mínimo: ${p.min_qty})`
).join('\n') : ''}

### Operaciones Pendientes
- Entradas pendientes: ${pendingOps?.pending_receipts || 0}
- Salidas en picking: ${pendingOps?.picking_issues || 0}
- Traspasos pendientes: ${pendingOps?.pending_transfers || 0}
- OCs por recibir: ${pendingOps?.pending_pos || 0}
- Pedidos de venta pendientes: ${pendingOps?.pending_sos || 0}

### Movimientos Últimos 7 Días
${trends?.map((d: any) => 
  `- ${d.day}: ${d.entries} entradas, ${d.exits} salidas, ${d.transfers} traspasos`
).join('\n')}

### Últimos 10 Movimientos
${recentMovements?.slice(0, 10).map((m: any) => 
  `- ${m.sap_movement_type} | ${m.products?.name} | ${m.quantity} UN | ${m.created_at}`
).join('\n')}

### Estrategias Activas
${strategies?.map((s: any) => 
  `- ${s.strategy_type}: ${s.strategy_code}`
).join('\n')}
`;
}
```

---

## 16.4 Capacidades IA por Funcionalidad

### A) Análisis Inteligente de Inventario

**Lo que el usuario puede preguntar:**
```
"¿Cuáles son los productos con mayor rotación este mes?"
"¿Qué almacén tiene la ocupación más alta?"
"Muéstrame la tendencia de entradas vs salidas de la última semana"
"¿Cuántos lotes están por vencer en los próximos 30 días?"
"¿Cuál es el valor total del inventario por almacén?"
```

**Lo que GRIXI AI responde:**
- Texto analítico con contexto y recomendaciones
- Gráfica interactiva Recharts embebida (via `<!--CHART:...-->`)
- Tabla de datos formateada
- Insight de optimización

**Ejemplo de Interaction:**

```
User: ¿Cómo está la ocupación de los almacenes?

GRIXI AI: 📊 **Análisis de Ocupación — Abril 2026**

Actualmente tenemos **5 almacenes activos** con la siguiente distribución:

<!--CHART:{"type":"bar","title":"Ocupación por Almacén (%)","data":[
  {"name":"Almacén Central","ocupación":82,"color":"#10B981"},
  {"name":"Prod. Terminados","ocupación":92,"color":"#EF4444"},
  {"name":"Materia Prima","ocupación":65,"color":"#10B981"},
  {"name":"Centro Logístico","ocupación":71,"color":"#F59E0B"},
  {"name":"Cámara Fría","ocupación":58,"color":"#10B981"}
],"xKey":"name","yKeys":[{"key":"ocupación","label":"Ocupación %","color":"#7C3AED"}]}-->

**⚠️ Alerta:** El almacén de **Productos Terminados** está al **92%** — nivel crítico.
Recomiendo programar un traspaso de materiales de baja rotación al Centro Logístico 
Norte, que tiene capacidad disponible (71%).

**Acciones sugeridas:**
1. Crear traspaso de consolidación PT → CLN
2. Revisar 3 lotes de producto terminado con baja rotación (LOT-20260210...)
3. Evaluar si hay OCs pendientes que agravarán la situación
```

---

### B) Generación de Reportes

**Reportes que GRIXI AI genera bajo demanda:**

| Reporte | Disparador | Contenido | Formato |
|---------|-----------|-----------|---------|
| **Informe de Movimientos** | "Dame el reporte de movimientos de hoy" | Tabla con todos los movimientos agrupados por tipo | Tabla Markdown + Chart |
| **Análisis ABC** | "Haz el análisis ABC de productos" | Clasificación A (80% valor) / B (15%) / C (5%) | Chart pie + Tabla |
| **KPI Semanal** | "Informe semanal del almacén" | Resumen ejecutivo con tendencias | Multi-chart + resumen |
| **Trazabilidad** | "Trazabilidad del lote LOT-20260401-042" | Historial completo del lote desde entrada hasta actual | Timeline + Tabla |
| **Valorización** | "Cuál es el valor del inventario por categoría" | Breakdown por categoría de producto con valores | Chart + Tabla |
| **Eficiencia** | "Análisis de eficiencia operativa" | Tiempos de dock-to-stock, precisión, productividad | Multi-KPI + Chart |

**Ejemplo: Reporte ABC**

```
User: Hazme el análisis ABC de productos del Almacén Central

GRIXI AI: 📊 **Análisis ABC — Almacén Central**

Basándome en los movimientos de los últimos 30 días, clasifiqué los 60 productos:

<!--CHART:{"type":"pie","title":"Distribución ABC (por valor de movimiento)","data":[
  {"name":"Clase A (12 productos)","value":78.5,"color":"#EF4444"},
  {"name":"Clase B (18 productos)","value":15.2,"color":"#F59E0B"},
  {"name":"Clase C (30 productos)","value":6.3,"color":"#3B82F6"}
],"xKey":"name","yKeys":[{"key":"value","label":"% Valor"}]}-->

### Clase A — Alta Rotación (12 productos, 78.5% del valor)
| # | Producto | Movimientos | Valor | Recomendación |
|---|----------|------------|-------|---------------|
| 1 | Motor Eléctrico 5HP | 287 | $51,660 | **Posición fija** en zona de despacho |
| 2 | Bomba Rexroth A10V | 215 | $96,750 | **Posición fija** nivel 1 |
| ... | ... | ... | ... | ... |

💡 **Recomendación:** Considerar un traspaso de reslotting para mover los productos 
Clase A a las posiciones más cercanas al dock de despacho (Pasillo A, niveles 1-2).
¿Quieres que genere las órdenes de traspaso automáticamente?
```

---

### C) Recomendaciones Proactivas

GRIXI AI puede generar recomendaciones sin que el usuario pregunte, insertándolas en el dashboard o como notificaciones:

```typescript
// Server Action que genera insights proactivos
async function generateWMSInsights(orgId: string): Promise<WMSInsight[]> {
  const insights: WMSInsight[] = [];

  // 1. Detectar desbalance de ocupación
  const occupancy = await getOccupancyByWarehouse(orgId);
  const critical = occupancy.filter(w => w.pct > 90);
  const available = occupancy.filter(w => w.pct < 60);
  
  if (critical.length > 0 && available.length > 0) {
    insights.push({
      type: 'optimization',
      severity: 'high',
      title: 'Desbalance de ocupación detectado',
      message: `${critical[0].name} está al ${critical[0].pct}% mientras que ${available[0].name} tiene solo ${available[0].pct}%. Se recomienda un traspaso de balanceo.`,
      action: { type: 'create_transfer', from: critical[0].id, to: available[0].id }
    });
  }

  // 2. Detectar productos sin movimiento (dead stock)
  const deadStock = await getDeadStock(orgId, 60); // > 60 días sin mover
  if (deadStock.length > 0) {
    insights.push({
      type: 'warning',
      severity: 'medium',
      title: `${deadStock.length} productos sin movimiento en 60+ días`,
      message: `Estos productos están ocupando ${deadStock.length} posiciones sin rotación. Considere devolución al proveedor o descuento para venta rápida.`,
      action: { type: 'view_dead_stock', products: deadStock }
    });
  }

  // 3. Predecir stock-out basado en consumo promedio
  const riskProducts = await predictStockOut(orgId, 14); // 14 días
  if (riskProducts.length > 0) {
    insights.push({
      type: 'prediction',
      severity: 'high',
      title: `${riskProducts.length} productos con riesgo de desabasto en 14 días`,
      message: `Basándome en el consumo promedio, estos productos se agotarán pronto. Recomiendo crear solicitudes de compra.`,
      action: { type: 'create_purchase_req', products: riskProducts }
    });
  }

  // 4. Sugerir reslotting por ABC
  const abcChanges = await detectABCChanges(orgId);
  if (abcChanges.length > 0) {
    insights.push({
      type: 'optimization',
      severity: 'low',
      title: 'Reclasificación ABC sugerida',
      message: `${abcChanges.length} productos cambiaron de clasificación ABC. Un reslotting mejoraría la eficiencia de picking.`,
      action: { type: 'suggest_reslotting', changes: abcChanges }
    });
  }

  return insights;
}
```

### Widget de Insights en Dashboard

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
│  │ Traspasar 45 posiciones ahorraría $2,100/mes en            │   │
│  │ costos de almacenamiento                                   │   │
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
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### D) Asistencia Operativa

La IA puede guiar al operador durante procesos:

```
User: Tengo que recibir 200 unidades de aceite hidráulico del proveedor QuimiTech

GRIXI AI: Perfecto, te guío en el proceso:

**📥 Entrada de Mercancía — Aceite Hidráulico SAE 68**

1. Tienes **1 OC pendiente** de QuimiTech:
   - **PO-2026-0096** | 200 L Aceite Hidráulico | $3,800.00
   - Esperada para hoy (02/04/2026) ✅

2. **Ubicación sugerida** (estrategia: Zona por Categoría):
   - Zona de Hidráulicos: Pasillo C
   - Posición recomendada: **C03-2-1** (libre, nivel bajo, mismo pasillo que stock actual)

3. **Alerta de lote:** Este producto requiere:
   - ☑ Registro de lote obligatorio
   - ☑ Fecha de vencimiento
   - ⚠️ Clase peligrosa 3 (inflamable) — asegúrate de no almacenar junto a eléctricos

¿Quieres que te lleve directamente al formulario de entrada con PO-2026-0096 pre-seleccionada?
[Ir a Entrada de Mercancía →]
```

---

### E) Predicción de Demanda

```
User: ¿Cuándo se nos va a acabar el stock de rodamientos SKF?

GRIXI AI: 📊 **Proyección de Stock — Rodamiento SKF 6205**

<!--CHART:{"type":"area","title":"Proyección de Stock (30 días)","data":[
  {"día":"01/04","real":205,"proyectado":205},
  {"día":"05/04","real":null,"proyectado":180},
  {"día":"10/04","real":null,"proyectado":148},
  {"día":"15/04","real":null,"proyectado":115},
  {"día":"20/04","real":null,"proyectado":82},
  {"día":"25/04","real":null,"proyectado":50},
  {"día":"30/04","real":null,"proyectado":17}
],"xKey":"día","yKeys":[
  {"key":"real","label":"Stock Real","color":"#10B981"},
  {"key":"proyectado","label":"Proyección","color":"#F59E0B"}
]}-->

**Análisis:**
- Stock actual: **205 UN**
- Consumo promedio: **8.5 UN/día** (basado en últimos 30 días)
- Punto de reorden sugerido: **85 UN** (10 días de stock de seguridad)
- **Fecha estimada de stock-out: ~30 de abril 2026**
- **Fecha recomendada de reorden: ~12 de abril** (considerando lead time de 7 días del proveedor MetalTech)

💡 Lead time usual de MetalTech: 5-7 días
📋 Última OC: PO-2026-0089 (precio: $18.50/UN)

¿Quieres que genere una solicitud de compra para 200 UN?
```

---

## 16.5 Tab IA en el Módulo Almacenes

Agregar una sección dedicada de IA dentro del módulo:

```
Almacenes
├── Dashboard          → Con widget de AI Insights integrado
├── Almacenes
├── Operaciones
├── Inventario
├── Movimientos
├── Lotes              → NUEVO
├── Análisis IA 🤖     → NUEVO
│   ├── Insights Automáticos (proactivos)
│   ├── Análisis ABC
│   ├── Proyecciones de Stock
│   ├── Eficiencia Operativa
│   └── Chat Contextual (GRIXI AI con contexto WMS)
└── 3D
```

### UI: Tab Análisis IA

```
┌─ Análisis IA 🤖 ────────────────────────────────────────────────┐
│                                                                   │
│  ┌─ Insights Automáticos ────────────────────────────────────┐   │
│  │ (generados cada 15 min o on-demand)                       │   │
│  │                                                            │   │
│  │ 🔴 2 alertas de alta prioridad                            │   │
│  │ 🟡 3 oportunidades de optimización                        │   │
│  │ 🔵 1 insight informativo                                  │   │
│  │                                                            │   │
│  │ [Regenerar Análisis]           Último: hace 12 min        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Reportes Rápidos ───────────────────────────────────────┐    │
│  │                                                            │   │
│  │ [📊 ABC]  [📈 Tendencias]  [📋 KPI Semanal]  [🔍 Stock]  │   │
│  │ [💰 Valorización]  [⏱️ Eficiencia]  [📦 Dead Stock]      │   │
│  │                                                            │   │
│  │ Click = Genera el reporte via IA con charts interactivos  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Chat GRIXI AI (contexto: Almacenes) ─────────────────────┐  │
│  │                                                             │  │
│  │ 🤖 GRIXI AI: ¿En qué puedo ayudarte con los almacenes?   │  │
│  │                                                             │  │
│  │ Sugerencias:                                                │  │
│  │ • "Analiza la ocupación de los almacenes"                  │  │
│  │ • "¿Cuáles productos tienen mayor rotación?"               │  │
│  │ • "Genera el informe semanal de movimientos"               │  │
│  │ • "¿Cuándo debo reordenar rodamientos SKF?"                │  │
│  │ • "Trazabilidad del lote LOT-20260401-042"                 │  │
│  │                                                             │  │
│  │ [___________________________________] [Enviar]             │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 16.6 RPCs de Soporte para IA

| Función | Retorna | Uso IA |
|---------|---------|--------|
| `wms_get_abc_analysis` | Productos clasificados A/B/C con métricas | Reporte ABC |
| `wms_get_stock_projection` | Proyección de stock por producto (días) | Predicción stock-out |
| `wms_get_dead_stock` | Productos sin movimiento en N días | Optimización de espacio |
| `wms_get_efficiency_metrics` | Dock-to-stock, picking time, accuracy | Reporte eficiencia |
| `wms_get_lot_expiry_report` | Lotes por vencer agrupados por urgencia | Alertas de calidad |
| `wms_get_movement_trends` | Tendencias diarias/semanales por tipo | Gráficas de tendencia |
| `wms_get_warehouse_utilization` | Timeline de ocupación (30 días) | Análisis de capacidad |
| `wms_get_vendor_performance` | On-time delivery, qty accuracy por vendor | Evaluación proveedores |

---

## 16.7 Prompt del Sistema (WMS-Specific)

```markdown
## Contexto de Almacenes (WMS)

Eres el asistente de almacenes de GRIXI. Tienes acceso a datos en tiempo real del 
sistema WMS. Tu conocimiento incluye:

- Procesos SAP IM: movimientos 101, 102, 201, 261, 301, 311, 501, 502
- Estrategias de almacenamiento: FIFO, FEFO, LIFO, zona por categoría, peso/volumen
- Gestión de lotes con características especiales (temperatura, peligrosidad, etc.)
- 5 almacenes con diferentes configuraciones
- 60+ productos industriales en 7 categorías

Cuando analices datos:
1. Siempre cita números específicos del contexto inyectado
2. Usa gráficas interactivas (<!--CHART:json-->) cuando sea útil 
3. Sé proactivo: sugiere acciones concretas, no solo información
4. Si detectas anomalías o riesgos, menciónalos inmediatamente
5. Para reportes, formatea con tablas limpias y KPIs destacados
6. Al recomendar traspasos, especifica posiciones exactas (ej: A01-3-2)
7. Al predecir, muestra el razonamiento y las variables usadas

Tu meta es ser el "cerebro analítico" del almacén — información que antes 
requería un analista ahora la generas en segundos.
```

---

## 16.8 Archivos Frontend para IA WMS

```
src/features/almacenes/
├── components/
│   ├── ai-insights-widget.tsx      ← Insights proactivos en Dashboard
│   ├── ai-analysis-tab.tsx         ← Tab completo de Análisis IA
│   ├── ai-report-card.tsx          ← Card de reporte rápido clickable
│   └── ai-lot-alerts.tsx           ← Alertas IA para lotes
├── actions/
│   ├── ai-warehouse-context.ts     ← EXPANDIR (context enrichment WMS)
│   ├── ai-insights-action.ts       ← NUEVO (generación de insights)
│   └── ai-reports-action.ts        ← NUEVO (reportes bajo demanda)
└── hooks/
    └── use-wms-insights.ts         ← NUEVO (polling/refresh insights)
```
