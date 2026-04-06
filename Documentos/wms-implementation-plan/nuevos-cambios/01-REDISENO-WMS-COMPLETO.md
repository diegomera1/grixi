# 01 — Rediseño WMS: Unidades de Almacén, Lotes por Material & Workflow Completo

> **Fecha:** 2026-04-06
> **Origen:** Reunión Diego Mera + Calixto Saldarriaga
> **Estado:** Plan de ejecución para demo

---

## Resumen Ejecutivo

Se rediseña el sistema WMS de GRIXI para incorporar el concepto de **Unidad de Almacén** (UA) como unidad fundamental de gestión, vincular **siempre** Material + Lote, implementar **reservas parciales** durante el picking, **IA asistida** en todas las operaciones, y **perfiles detallados** con mini-vista 3D para cada lote/material.

---

## 1. CAMBIOS EN MODELO DE DATOS

### 1.1 Nueva Tabla: `storage_units` (Unidades de Almacén)

Concepto central: cada posición (X,Y,Z) contiene **una o varias** unidades de almacén. Cada UA contiene **exactamente un material con un lote**.

```sql
CREATE TABLE public.storage_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    su_code VARCHAR NOT NULL,          -- Código único: "UA-000001"
    su_type TEXT NOT NULL DEFAULT 'tina'
        CHECK (su_type IN ('palet', 'tina', 'caja', 'contenedor')),
    
    -- Ubicación
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    position_id UUID NOT NULL REFERENCES public.rack_positions(id),
    
    -- Contenido (1 material + 1 lote por UA)
    product_id UUID NOT NULL REFERENCES public.products(id),
    lot_id UUID NOT NULL REFERENCES public.lot_tracking(id),
    
    -- Cantidades
    quantity NUMERIC NOT NULL DEFAULT 0,             -- Cantidad total en la UA
    reserved_quantity NUMERIC NOT NULL DEFAULT 0,    -- Cantidad reservada (picking)
    available_quantity NUMERIC GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN (
            'available',     -- Disponible para picking
            'reserved',      -- Toda la cantidad está reservada
            'picking',       -- En proceso de picking (operador recogiendo)
            'picked',        -- Recogida completada, esperando confirmación 
            'in_transit',    -- En tránsito (traspaso)
            'empty'          -- Vacía (reutilizable)
        )),
    
    -- Capacidad
    max_weight_kg NUMERIC,
    current_weight_kg NUMERIC DEFAULT 0,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(org_id, su_code)
);

-- Índices
CREATE INDEX idx_storage_units_org ON storage_units(org_id);
CREATE INDEX idx_storage_units_position ON storage_units(position_id);
CREATE INDEX idx_storage_units_product ON storage_units(product_id);
CREATE INDEX idx_storage_units_lot ON storage_units(lot_id);
CREATE INDEX idx_storage_units_status ON storage_units(status);
CREATE INDEX idx_storage_units_warehouse ON storage_units(warehouse_id);
CREATE INDEX idx_storage_units_code ON storage_units(su_code);
```

**Tipos de Unidad de Almacén:**

| Tipo | Descripción | Peso Máx. Default |
|------|-------------|-------------------|
| `palet` | Palet estándar EUR/US | 1000 kg |
| `tina` | Tina/contenedor mediano | 200 kg |
| `caja` | Caja/cartón | 50 kg |
| `contenedor` | Contenedor grande/especial | 2000 kg |

**Límites por posición:**
- Cada `rack_position` tiene un campo `max_storage_units` (default: 4)
- Regla: 1 palet ocupa toda la posición, 4 tinas caben, etc.

```sql
ALTER TABLE public.rack_positions
    ADD COLUMN IF NOT EXISTS max_storage_units INTEGER DEFAULT 4,
    ADD COLUMN IF NOT EXISTS allowed_su_types TEXT[] DEFAULT ARRAY['palet', 'tina', 'caja', 'contenedor'];
```

### 1.2 Tabla: `storage_unit_reservations` (Reservas parciales)

```sql
CREATE TABLE public.storage_unit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    storage_unit_id UUID NOT NULL REFERENCES public.storage_units(id),
    
    -- Referencia al documento que reserva
    reference_type TEXT NOT NULL
        CHECK (reference_type IN ('goods_issue', 'transfer_order', 'sales_order')),
    reference_id UUID NOT NULL,
    
    -- Cantidad reservada
    quantity_reserved NUMERIC NOT NULL,
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'picking', 'picked', 'released', 'cancelled')),
    
    reserved_at TIMESTAMPTZ DEFAULT now(),
    picked_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_su_reservations_su ON storage_unit_reservations(storage_unit_id);
CREATE INDEX idx_su_reservations_ref ON storage_unit_reservations(reference_type, reference_id);
CREATE INDEX idx_su_reservations_status ON storage_unit_reservations(status);
```

### 1.3 Modificaciones a `lot_tracking`

El lote SIEMPRE debe tener un material asociado. Ya tiene `product_id NOT NULL` ✓

Agregar campo de auto-generación:

```sql
ALTER TABLE public.lot_tracking
    ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS gr_number VARCHAR;  -- Referencia a la GR que lo creó
```

**Formato de número de lote:** `LOT-YYYYMMDD-SEQ` (ej: `LOT-20260405-001`)

Función para auto-generar:

```sql
CREATE OR REPLACE FUNCTION wms_generate_lot_number(p_org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_date TEXT;
    v_seq INTEGER;
    v_lot VARCHAR;
BEGIN
    v_date := to_char(now(), 'YYYYMMDD');
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(lot_number, '-', 3) AS INTEGER)
    ), 0) + 1
    INTO v_seq
    FROM lot_tracking
    WHERE org_id = p_org_id
      AND lot_number LIKE 'LOT-' || v_date || '-%';
    
    v_lot := 'LOT-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');
    RETURN v_lot;
END;
$$ LANGUAGE plpgsql;
```

### 1.4 Modificaciones a `inventory_movements`

**Eliminar códigos SAP numéricos** del frontend. El campo `sap_movement_type` se mantiene para futura integración pero se agrega un campo `movement_description` legible:

```sql
ALTER TABLE public.inventory_movements
    ADD COLUMN IF NOT EXISTS movement_description TEXT,      -- "Entrada de mercancía"
    ADD COLUMN IF NOT EXISTS storage_unit_id UUID REFERENCES public.storage_units(id);
```

**Mapa de descripciones:**

| Código SAP (interno) | Descripción visible |
|---------|---------------------|
| 101 | Entrada de mercancía |
| 102 | Anulación de entrada |
| 201 | Salida por centro de costo |
| 261 | Salida por pedido de venta |
| 262 | Anulación de salida |
| 301 | Traspaso entre almacenes |
| 311 | Traspaso interno |
| 551 | Salida por merma/scrap |

### 1.5 Modificaciones a `goods_receipt_items`

```sql
ALTER TABLE public.goods_receipt_items
    ADD COLUMN IF NOT EXISTS storage_unit_id UUID REFERENCES public.storage_units(id),
    ADD COLUMN IF NOT EXISTS su_type TEXT DEFAULT 'tina',
    ADD COLUMN IF NOT EXISTS su_code VARCHAR;
```

### 1.6 Modificaciones a `goods_issue_items`

```sql
ALTER TABLE public.goods_issue_items
    ADD COLUMN IF NOT EXISTS storage_unit_id UUID REFERENCES public.storage_units(id),
    ADD COLUMN IF NOT EXISTS quantity_picked NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ;
```

### 1.7 Modificaciones a `transfer_order_items`

```sql
ALTER TABLE public.transfer_order_items
    ADD COLUMN IF NOT EXISTS storage_unit_id UUID REFERENCES public.storage_units(id),
    ADD COLUMN IF NOT EXISTS from_su_code VARCHAR,
    ADD COLUMN IF NOT EXISTS to_position_label VARCHAR,
    ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
```

### 1.8 Auto-generación de código UA

```sql
CREATE OR REPLACE FUNCTION wms_generate_su_code(p_org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(su_code, '-', 2) AS INTEGER)
    ), 0) + 1
    INTO v_seq
    FROM storage_units
    WHERE org_id = p_org_id;
    
    RETURN 'UA-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

---

## 2. FLUJOS OPERATIVOS REDISEÑADOS

### 2.1 Entrada de Mercancía (Goods Receipt) — Flujo Nuevo

```
PASO 1: Seleccionar OC
    └→ Pool de OCs pendientes (ya existe)

PASO 2: Verificar cantidades por ítem
    └→ Para cada material de la OC:
       ├── Cantidad recibida (editable)
       ├── AUTO-GENERAR número de lote (LOT-YYYYMMDD-SEQ)
       │   └── Editable si el operador desea cambiar
       ├── Fecha de vencimiento (manual o auto si hay config)
       └── Observaciones de calidad

PASO 3: Crear Unidades de Almacén
    └→ El sistema SUGIERE cómo distribuir:
       ├── "500 UN de Motor Eléctrico → Sugerencia: 1 palet (500 UN)"
       ├── "200 UN de Rodamiento → Sugerencia: 2 tinas (100 UN c/u)"
       └── El operador puede ajustar (cambiar tipo, dividir, etc.)
       
    └→ Para cada UA creada, ASIGNAR POSICIÓN:
       ├── IA sugiere posición óptima con JUSTIFICACIÓN
       │   "Posición A01-3-2 recomendada porque:
       │    ✓ Zona de alta rotación (ABC-A)
       │    ✓ Cercana a punto de despacho
       │    ✓ Peso compatible (6kg < 200kg máx)"
       ├── El operador puede aceptar o seleccionar otra
       └── Visualización del rack con posiciones disponibles

PASO 4: Contabilizar
    └→ Transacción atómica:
       ├── Crear registro lot_tracking (auto-generado)
       ├── Crear registros storage_units (1 por UA)
       ├── Actualizar rack_positions.status → 'occupied'
       ├── Crear inventory_movements con movement_description
       ├── Actualizar goods_receipt.status → 'posted'
       └── Actualizar purchase_order cantidades recibidas
```

### 2.2 Salida de Mercancía (Goods Issue) — Flujo Nuevo con Picking

```
PASO 1: Seleccionar Pedido de Venta
    └→ Lista de SO pendientes (ya existe)

PASO 2: Crear Goods Issue (auto)
    └→ GI-2026-XXXX referenciando al SO
    └→ Para cada ítem del SO, buscar stock disponible

PASO 3: PICKING — Selección de UA + Lote
    └→ Para cada material del pedido:
    
    OPCIÓN A — AI Picking Proposal (recomendado):
       ├── IA analiza todo el stock WM disponible
       ├── Sugiere las mejores UAs basándose en:
       │   ├── FEFO: lotes con vencimiento más próximo primero
       │   ├── FIFO: UAs más antiguas primero
       │   ├── Distancia: UAs más cercanas al punto de despacho
       │   └── Consolidación: minimizar UAs parciales
       ├── Muestra: "Tomar 30 UN de UA-000045 (Tina, Lote LOT-20260301-002)
       │             Posición: Almacén Central > Rack A01 > Fila 3, Col 2"
       └── Operador acepta o modifica

    OPCIÓN B — Selección manual:
       ├── Vista jerárquica del stock:
       │   └── Material: Motor Eléctrico 5HP
       │       ├── Lote LOT-20260301-002 (vence: 2027-03-01)
       │       │   ├── UA-000045 (Tina) — 100 UN disponibles — A01-3-2
       │       │   └── UA-000046 (Tina) — 80 UN disponibles — A01-3-3
       │       └── Lote LOT-20260315-001 (vence: 2027-03-15)
       │           └── UA-000052 (Palet) — 500 UN disponibles — B02-1-1
       └── Operador selecciona UA + cantidad

    Al seleccionar:
       ├── Se crea reserva parcial en storage_unit_reservations
       ├── storage_unit.reserved_quantity += cantidad
       ├── Si reserved_quantity == quantity → status = 'reserved'
       └── La UA queda bloqueada para otros pedidos (esa cantidad)

PASO 4: Confirmar picking (el operador fue físicamente)
    └→ Para cada línea de picking:
       ├── Confirmar que recogió la cantidad
       ├── storage_unit.status → 'picked' (o actualizar quantity)
       └── Si la UA quedó vacía → status = 'empty'

PASO 5: Contabilizar salida
    └→ Transacción atómica:
       ├── Reducir storage_unit.quantity
       ├── Actualizar lot_tracking.remaining_quantity
       ├── Actualizar rack_positions.status si posición vacía
       ├── Crear inventory_movements
       ├── Liberar reservas (status → 'released')
       ├── goods_issue.status → 'posted'
       └── sales_order.status → 'shipped'
```

### 2.3 Traspasos — Flujo Nuevo con IA y 2 Pasos

```
PASO 1: Seleccionar origen
    └→ Almacén de origen + material a mover

PASO 2: IA sugiere origen óptimo
    └→ Del material seleccionado, IA recomienda:
       ├── Qué UA mover (preferir UAs completas)
       ├── Qué lote (FEFO si aplica)
       ├── JUSTIFICACIÓN: "UA-000045 recomendada porque:
       │    ✓ Lote más antiguo (FIFO)
       │    ✓ UA completa (evita picking parcial)
       │    ✓ Posición con alta ocupación (liberar espacio)"
       └── Operador acepta o selecciona otra UA

PASO 3: IA sugiere destino óptimo  
    └→ En el almacén destino, IA recomienda posición:
       ├── "Posición C03-2-1 recomendada porque:
       │    ✓ Compatible con tipo UA (tina)
       │    ✓ Zona correcta según categoría del material
       │    ✓ Minimiza distancia de despacho futuro
       │    ✓ Peso compatible"
       └── Operador acepta o selecciona otra

PASO 4: Crear traspaso → Estado: 'pending'
    └→ Registrar UA, posiciones origen/destino, lote

PASO 5: ENVÍO → Estado: 'in_transit'
    └→ El operador confirma que sacó la UA de origen
    └→ storage_unit.status → 'in_transit'
    └→ rack_position origen se libera

PASO 6: CONFIRMACIÓN DESTINO → Estado: 'posted'
    └→ El operador destino confirma que recibió y colocó
    └→ storage_unit.position_id → nueva posición
    └→ storage_unit.warehouse_id → nuevo almacén
    └→ storage_unit.status → 'available'
    └→ rack_position destino → 'occupied'
    └→ Crear inventory_movements
```

---

## 3. VISTAS Y FRONTEND

### 3.1 Pestaña "Inventario" — Vista Jerárquica

```
Material: Motor Eléctrico 5HP (SKU: MOT-5HP-001)
├── Stock total: 680 UN en 3 almacenes
│
├── 📦 Lote LOT-20260301-002 — 180 UN — Vence: 2027-03-01
│   ├── UA-000045 (Tina) — 100 UN — Almacén Central > A01-3-2 🟢
│   └── UA-000046 (Tina) — 80 UN — Almacén Central > A01-3-3 🟢
│
├── 📦 Lote LOT-20260315-001 — 500 UN — Vence: 2027-03-15
│   └── UA-000052 (Palet) — 500 UN — Cámara Fría > B02-1-1 🟢
│
└── 📊 Resumen:
    ├── 3 Unidades de Almacén activas
    ├── 2 Lotes activos
    ├── Vencimiento más próximo: 2027-03-01 (89 días)
    └── Rotación: Media (ABC-B)
```

### 3.2 Perfil de Lote (Detalle) — Nueva vista

Al hacer click en un lote, se abre un **perfil completo**:

```
┌─ Detalle del Lote: LOT-20260301-002 ─────────────────────────┐
│                                                                │
│  Material: Motor Eléctrico 5HP (MOT-5HP-001)                 │
│  Proveedor: MetalTech Ecuador                                 │
│  Entrada: GR-2026-0045 | OC: PO-2026-0089                   │
│  Fecha fabricación: 01/03/2026                                │
│  Fecha vencimiento: 01/03/2027 (89 días restantes) ⚠️        │
│  Cantidad total: 200 UN | Restante: 180 UN                   │
│                                                                │
│  ┌─ Ubicación Actual ──────────────────────────────────────┐  │
│  │                                                          │  │
│  │  Almacén Central (Planta Principal)                     │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │  🟣 UA-000045 (Tina) — 100 UN                  │     │  │
│  │  │  Rack A01 > Fila 3, Columna 2                  │     │  │
│  │  │  Estado: 🟢 Disponible                         │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │  🟣 UA-000046 (Tina) — 80 UN                   │     │  │
│  │  │  Rack A01 > Fila 3, Columna 3                  │     │  │
│  │  │  Estado: 🟡 Reservada (30 UN para SO-2026-0045)│     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Mini Vista 3D ──────────────────────────────────────────┐  │
│  │ [Vista 3D del almacén con las posiciones del lote        │  │
│  │  resaltadas en color — usando el componente warehouse-3d │  │
│  │  filtrado a mostrar solo las posiciones de este lote]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Historial de Movimientos ────────────────────────────────┐ │
│  │ 01/03/2026 — Entrada de mercancía (GR-2026-0045)         │ │
│  │ 15/03/2026 — Salida parcial: 20 UN (GI-2026-0012)        │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Pestaña "Lotes" — Enfocada en Vencimientos

Mantiene el enfoque actual en vencimientos pero vinculado siempre a material:

```
Filtros: [Todos ▼] [Próximos a vencer ▼] [Buscar material...]

Tabla:
| Material          | Lote               | Cantidad | Vence      | Estado    | Almacén        |
|-------------------|---------------------|----------|------------|-----------|----------------|
| Motor Eléctrico   | LOT-20260301-002   | 180 UN   | 2027-03-01 | 🟡 89 días| Central        |
| Rodamiento SKF    | LOT-20260115-015   | 120 UN   | 2026-06-15 | 🔴 Vencido| Central        |
| Filtro de Aire    | LOT-20260220-003   | 50 UN    | 2026-05-20 | 🟠 45 días| Cross-Docking  |

→ Click en fila → Abre perfil detallado del lote (§3.2)
```

### 3.4 Correcciones Visuales

- **Fondo transparente en Operaciones y otras tabs**: Asegurar que todos los contenedores tengan `bg-[var(--bg-surface)]` y bordes sólidos, sin transparencias no intencionadas.
- **Consistencia de cards**: Todas las cards deben usar el mismo patrón visual.
- **Movimientos sin códigos SAP**: Cambiar "Mov. SAP 261" → "Salida por pedido de venta".
- **Inventario Físico**: Guiado por posición, el sistema indica al operador qué posición contar, qué debería haber, y captura lo que realmente hay.

---

## 4. FUNCIONES RPC NUEVAS

```sql
-- Obtener stock WM jerárquico por material
wms_get_stock_hierarchy(p_org_id, p_warehouse_id?)
→ Material → Lotes → UAs con posiciones

-- AI Picking Proposal
wms_ai_picking_proposal(p_org_id, p_warehouse_id, p_product_id, p_quantity, p_strategy)
→ Lista ordenada de UAs recomendadas con justificación

-- AI Transfer Suggestion
wms_ai_transfer_suggestion(p_org_id, p_product_id, p_from_warehouse_id, p_to_warehouse_id)
→ Mejor UA origen + mejor posición destino con justificación

-- Crear UA con auto-código
wms_create_storage_unit(p_org_id, p_su_type, p_warehouse_id, p_position_id, p_product_id, p_lot_id, p_quantity)
→ Crea UA con código auto-generado UA-XXXXXX

-- Reservar cantidad en UA
wms_reserve_from_su(p_storage_unit_id, p_quantity, p_reference_type, p_reference_id)
→ Crea reserva parcial, actualiza reserved_quantity

-- Auto-generar lote
wms_auto_generate_lot(p_org_id, p_product_id, p_vendor_id?, p_expiry?, p_quantity)
→ Crea lot_tracking con número auto-generado LOT-YYYYMMDD-SEQ

-- Sugerir distribución de UAs para entrada
wms_suggest_su_distribution(p_product_id, p_quantity)
→ Sugerencia: "1 palet (500 UN) + 1 tina (100 UN)" basado en cantidad
```

---

## 5. DATOS SINTÉTICOS

Generar para la demo:
- **~80 Unidades de Almacén** distribuidas en los 5 almacenes
- Vincular cada UA a un producto + lote existente
- Mezcla de tipos: ~30% palets, ~50% tinas, ~15% cajas, ~5% contenedores
- Algunas UAs con reservas activas
- Algunas UAs en estado 'picking' o 'in_transit'
- Todos los lotes existentes deben tener al menos 1 UA

---

## 6. PRIORIZACIÓN DE EJECUCIÓN

### Fase 1 — Infraestructura (DB + Datos)
1. Migración: crear tabla `storage_units`
2. Migración: crear tabla `storage_unit_reservations`
3. Migración: modificar tablas existentes (alt columns)
4. Crear funciones RPC
5. Generar datos sintéticos (UAs vinculadas a productos+lotes existentes)
6. RLS policies

### Fase 2 — Backend (Server Actions + API Routes)
7. Server action: `wms_create_storage_unit`
8. Server action: `wms_reserve_from_su`
9. Server action: `wms_auto_generate_lot`
10. API route: `wms_ai_picking_proposal`
11. API route: `wms_ai_transfer_suggestion`
12. API route: `wms_suggest_su_distribution`

### Fase 3 — Frontend (Componentes)
13. Vista jerárquica de inventario (nueva)
14. Perfil detallado de lote (con mini 3D)
15. Actualizar Goods Receipt Wizard (lote auto + UA)
16. Actualizar Goods Issue Wizard (picking con UA)
17. Actualizar Transfer Wizard (2 pasos + IA)
18. Corregir fondos transparentes
19. Eliminar códigos SAP de toda la UI
20. Actualizar pestaña de Lotes (vinculación material)
21. Inventario físico guiado por posición

### Fase 4 — Testing
22. Verificar todos los flujos end-to-end
23. Verificar visual en múltiples tamaños de pantalla
