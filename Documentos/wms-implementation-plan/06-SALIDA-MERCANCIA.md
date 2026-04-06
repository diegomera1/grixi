# 06 — Salida de Mercancía (Goods Issue)

## 6.1 Concepto

La Salida de Mercancía es el proceso de **despachar materiales** del almacén. Puede ser disparada por:
- **Pedido de Venta** (Sales Order) → Mov. tipo **261**
- **Centro de Costo** (consumo interno) → Mov. tipo **201**
- **Orden de Producción/Mantenimiento** → Mov. tipo **261**
- **Merma/Scrap** → Mov. tipo **551**

---

## 6.2 Flujo Completo (Disparado por Pedido de Venta)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE SALIDA DE MERCANCÍA                      │
│                                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │  PASO 1  │──▶│  PASO 2  │──▶│  PASO 3  │──▶│  PASO 4  │        │
│  │ Pedido de│   │ Crear    │   │ Picking  │   │ Confirmar│        │
│  │  Venta   │   │ Goods    │   │  List    │   │ & Contab.│        │
│  │          │   │ Issue    │   │          │   │          │        │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
│       │              │              │              │                │
│       ▼              ▼              ▼              ▼                │
│  SO ingresa     GI-2026-XXXX    Operador va    inv_movements      │
│  con items      referencia SO    posición por   rack_positions     │
│  y cantidades   items del SO     posición       inventory          │
│                 auto-localize                   SO.status→shipped  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6.3 Paso 1: Pedido de Venta Entrante

Los pedidos de venta llegan "de SAP" (simulados). El operador los ve en la lista:

```
┌─ Pedidos de Venta Pendientes ────────────────────────────────────┐
│                                                                  │
│  ┌─ Toolbar ─────────────────────────────────────────────────┐  │
│  │ [+ Crear Pedido Manual] [Filtros ▼] [🔍 Buscar...]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📦 SO-2026-0045          🔴 Urgente          📅 01/04     │  │
│  │ Cliente: Industrias del Pacífico S.A.                      │  │
│  │ SAP: 0080012345 | Entrega solicitada: 02/04/2026          │  │
│  │ Items: 3 materiales | Total: $8,750.00                    │  │
│  │ ┌──────────────────────────────────────────────────────┐  │  │
│  │ │ ▪ 20 × Motor Eléctrico 5HP                          │  │  │
│  │ │ ▪ 50 × Rodamiento SKF 6205                          │  │  │
│  │ │ ▪ 10 × Bomba Hidráulica Rexroth                     │  │  │
│  │ └──────────────────────────────────────────────────────┘  │  │
│  │ Estado: 🟡 Confirmado — Pendiente de picking              │  │
│  │ [Crear Salida →]                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📦 SO-2026-0044          🔵 Media            📅 31/03    │  │
│  │ Cliente: Distribuidora Nacional del Ecuador                │  │
│  │ SAP: 0080012340 | Entrega solicitada: 05/04/2026          │  │
│  │ Items: 2 materiales | Total: $3,200.00                    │  │
│  │ Estado: 🟢 Picking en progreso — 1/2 items listos         │  │
│  │ [Continuar Picking →]                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6.4 Paso 2: Crear Goods Issue

Al hacer click en [Crear Salida →], GRIXI auto-localiza el stock:

```
┌─ Salida de Mercancía — SO-2026-0045 ────────────────────────────┐
│                                                                  │
│  ┌─ Header ──────────────────────────────────────────────────┐  │
│  │ Documento: GI-2026-0024 (auto)                            │  │
│  │ Referencia: SO-2026-0045 | SAP Delivery: 8000054321       │  │
│  │ Cliente: Industrias del Pacífico S.A.                     │  │
│  │ Movimiento SAP: 261 — Salida por pedido de venta          │  │
│  │ Almacén: Almacén Central                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Items con Auto-Localización ─────────────────────────────────┐│
│  │                                                                ││
│  │  Item 10 | MEC-MOT-001 — Motor Eléctrico 5HP                 ││
│  │  Solicitado: 20 UN | Stock disponible: 85 UN ✅               ││
│  │  ┌──────────────────────────────────────────────────────┐     ││
│  │  │ Fuente                    Lote              Cant.    │     ││
│  │  │ B02-1-4 (Materia Prima)  LOT-20260215-042    15     │     ││
│  │  │ A01-2-3 (Central)        LOT-20260301-089     5     │     ││
│  │  │                                        Total: 20     │     ││
│  │  └──────────────────────────────────────────────────────┘     ││
│  │  Estrategia: FIFO (lote más antiguo primero)                  ││
│  │  ─────────────────────────────────────────────────────────── ││
│  │                                                                ││
│  │  Item 20 | MEC-BRD-001 — Rodamiento SKF 6205                 ││
│  │  Solicitado: 50 UN | Stock disponible: 205 UN ✅              ││
│  │  ┌──────────────────────────────────────────────────────┐     ││
│  │  │ Fuente                    Lote              Cant.    │     ││
│  │  │ A01-3-2 (Central)        LOT-20260115-015    50     │     ││
│  │  │                                        Total: 50     │     ││
│  │  └──────────────────────────────────────────────────────┘     ││
│  │  Estrategia: FIFO                                             ││
│  │  ─────────────────────────────────────────────────────────── ││
│  │                                                                ││
│  │  Item 30 | HYD-PMP-001 — Bomba Hidráulica Rexroth A10V      ││
│  │  Solicitado: 10 UN | Stock disponible: 12 UN ✅               ││
│  │  ┌──────────────────────────────────────────────────────┐     ││
│  │  │ Fuente                    Lote              Cant.    │     ││
│  │  │ B01-2-1 (Materia Prima)  LOT-20260220-103    10     │     ││
│  │  │                                        Total: 10     │     ││
│  │  └──────────────────────────────────────────────────────┘     ││
│  │  Estrategia: FIFO                                             ││
│  │                                                                ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Cancelar]         [Guardar como Picking List]  [✓ Contab.]    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Algoritmo de Auto-Localización (Configurable por Estrategia)

La auto-localización aplica la **estrategia de picking activa** del almacén (ver `15-ESTRATEGIAS-ALMACEN.md §15.3`):

```sql
-- wms_get_picking_sources — Aplica estrategia activa
-- Primero consulta warehouse_strategies para determinar cuál usar:
-- FIFO (default) → ORDER BY entry_date ASC
-- FEFO (override para lotes con vencimiento) → ORDER BY expiry_date ASC
-- Consolidación → ORDER BY quantity ASC (vaciar primero parciales)
-- Mínimo movimiento → ORDER BY proximidad al dock

SELECT i.id, i.position_id, i.lot_number, i.quantity, i.entry_date,
       lt.expiry_date,  -- JOIN con lot_tracking para FEFO
       rp.rack_id, r.code as rack_code,
       rp.row_number, rp.column_number
FROM inventory i
JOIN rack_positions rp ON i.position_id = rp.id
JOIN racks r ON rp.rack_id = r.id
LEFT JOIN lot_tracking lt ON lt.lot_number = i.lot_number AND lt.product_id = i.product_id
WHERE i.product_id = $1
  AND i.status = 'active'
  AND i.quantity > 0
  AND r.warehouse_id = $2
ORDER BY
  CASE WHEN $3 = 'fifo' THEN EXTRACT(EPOCH FROM i.entry_date) END ASC,
  CASE WHEN $3 = 'fefo' THEN EXTRACT(EPOCH FROM lt.expiry_date) END ASC,
  CASE WHEN $3 = 'consolidate' THEN i.quantity END ASC
```

**Override automático:** Si el producto tiene lotes con `expiry_date` (en `lot_tracking`), la estrategia se auto-cambia a **FEFO** independientemente de la config, mostrando un aviso:

```
ℹ️ Override FEFO: Este producto tiene lotes con fecha de vencimiento.
   Se prioriza el lote LOT-20260115-042 que vence el 15/07/2026
   [Usar FIFO original] [Mantener FEFO ✓]
```

**Alternativas visibles:** En el panel de cada item, el operador puede ver las alternativas:

```
Estrategias alternativas:
├── FEFO: Mismo resultado (ningún lote tiene fecha vence)
├── Consolidación: B02-1-4 (15) + A01-2-3 (5) — vacía B02
└── Mín. Movimiento: A01-2-3 (20) — más cerca del dock
```

> Ver `15-ESTRATEGIAS-ALMACEN.md §15.3` para la tabla completa de estrategias y diagramas comparativos.

---

## 6.5 Paso 3: Picking List Visual

Si el operador decide hacer picking antes de confirmar:

```
┌─ Picking List — GI-2026-0024 ───────────────────────────────────┐
│                                                                  │
│  Progreso: ██████████░░░░░░ 2/3 items (67%)                    │
│                                                                  │
│  ┌─ RUTA DE PICKING (optimizada) ────────────────────────────┐  │
│  │                                                            │  │
│  │  1️⃣  → Pasillo A, Rack A01, Fila 3, Col 2               │  │
│  │     📦 50 × Rodamiento SKF 6205                           │  │
│  │     ☑ Picked                                              │  │
│  │                                                            │  │
│  │  2️⃣  → Pasillo A, Rack A01, Fila 2, Col 3               │  │
│  │     📦 5 × Motor Eléctrico 5HP                            │  │
│  │     ☑ Picked                                              │  │
│  │                                                            │  │
│  │  3️⃣  → Pasillo B, Rack B02, Fila 1, Col 4               │  │
│  │     📦 15 × Motor Eléctrico 5HP                           │  │
│  │     ☐ Pendiente                                           │  │
│  │                                                            │  │
│  │  4️⃣  → Pasillo B, Rack B01, Fila 2, Col 1               │  │
│  │     📦 10 × Bomba Hidráulica Rexroth                      │  │
│  │     ☐ Pendiente                                           │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [← Volver]              [Confirmar Todos]  [✓ Confirmar Pick]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6.6 Paso 4: Contabilización de Salida

### Transacción RPC: `wms_post_goods_issue`

```sql
-- Para cada item del GI:
-- 1. Reducir quantity del inventory record
-- 2. Si quantity llega a 0 → DELETE inventory, SET rack_position.status = 'available'
-- 3. Crear inventory_movement con sap_movement_type = '261'
-- 4. Actualizar sales_order_items.quantity_picked / quantity_shipped
-- 5. Evaluar si el SO está completamente despachado
-- 6. Generar sap_document_id simulado
```

---

## 6.7 Variante: Salida por Centro de Costo (Mov. 201)

Para consumo interno (mantenimiento, oficina, etc.):

```
┌─ Salida por Centro de Costo ────────────────────────────────────┐
│                                                                  │
│  Documento: GI-2026-CC-0015                                     │
│  Tipo: Consumo interno (201)                                    │
│  Centro de Costo: [CC-MTTO ▼] Mantenimiento                    │
│  Solicitante: [🔍 Buscar usuario...]                            │
│                                                                  │
│  [+ Agregar Material]                                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Material: Aceite Hidráulico SAE 68                        │  │
│  │ Cantidad: [20]  Unidad: Litro                             │  │
│  │ Fuente auto: A02-4-2 (LOT-20260215-042)                  │  │
│  │ Motivo: [Mantenimiento programado de prensas]             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancelar]                              [✓ Contabilizar]       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6.8 Estados del Goods Issue

```
pending → picking → confirmed → posted
                                  │
                                  ▼
                            (document SAP)
```

| Estado | Significado | Color |
|--------|------------|-------|
| `pending` | Creado, pendiente de picking | Blue |
| `picking` | Operador realizando picking | Amber |
| `confirmed` | Picking completado, listo para contabilizar | Indigo |
| `posted` | Contabilizado y stock descontado | Emerald |
| `cancelled` | Cancelado antes de posting | Gray |
| `reversed` | Anulado post-posting (genera mov. reverso) | Red |

---

## 6.9 Notificaciones Post-Salida

1. **Toast premium:**
   ```
   📤 Salida GI-2026-0024 contabilizada
   80 unidades despachadas | SO-2026-0045
   Cliente: Industrias del Pacífico
   Doc. SAP: MAT-20260401-0089
   ```

2. **Si stock bajo mínimo:**
   ```
   ⚠️ Alerta de Stock Bajo
   Motor Eléctrico 5HP: 5 UN restantes (mínimo: 10)
   Almacén: Materia Prima
   [Crear Solicitud de Compra]
   ```

3. **Actualización 3D:** Posiciones cambian de occupied → available

---

## 6.10 Validaciones

| Validación | Momento | Acción |
|-----------|---------|--------|
| Stock insuficiente | Al crear GI | Bloquear item, mostrar disponible |
| Producto bloqueado/expirado | Al crear GI | Warning, requiere override |
| Cantidad > ordenada (SO) | Al confirmar | Bloquear, mostrar diferencia |
| Posición ya liberada | Al posting | Error, recargar data |
| Usuario sin permisos | Al crear | Bloquear acción |
