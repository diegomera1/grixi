# 02 — Modelo de Datos WMS

## 2.1 Diagrama Entidad-Relación

```
┌─────────────────┐       ┌──────────────────┐       ┌────────────────────┐
│   warehouses    │───┐   │  purchase_orders │───┐   │     vendors       │
│                 │   │   │                  │   │   │                   │
│ id              │   │   │ id               │   │   │ id                │
│ org_id          │   │   │ po_number        │◀──┼───│ name              │
│ name            │   │   │ vendor_id ───────┼───┘   │ sap_vendor_code   │
│ type            │   │   │ warehouse_id ────┼───┐   └────────────────────┘
│ sap_plant_code★ │   │   │ status           │   │
│ sap_sloc_code★  │   │   │ sap_po_number    │   │
└─────┬───────────┘   │   └────────┬─────────┘   │
      │               │            │              │
      │    ┌──────────┘            │              │
      │    │                       │              │
      ▼    │    ┌──────────────────▼──────┐       │
┌─────────────┐ │  purchase_order_items   │       │
│    racks    │ │                          │       │
│             │ │ id                       │       │
│ id          │ │ po_id                    │       │
│ warehouse_id│ │ material_code            │       │
│ code        │ │ quantity                 │       │
│ aisle       │ │ received_quantity        │       │
│ position_x  │ │ warehouse_id ────────────┼───────┘
│ position_y  │ └──────────────────────────┘
│ position_z  │
└─────┬───────┘
      │
      ▼
┌──────────────────┐     ┌──────────────────────────┐
│  rack_positions  │     │     inventory            │
│                  │     │                          │
│ id               │◀────│ position_id              │
│ rack_id          │     │ product_id               │
│ row_number       │     │ lot_number               │
│ column_number    │     │ quantity                 │
│ status           │     │ vendor_id                │
│ max_weight       │     │ po_id                    │
│ reserved_for★    │     │ gr_id★                   │
└──────────────────┘     └──────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────┐
│     goods_receipts       │     │   goods_receipt_items    │
│                          │     │                          │
│ id                       │◀────│ receipt_id               │
│ receipt_number           │     │ po_item_id               │
│ po_id ──────────────────▶│     │ quantity_received        │
│ receiver_id              │     │ quantity_accepted        │
│ warehouse_id             │     │ quantity_rejected        │
│ status                   │     │ rack_code                │
│ sap_document_id          │     │ target_position_id★      │
│ movement_type★           │     │ lot_number★              │
└──────────────────────────┘     └──────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────┐
│    sales_orders★         │     │   sales_order_items★     │
│                          │     │                          │
│ id                       │◀────│ sale_order_id            │
│ org_id                   │     │ product_id               │
│ so_number                │     │ quantity                 │
│ customer_name            │     │ quantity_picked          │
│ customer_code            │     │ quantity_shipped         │
│ status                   │     │ warehouse_id             │
│ warehouse_id             │     │ unit_price               │
│ requested_delivery_date  │     │ total_price              │
│ sap_so_number            │     └──────────────────────────┘
│ priority                 │
│ total                    │
│ created_at               │
└──────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────┐
│    goods_issues★         │     │   goods_issue_items★     │
│                          │     │                          │
│ id                       │◀────│ issue_id                 │
│ org_id                   │     │ product_id               │
│ issue_number             │     │ quantity_issued           │
│ issue_type               │     │ source_position_id       │
│ reference_type           │     │ lot_number               │
│ reference_id             │     │ inventory_id             │
│ warehouse_id             │     └──────────────────────────┘
│ issued_by                │
│ status                   │
│ movement_type            │
│ sap_document_id          │
│ created_at               │
└──────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────┐
│  transfer_orders★        │     │  transfer_order_items★   │
│                          │     │                          │
│ id                       │◀────│ transfer_id              │
│ org_id                   │     │ product_id               │
│ transfer_number          │     │ quantity                 │
│ transfer_type            │     │ from_position_id         │
│ from_warehouse_id        │     │ to_position_id           │
│ to_warehouse_id          │     │ inventory_id             │
│ requested_by             │     │ status                   │
│ status                   │     └──────────────────────────┘
│ movement_type            │
│ priority                 │
│ sap_document_id          │
│ created_at               │
└──────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────┐
│  physical_counts★        │     │  physical_count_items★   │
│                          │     │                          │
│ id                       │◀────│ count_id                 │
│ org_id                   │     │ position_id              │
│ count_number             │     │ product_id               │
│ warehouse_id             │     │ system_quantity           │
│ count_type               │     │ counted_quantity          │
│ status                   │     │ variance                 │
│ counted_by               │     │ status                   │
│ start_date               │     │ adjustment_posted        │
│ end_date                 │     └──────────────────────────┘
│ total_positions          │
│ counted_positions        │
│ variance_count           │
│ sap_document_id          │
└──────────────────────────┘

┌──────────────────────────┐
│  inventory_movements     │  ← YA EXISTE, SE EXPANDE
│  (tabla central audit)   │
│                          │
│ id                       │
│ org_id                   │
│ product_id               │
│ from_position_id         │
│ to_position_id           │
│ quantity                 │
│ movement_type            │  ← Expandir con todos los mov. SAP
│ sap_movement_type★       │  ← Código SAP (101, 201, 311...)
│ reference_type★          │  ← 'goods_receipt', 'goods_issue', etc.
│ reference_id★            │  ← UUID del documento
│ reference_number★        │  ← Número visible (GR-2026-0001)
│ performed_by             │
│ notes★                   │
│ reversed★                │  ← Si fue anulado
│ reversal_of★             │  ← Referencia al mov. original
│ created_at               │
└──────────────────────────┘
```

> ★ = Campo/Tabla nueva a crear

---

## 2.2 Tablas Nuevas — Detalle

### `sales_orders`
```sql
CREATE TABLE public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    so_number VARCHAR NOT NULL,
    customer_name TEXT NOT NULL,
    customer_code VARCHAR,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'picking', 'partially_shipped', 'shipped', 'delivered', 'cancelled')),
    warehouse_id UUID REFERENCES public.warehouses(id),
    requested_delivery_date DATE,
    actual_ship_date DATE,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    currency VARCHAR DEFAULT 'USD',
    priority TEXT DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    shipping_address TEXT,
    sap_so_number VARCHAR,
    sap_delivery_number VARCHAR,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `sales_order_items`
```sql
CREATE TABLE public.sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    item_number INTEGER NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id),
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    quantity_picked NUMERIC DEFAULT 0,
    quantity_shipped NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'UN',
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC,
    warehouse_id UUID REFERENCES public.warehouses(id),
    sap_material_number VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `goods_issues`
```sql
CREATE TABLE public.goods_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    issue_number VARCHAR NOT NULL,
    issue_type TEXT NOT NULL DEFAULT 'sales_order'
        CHECK (issue_type IN ('sales_order', 'cost_center', 'production_order', 'scrap', 'manual')),
    reference_type TEXT,                    -- 'sales_order', 'work_order', etc.
    reference_id UUID,                      -- FK al documento origen
    reference_number VARCHAR,               -- Número visible del doc
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    issued_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'picking', 'confirmed', 'posted', 'cancelled', 'reversed')),
    movement_type VARCHAR DEFAULT '201',    -- SAP movement type
    sap_document_id VARCHAR,
    notes TEXT,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `goods_issue_items`
```sql
CREATE TABLE public.goods_issue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.goods_issues(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity_requested NUMERIC NOT NULL,
    quantity_issued NUMERIC DEFAULT 0,
    source_position_id UUID REFERENCES public.rack_positions(id),
    inventory_id UUID REFERENCES public.inventory(id),
    lot_number TEXT,
    unit TEXT DEFAULT 'UN',
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'picked', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `transfer_orders`
```sql
CREATE TABLE public.transfer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    transfer_number VARCHAR NOT NULL,
    transfer_type TEXT NOT NULL DEFAULT 'internal'
        CHECK (transfer_type IN ('internal', 'cross_warehouse', 'reslotting', 'consolidation')),
    from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    confirmed_by UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'confirmed', 'posted', 'cancelled', 'reversed')),
    movement_type VARCHAR DEFAULT '311',    -- 311 = same plant, 301 = cross plant
    priority TEXT DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    sap_document_id VARCHAR,
    reason TEXT,
    notes TEXT,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `transfer_order_items`
```sql
CREATE TABLE public.transfer_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.transfer_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    inventory_id UUID REFERENCES public.inventory(id),
    quantity NUMERIC NOT NULL,
    from_position_id UUID NOT NULL REFERENCES public.rack_positions(id),
    to_position_id UUID NOT NULL REFERENCES public.rack_positions(id),
    lot_number TEXT,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_transit', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `physical_counts`
```sql
CREATE TABLE public.physical_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    count_number VARCHAR NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    count_type TEXT NOT NULL DEFAULT 'cycle'
        CHECK (count_type IN ('cycle', 'annual', 'spot', 'abc')),
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'in_progress', 'completed', 'posted', 'cancelled')),
    counted_by UUID REFERENCES auth.users(id),
    supervised_by UUID REFERENCES auth.users(id),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    total_positions INTEGER DEFAULT 0,
    counted_positions INTEGER DEFAULT 0,
    variance_count INTEGER DEFAULT 0,
    total_variance_value NUMERIC DEFAULT 0,
    sap_document_id VARCHAR,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `physical_count_items`
```sql
CREATE TABLE public.physical_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id UUID NOT NULL REFERENCES public.physical_counts(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.rack_positions(id),
    product_id UUID REFERENCES public.products(id),
    system_quantity NUMERIC NOT NULL DEFAULT 0,
    counted_quantity NUMERIC,
    variance NUMERIC GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - system_quantity) STORED,
    variance_value NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'counted', 'recounted', 'adjusted', 'skipped')),
    adjustment_posted BOOLEAN DEFAULT false,
    counted_at TIMESTAMPTZ,
    notes TEXT
);
```

---

## 2.3 Modificaciones a Tablas Existentes

### `warehouses` — Agregar campos SAP
```sql
ALTER TABLE public.warehouses
    ADD COLUMN IF NOT EXISTS sap_plant_code VARCHAR(4),
    ADD COLUMN IF NOT EXISTS sap_storage_location VARCHAR(4),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS capacity_total INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS capacity_used INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manager_name TEXT;
```

### `rack_positions` — Agregar reservación
```sql
ALTER TABLE public.rack_positions
    ADD COLUMN IF NOT EXISTS reserved_for UUID,  -- reference to incoming GR
    ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_movement_at TIMESTAMPTZ;
```

### `inventory` — Agregar referencia a GR
```sql
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS gr_id UUID REFERENCES public.goods_receipts(id),
    ADD COLUMN IF NOT EXISTS gi_id UUID,  -- goods issue reference
    ADD COLUMN IF NOT EXISTS movement_type VARCHAR;
```

### `inventory_movements` — Expandir para audit trail completo
```sql
ALTER TABLE public.inventory_movements
    ADD COLUMN IF NOT EXISTS sap_movement_type VARCHAR(3),
    ADD COLUMN IF NOT EXISTS reference_type TEXT,
    ADD COLUMN IF NOT EXISTS reference_id UUID,
    ADD COLUMN IF NOT EXISTS reference_number VARCHAR,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS reversed BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES public.inventory_movements(id);
```

### `goods_receipts` — Agregar campos
```sql
ALTER TABLE public.goods_receipts
    ADD COLUMN IF NOT EXISTS movement_type VARCHAR(3) DEFAULT '101',
    ADD COLUMN IF NOT EXISTS delivery_note VARCHAR,
    ADD COLUMN IF NOT EXISTS carrier TEXT,
    ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR,
    ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accepted_items INTEGER DEFAULT 0;
```

### `goods_receipt_items` — Agregar target position
```sql
ALTER TABLE public.goods_receipt_items
    ADD COLUMN IF NOT EXISTS target_position_id UUID REFERENCES public.rack_positions(id),
    ADD COLUMN IF NOT EXISTS lot_number TEXT,
    ADD COLUMN IF NOT EXISTS batch_code TEXT,
    ADD COLUMN IF NOT EXISTS expiry_date DATE;
```

---

## 2.4 Índices Requeridos

```sql
-- Sales Orders
CREATE INDEX idx_sales_orders_org_id ON public.sales_orders(org_id);
CREATE INDEX idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX idx_sales_orders_warehouse ON public.sales_orders(warehouse_id);
CREATE INDEX idx_sales_order_items_so ON public.sales_order_items(sale_order_id);

-- Goods Issues
CREATE INDEX idx_goods_issues_org_id ON public.goods_issues(org_id);
CREATE INDEX idx_goods_issues_status ON public.goods_issues(status);
CREATE INDEX idx_goods_issues_warehouse ON public.goods_issues(warehouse_id);
CREATE INDEX idx_goods_issue_items_issue ON public.goods_issue_items(issue_id);

-- Transfer Orders
CREATE INDEX idx_transfer_orders_org_id ON public.transfer_orders(org_id);
CREATE INDEX idx_transfer_orders_status ON public.transfer_orders(status);
CREATE INDEX idx_transfer_order_items_transfer ON public.transfer_order_items(transfer_id);

-- Physical Counts
CREATE INDEX idx_physical_counts_org_id ON public.physical_counts(org_id);
CREATE INDEX idx_physical_counts_warehouse ON public.physical_counts(warehouse_id);
CREATE INDEX idx_physical_count_items_count ON public.physical_count_items(count_id);

-- inventory_movements expansion
CREATE INDEX idx_inv_movements_sap_type ON public.inventory_movements(sap_movement_type);
CREATE INDEX idx_inv_movements_ref ON public.inventory_movements(reference_type, reference_id);
```

---

## 2.5 RLS Policies

Todas las tablas nuevas seguirán el patrón existente:

```sql
-- Pattern for every new table
ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table_name}_org_access" ON public.{table_name}
    FOR ALL USING (
        org_id IN (
            SELECT om.org_id FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );
```

---

## 2.6 Funciones RPC Requeridas

| Función | Parámetros | Descripción |
|---------|-----------|-------------|
| `wms_post_goods_receipt` | receipt_id, items[] | Transacción: crea inventory, actualiza posiciones, genera movimientos |
| `wms_post_goods_issue` | issue_id, items[] | Transacción: reduce inventory, libera posiciones, genera movimientos |
| `wms_post_transfer` | transfer_id, items[] | Transacción: mueve de position A a B, genera movimientos |
| `wms_post_count_adjustment` | count_id | Transacción: ajusta inventory basado en diferencias del conteo |
| `wms_get_available_positions` | warehouse_id, product_id? | Retorna posiciones disponibles para putaway |
| `wms_get_stock_by_product` | warehouse_id, product_id | Stock actual por ubicación para un producto |
| `wms_get_dashboard_kpis` | org_id, warehouse_id? | KPIs agregados del dashboard |
| `wms_generate_document_number` | doc_type, org_id | Genera siguiente número secuencial (GR-2026-0052) |
| `wms_suggest_putaway_position` | warehouse_id, product_id, qty | Algoritmo de ubicación sugerida según estrategia activa |
| `wms_reverse_movement` | movement_id | Reversar un movimiento (genera mov. contrario) |
| `wms_get_picking_sources` | warehouse_id, product_id, strategy | FIFO/FEFO/Consolidación — retorna posiciones óptimas |
| `wms_get_abc_analysis` | org_id, days | Clasificación ABC por valor de movimiento |
| `wms_get_stock_projection` | org_id, product_id, days | Proyección de stock basado en consumo promedio |
| `wms_get_dead_stock` | org_id, days_threshold | Productos sin movimiento en N días |
| `wms_get_efficiency_metrics` | org_id, warehouse_id? | Dock-to-stock, picking time, accuracy |
| `wms_get_lot_expiry_report` | org_id, days_ahead | Lotes por vencer agrupados por urgencia |
| `wms_get_movement_trends` | org_id, days | Tendencias diarias por tipo |
| `wms_get_warehouse_utilization` | org_id, days | Timeline de ocupación histórica |
| `wms_get_pending_operations` | org_id | Operaciones pendientes contadas por tipo |
| `wms_get_low_stock_products` | org_id | Productos bajo mínimo de stock |

---

## 2.7 Tablas Adicionales — Estrategias, Lotes e IA

### `warehouse_strategies` — Configuración de estrategias por almacén

```sql
CREATE TABLE public.warehouse_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    strategy_type TEXT NOT NULL
        CHECK (strategy_type IN ('putaway', 'picking', 'transfer', 'replenishment')),
    strategy_code TEXT NOT NULL,
    -- putaway: 'fifo_putaway', 'fixed_slot', 'zone_category', 'weight_volume', 'proximity', 'random_available'
    -- picking: 'fifo', 'lifo', 'fefo', 'oldest_lot', 'min_movement', 'consolidate'
    -- transfer: 'reslotting_abc', 'consolidation', 'balancing', 'replenishment'
    priority INTEGER DEFAULT 1,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(warehouse_id, strategy_type, strategy_code)
);

-- Ver 15-ESTRATEGIAS-ALMACEN.md para detalle completo de config JSONB y algoritmos
```

### `lot_tracking` — Control de lotes con características especiales

```sql
CREATE TABLE public.lot_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    lot_number VARCHAR NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id),
    batch_code VARCHAR,
    manufacturing_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'quarantine', 'expired', 'recalled', 'consumed')),
    -- Características especiales (ver 15-ESTRATEGIAS-ALMACEN.md §15.5)
    characteristics JSONB DEFAULT '{}',
    -- Ejemplo: {"temperature_range": "2-8°C", "hazard_class": "3",
    --           "certification": "ISO-9001", "origin_country": "DE",
    --           "msds_required": true, "humidity_sensitive": false}
    vendor_id UUID REFERENCES public.vendors(id),
    po_number VARCHAR,
    gr_number VARCHAR,
    total_quantity NUMERIC DEFAULT 0,
    remaining_quantity NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lot_tracking_org ON lot_tracking(org_id);
CREATE INDEX idx_lot_tracking_product ON lot_tracking(product_id);
CREATE INDEX idx_lot_tracking_expiry ON lot_tracking(expiry_date);
CREATE INDEX idx_lot_tracking_status ON lot_tracking(status);
CREATE INDEX idx_lot_tracking_lot_number ON lot_tracking(lot_number);
```

### `wms_ai_insights` — Cache de insights generados por IA

```sql
CREATE TABLE public.wms_ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    warehouse_id UUID REFERENCES public.warehouses(id),
    insight_type TEXT NOT NULL
        CHECK (insight_type IN ('prediction', 'optimization', 'warning', 'info', 'report')),
    severity TEXT DEFAULT 'low'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',        -- Datos estructurados del insight
    action JSONB DEFAULT '{}',      -- Acción sugerida con tipo y params
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,         -- Auto-expira si ya no es relevante
    generated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wms_ai_insights_org ON wms_ai_insights(org_id);
CREATE INDEX idx_wms_ai_insights_type ON wms_ai_insights(insight_type);
CREATE INDEX idx_wms_ai_insights_active ON wms_ai_insights(org_id, is_dismissed, expires_at);
```

### Índices para `warehouse_strategies`

```sql
CREATE INDEX idx_warehouse_strategies_org ON warehouse_strategies(org_id);
CREATE INDEX idx_warehouse_strategies_warehouse ON warehouse_strategies(warehouse_id);
CREATE INDEX idx_warehouse_strategies_active ON warehouse_strategies(warehouse_id, strategy_type, is_active);
```

