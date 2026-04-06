# GRIXI WMS — Plan de Modernización v2
> Fecha: 6 de abril 2026 | Basado en: Revisión con Calixto Saldarriaga

---

## Resumen Ejecutivo

17 cambios agrupados en **6 fases** de ejecución. Cada fase es independiente y desplegable por separado. El orden de fases prioriza impacto visual y funcionalidad crítica.

---

## Fase 1 — Renombramiento y Ajustes de UI Inmediatos
> Tiempo estimado: ~1-2 horas | Riesgo: Bajo

### 1.1 Renombrar "Operaciones" → "Movimiento de Material"
**Archivos afectados:**
- `wms-operations.tsx` — título, tabs, dropdown
- `wms-dashboard.tsx` — navegación de tabs
- `warehouses-content.tsx` — si referencia tabs

**Cambios:**
- Tab "Operaciones" → "Movimiento de Material"
- Botón "Nueva Operación" → "Nuevo Movimiento de Material"  
- Sub-tab "Historial" → "Historial de Movimiento de Material"
- En el dropdown del `+`: mantener Entrada, Salida, Traspaso

### 1.2 Separar Bandeja vs Historial
**Lógica actual:** Muestra todos los movimientos mezclados.
**Lógica nueva:**
- **Bandeja (Movimiento de Material):** Solo items con status `pending`, `picking`, `in_transit`, `picking_pending`, `received` → transacciones que requieren acción
- **Historial:** Solo items con status `posted`, `cancelled` → completados

**Cambio DB:** Agregar campo `status` a `inventory_movements` si no existe (actualmente no tiene). Alternativa: derivar status desde las tablas padre (`goods_receipts.status`, `goods_issues.status`, `transfer_orders.status`).

> **Decisión:** Usar los status de las tablas padre. No agregar columna a `inventory_movements`.

### 1.3 Quitar iconos del dropdown de lotes
**Archivo:** `lots-tab.tsx`
**Cambio:** Reemplazar checkbox/icons por estilo Dropbox limpio (solo texto con indicador sutil)

### 1.4 Alinear cantidades a la derecha en Inventario
**Archivos:** `stock-hierarchy-view.tsx`, `lots-tab.tsx`
**Cambios:**
- Stock Total, Reservado, Disponible → alineados a la derecha con `tabular-nums text-right`
- Estados e información → lado izquierdo
- Si hay stock reservado: mostrar `Disponible: X | Reservado: Y`
- Aplicar en TODOS los niveles (material → lote → UA)

### 1.5 Mostrar referencia SAP en vista principal de movimientos
**Archivo:** `wms-operations.tsx`
**Cambio:** Agregar `sap_document_id` entre paréntesis después del número de documento en cada movimiento del historial.

---

## Fase 2 — Inventario Físico y Visualización 3D de Materiales
> Tiempo estimado: ~3-4 horas | Riesgo: Medio

### 2.1 Ocultar cantidad del sistema durante toma física
**Archivo:** `physical-counts-tab.tsx`
**Tabla:** `physical_count_items` (tiene `system_quantity`, `counted_quantity`, `variance`)

**Lógica:**
- Mientras `physical_counts.status = 'in_progress'` → **ocultar** `system_quantity` y `variance`
- Solo mostrar campo para ingresar `counted_quantity`
- Al cerrar (`status = 'closed'`): revelar `system_quantity`, calcular `variance`, mostrar comparación

### 2.2 Visualización de inconsistencias al cerrar inventario
**UI al cerrar:**
- Vista de resumen con cada posición contada
- 🟢 Verde = contado == sistema (sin varianza)
- 🔴 Rojo = déficit (contado < sistema)
- 🟡 Amarillo = exceso (contado > sistema)
- Opcional: vista 3D del almacén con racks coloreados por estado de varianza

### 2.3 Botón 3D para ver todos los racks de un material
**Archivo:** `stock-hierarchy-view.tsx`
**Componente nuevo:** Reutilizar `MiniWarehouse3D` con `highlightedPositions` para todas las posiciones donde existe el material.

**Datos requeridos:**
```sql
SELECT DISTINCT rp.rack_id, r.rack_code, rp.row_number, rp.column_number, su.su_code
FROM storage_units su
JOIN rack_positions rp ON rp.id = su.position_id
JOIN racks r ON r.id = rp.rack_id
WHERE su.product_id = $1 AND su.warehouse_id = $2 AND su.status IN ('available','reserved')
```

**UI:** Botón "Ver en 3D" al nivel de material → abre MiniWarehouse3D con TODAS las posiciones del material resaltadas, cada lote con color diferente.

---

## Fase 3 — Entrada de Mercancía: Flujo de 2 Pasos
> Tiempo estimado: ~4-5 horas | Riesgo: Alto

### 3.1 Rediseño del flujo

```
PASO 1: Recepción y Verificación
├── Seleccionar OC
├── Verificar cantidades recibidas (editar qty)
├── Generar UAs temporales (UTEMP-YYYYMMDD-HHMM-{SKU})
├── Ubicación → "RECEPCIÓN" (posición suelo ilimitada)
└── Guardar → Status: "received" (pendiente de ubicación)

PASO 2: Asignación de Ubicación  
├── Reabrir la GR desde bandeja de "Movimiento de Material"
├── Vista general de TODOS los items a ubicar
├── Para cada item: selección con IA o manual (putaway)
├── 3D del almacén mostrando posiciones sugeridas
└── Confirmar → Status: "accepted", mover UA a posición definitiva
```

### 3.2 Posición "RECEPCIÓN" (Suelo)
**Migración DB:**
```sql
-- Crear rack virtual "RECEPCIÓN" en cada almacén
INSERT INTO racks (id, warehouse_id, rack_code, rack_type, total_rows, total_columns)
SELECT gen_random_uuid(), id, 'RECEPCIÓN', 'floor', 1, 1
FROM warehouses
WHERE NOT EXISTS (
  SELECT 1 FROM racks WHERE warehouse_id = warehouses.id AND rack_code = 'RECEPCIÓN'
);

-- Crear posición ilimitada en rack RECEPCIÓN
INSERT INTO rack_positions (id, rack_id, row_number, column_number, status, max_storage_units)
SELECT gen_random_uuid(), r.id, 1, 1, 'available', 9999
FROM racks r WHERE r.rack_code = 'RECEPCIÓN'
AND NOT EXISTS (
  SELECT 1 FROM rack_positions WHERE rack_id = r.id
);
```

### 3.3 Generación de UAs temporales
**Formato:** `UTEMP-{YYYYMMDD}-{HHMM}-{SKU}`
**Ejemplo:** `UTEMP-20260406-1520-QUI-RES-001`

**Reglas:**
- 1 UA temporal por línea material/lote
- `storage_units.status = 'available'`
- `storage_units.position_id` = posición del rack "RECEPCIÓN"
- Se genera al guardar Paso 1

### 3.4 Arreglar Grid 2D de selección manual
**Archivo:** `rack-position-grid.tsx`
**Issue:** El grid visual 2D para selección manual de posiciones está roto.
**Fix:** Revisar props, renderizado de celdas, y eventos `onClick` para selección.

### 3.5 Vista general de items a ubicar
**UI en Paso 2:** Tabla/lista de TODOS los materiales pendientes con:
- Producto, SKU, cantidad, lote, UA temporal actual
- Botón "Asignar" por item → abre putaway con IA/manual/3D
- Badge de progreso: `3/5 ubicados`

---

## Fase 4 — Salida de Mercancía: Picking con Estados
> Tiempo estimado: ~4-5 horas | Riesgo: Alto

### 4.1 Estado de máquina para Picking

```
draft → picking_saved → picking_confirmed → posted
         ↓                    ↓
       (operario va         (admin valida
        a buscar)            la recolección)
```

**Cambio DB en `goods_issues`:**
El campo `status` ya existe. Nuevos valores válidos:
- `draft` — Pedido creado, sin picking
- `picking_saved` — Picking guardado (IA o manual), operario puede ir a buscar
- `picking_confirmed` — Operario confirma que recogió todo
- `posted` — Contabilizado (salida efectiva del stock)
- `cancelled` — Cancelado

**Cambio DB en `goods_issue_items`:**
Agregar campos si no existen:
- `quantity_picked` ✅ (ya existe)
- `picked_at` ✅ (ya existe)
- `storage_unit_id` ✅ (ya existe)
- `pick_status` (nuevo): `pending` | `picked` | `confirmed`

### 4.2 Picking Manual en 3D
**Flujo:**
1. Usuario elige "Picking Manual" (en lugar de aceptar sugerencia IA)
2. Se renderiza `MiniWarehouse3D` con racks que contienen el material solicitado resaltados
3. Al hacer clic en un rack/posición → muestra las UAs disponibles en esa posición
4. Usuario selecciona UA y cantidad → se agrega al picking list
5. Botón "Guardar Picking" → status `picking_saved`

**Datos para resaltar racks:**
```sql
SELECT DISTINCT r.rack_code, rp.row_number, rp.column_number, su.su_code
FROM storage_units su
JOIN rack_positions rp ON rp.id = su.position_id  
JOIN racks r ON r.id = rp.rack_id
WHERE su.product_id = $1 AND su.warehouse_id = $2 
  AND su.status = 'available' AND su.available_quantity > 0
```

### 4.3 Guardar picking independiente
**Archivo:** `goods-issue-wizard.tsx`
**Cambio:** 
- Botón "Guardar Picking" (sin contabilizar) → crea `goods_issue` con status `picking_saved`
- Botón "Confirmar Picking" → cambia a `picking_confirmed`  
- Botón "Contabilizar" → cambia a `posted`, descuenta stock
- Cada paso es re-entrable desde la bandeja de "Movimiento de Material"

---

## Fase 5 — Traspasos: Flujo de 4 Pasos (Enviar/Picking/Recibir/Ubicar)
> Tiempo estimado: ~5-6 horas | Riesgo: Alto

### 5.1 Nueva máquina de estados para Transfer Orders

```
pending → picking_pending → picking_done → in_transit → received → located → posted
  ↓           ↓                ↓              ↓            ↓          ↓
(admin     (operario       (operario      (en camino)  (admin     (operativo
 crea)      selecciona      confirma                    confirma    ubica en
            UAs a enviar)   salida)                     llegada)    rack)
```

**Recomendación:** Usar el campo `status` existente en `transfer_orders` (no agregar columna `step`). Los steps se derivan del status:

| Status | Step UI | Responsable | Acción SAP |
|--------|---------|-------------|------------|
| `pending` | Creado | Admin | — |
| `picking_pending` | Enviar → Picking | Operativo Origen | — |
| `picking_done` | Picking Confirmado | Operativo Origen | MOV 311 Salida |
| `in_transit` | En Tránsito | Sistema | — |
| `received` | Recibido | Admin Destino | MOV 311 Entrada |
| `located` | Ubicado | Operativo Destino | — (solo WMS) |
| `posted` | Completado | Sistema | — |

### 5.2 Wizard de Traspaso Rediseñado

```
PASO 1: Origen y Destino (actual - mantener)
├── Seleccionar almacén origen y destino
├── Prioridad y motivo
└── → Siguiente

PASO 2: Selección de Material (mejorado)
├── Lista completa de materiales con stock actual del almacén origen
├── Mostrar: nombre, SKU, stock disponible, reservado
├── Buscar y agregar materiales con cantidades
├── Validar que no exceda stock disponible
└── → Siguiente

PASO 3: Picking Origen — Seleccionar de qué rack sale  (NUEVO)
├── Para cada material: 
│   ├── Sugerencia IA (FEFO/FIFO) de qué UA extraer
│   ├── Selección manual en 3D (racks con material resaltados)
│   └── Confirmar UAs y cantidades de salida
├── Vista 3D del almacén ORIGEN con racks resaltados
└── Botón "Confirmar Envío" → status `picking_done` → `in_transit`

PASO 4: Recepción Destino — Seleccionar dónde se guarda (NUEVO)
├── Vista de materiales recibidos
├── Para cada material:
│   ├── Sugerencia IA de putaway en almacén destino
│   ├── Selección manual de posición
│   └── O asignar a "RECEPCIÓN" (suelo) temporal
├── Vista 3D del almacén DESTINO
└── Botón "Confirmar Ubicación" → status `located` → `posted`
```

> **Nota:** Los Pasos 3 y 4 pueden hacerse en momentos diferentes. 
> El traspaso aparece en la bandeja como "pendiente" hasta completar todos los pasos.

### 5.3 Items del traspaso con stock visible
**Archivo:** `transfer-order-wizard.tsx` Step 2
**Datos:**
```sql
-- Obtener stock por producto en almacén origen
SELECT p.id, p.name, p.sku, 
  COALESCE(SUM(su.available_quantity), 0) as stock_disponible,
  COALESCE(SUM(CASE WHEN su.status='reserved' THEN su.quantity ELSE 0 END), 0) as stock_reservado
FROM products p
LEFT JOIN storage_units su ON su.product_id = p.id AND su.warehouse_id = $1
GROUP BY p.id, p.name, p.sku
HAVING COALESCE(SUM(su.available_quantity), 0) > 0
ORDER BY p.name
```

---

## Fase 6 — Datos de Ejemplo y Tutorial
> Tiempo estimado: ~2-3 horas | Riesgo: Bajo

### 6.1 Seed Data: Movimientos con múltiples lotes/UAs
**Crear en BD:**
- 2-3 `goods_issues` con múltiples `goods_issue_items` (diferentes lotes, UAs, posiciones)
- 2-3 `transfer_orders` con múltiples `transfer_order_items` (cross-warehouse)
- Movimientos de inventario que referencien múltiples UAs
- Asegurar que el historial del panel lateral muestre correctamente N items

### 6.2 Verificar visualización multi-item
**Archivo:** `operation-profile-drawer.tsx`, `movement-profile-drawer.tsx`
**Validar:** que al hacer clic en un movimiento con múltiples UAs/lotes, el panel lateral muestre TODOS los items con:
- UA code, lote, posición, cantidad
- Vista 3D de las posiciones involucradas
- Fechas

### 6.3 Tutorial actualizado
**Archivo:** `wms-tour.tsx`
**Actualizar** todos los pasos para reflejar:
- Nueva nomenclatura "Movimiento de Material"
- Flujos de 2 pasos en entrada
- Picking con estados en salida
- Traspasos de 4 pasos

---

## Resumen de Migraciones DB Requeridas

| # | Migración | Tabla | Cambio |
|---|-----------|-------|--------|
| 1 | `create_reception_racks` | `racks`, `rack_positions` | Rack virtual "RECEPCIÓN" por almacén |
| 2 | `add_pick_status` | `goods_issue_items` | Campo `pick_status` (pending/picked/confirmed) |
| 3 | `expand_transfer_statuses` | — | No requiere DDL, solo valores nuevos en `status` |
| 4 | `add_gr_step` | `goods_receipts` | Campo `location_status` (pending_location/located) |
| 5 | `seed_multi_lot_movements` | Varias | Data de ejemplo |

## Resumen de Componentes a Modificar

| Componente | Fase | Tipo de Cambio |
|------------|------|----------------|
| `wms-operations.tsx` | 1 | Renombrar + filtro bandeja/historial |
| `wms-dashboard.tsx` | 1 | Renombrar tab |
| `lots-tab.tsx` | 1 | Quitar iconos dropdown |
| `stock-hierarchy-view.tsx` | 1, 2 | Alinear nums + botón 3D material |
| `physical-counts-tab.tsx` | 2 | Ocultar system_qty + visualización inconsistencias |
| `goods-receipt-wizard.tsx` | 3 | Flujo 2 pasos + UAs temporales |
| `rack-position-grid.tsx` | 3 | Fix grid 2D manual |
| `goods-issue-wizard.tsx` | 4 | Picking manual 3D + estados |
| `transfer-order-wizard.tsx` | 5 | Wizard 4 pasos con 3D dual |
| `operation-profile-drawer.tsx` | 6 | Soporte multi-item |
| `movement-profile-drawer.tsx` | 6 | Soporte multi-item |
| `wms-tour.tsx` | 6 | Tutorial actualizado |
| `mini-warehouse-3d.tsx` | 2, 4, 5 | Reutilizar (sin cambios) |

---

## Diagrama de Flujos Finales

### Entrada de Mercancía
```
OC → Verificar Qty → Generar UTEMP → Guardar (status: received)
                                         ↓
                            Bandeja → Asignar Ubicación → IA/Manual/3D
                                         ↓
                                    Confirmar (status: accepted)
```

### Salida de Mercancía
```
SO → Picking IA (automático) o Manual (3D)
         ↓
    Guardar Picking (status: picking_saved)
         ↓
    Confirmar Picking (status: picking_confirmed)  
         ↓
    Contabilizar (status: posted, descuenta stock)
```

### Traspaso entre Almacenes  
```
Crear (pending) → Picking Origen (picking_pending → picking_done)
                         ↓
                   En Tránsito (in_transit)
                         ↓
                   Recibir Destino (received)
                         ↓
                   Ubicar en Rack (located → posted)
```

---

## Notas Técnicas

- **MiniWarehouse3D** ya soporta `highlightedPositions[]` — se reutiliza en todas las fases
- **Posición RECEPCIÓN** tiene `max_storage_units = 9999` (prácticamente ilimitada)
- **UA temporales** no generan movimiento SAP al crearse — solo al cambiar a posición definitiva
- **Los traspasos internos** (mismo almacén) siguen los 4 pasos completos
- **El picking manual** reutiliza la infraestructura del AI picking pero permite override por clic en 3D
