# 15 — Estrategias de Almacenamiento, Picking y Control de Lotes

## 15.1 Visión

Las **estrategias** son el cerebro logístico del WMS. Definen las reglas automáticas para:
- **¿Dónde guardar?** (Estrategia de Almacenamiento / Putaway)
- **¿De dónde sacar?** (Estrategia de Picking / Consumo)
- **¿Cómo mover?** (Estrategia de Transferencia)
- **¿Cómo controlar?** (Gestión de Lotes y Características Especiales)

Cada almacén puede tener su propia configuración de estrategias. GRIXI las presenta como **procesos visuales**, no como códigos numéricos.

---

## 15.2 Estrategias de Almacenamiento (Putaway)

### ¿Qué resuelve?
Determina automáticamente la **mejor posición** para almacenar mercancía entrante.

### Estrategias Soportadas

| Estrategia | Código | Lógica | Caso de uso |
|-----------|--------|--------|-------------|
| **FIFO Putaway** | `fifo_putaway` | Asignar posición que mantenga la estructura FIFO del producto | Default — productos estándar |
| **Producto Fijo** | `fixed_slot` | Cada SKU tiene posiciones pre-asignadas (dedicated slots) | Productos de alta rotación (ABC-A) |
| **Zona por Categoría** | `zone_category` | Asignar por zona según categoría del producto | Químicos → Zona Q, Alimentos → Zona F |
| **Peso/Volumen** | `weight_volume` | Pesados abajo, livianos arriba | Seguridad ergonómica |
| **Proximidad** | `proximity` | Cerca de la zona de despacho para alta rotación | Optimizar picking |
| **Random** | `random_available` | Primera posición libre disponible | Cuando no importa la ubicación |

### Modelo de Datos: Configuración de Estrategia por Almacén

```sql
-- Tabla de configuración de estrategias por almacén
CREATE TABLE public.warehouse_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    strategy_type TEXT NOT NULL 
        CHECK (strategy_type IN ('putaway', 'picking', 'transfer', 'replenishment')),
    strategy_code TEXT NOT NULL,
    priority INTEGER DEFAULT 1,  -- Si hay múltiples, cuál evaluar primero
    config JSONB DEFAULT '{}',   -- Parámetros específicos
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(warehouse_id, strategy_type, strategy_code)
);
```

### Ejemplo de Config JSONB:

```json
// Putaway: Zona por Categoría
{
  "zones": {
    "mecanicos": { "aisles": ["A", "B"], "priority": 1 },
    "hidraulicos": { "aisles": ["C"], "priority": 2 },
    "quimicos": { "aisles": ["D"], "priority": 1, "requires_ventilation": true },
    "electricos": { "aisles": ["E"], "priority": 1 },
    "alimentos": { "aisles": ["CF"], "priority": 1, "requires_cold": true }
  },
  "fallback": "random_available",
  "prefer_lower_levels": true,
  "max_weight_check": true
}
```

### Algoritmo de Putaway (RPC)

```sql
CREATE OR REPLACE FUNCTION wms_suggest_putaway(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_quantity NUMERIC,
    p_lot_characteristics JSONB DEFAULT '{}'
) RETURNS TABLE (
    position_id UUID,
    rack_code TEXT,
    position_label TEXT,
    score INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_strategy RECORD;
    v_product RECORD;
    v_weight NUMERIC;
BEGIN
    -- 1. Obtener producto y sus características
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    v_weight := COALESCE(v_product.unit_weight, 0) * p_quantity;

    -- 2. Obtener estrategia activa del almacén
    SELECT * INTO v_strategy FROM warehouse_strategies
    WHERE warehouse_id = p_warehouse_id
      AND strategy_type = 'putaway'
      AND is_active = true
    ORDER BY priority ASC LIMIT 1;

    -- 3. Evaluar según estrategia
    CASE v_strategy.strategy_code
        WHEN 'fixed_slot' THEN
            -- Buscar posiciones dedicadas al producto
            RETURN QUERY
            SELECT rp.id, r.code, 
                   r.code || '-' || rp.row_number || '-' || rp.column_number,
                   100 as score,
                   'Posición fija asignada' as reason
            FROM rack_positions rp
            JOIN racks r ON rp.rack_id = r.id
            WHERE r.warehouse_id = p_warehouse_id
              AND rp.status = 'available'
              AND rp.dedicated_product_id = p_product_id
            ORDER BY rp.row_number ASC
            LIMIT 5;

        WHEN 'zone_category' THEN
            -- Buscar en zona de la categoría del producto
            RETURN QUERY
            SELECT rp.id, r.code,
                   r.code || '-' || rp.row_number || '-' || rp.column_number,
                   CASE 
                     WHEN r.aisle = ANY(zone_aisles) THEN 90
                     ELSE 30
                   END as score,
                   CASE
                     WHEN r.aisle = ANY(zone_aisles) THEN 'Zona de categoría correcta'
                     ELSE 'Zona alternativa (fallback)'
                   END as reason
            FROM rack_positions rp
            JOIN racks r ON rp.rack_id = r.id
            WHERE r.warehouse_id = p_warehouse_id
              AND rp.status = 'available'
              AND (rp.max_weight IS NULL OR rp.max_weight >= v_weight)
            ORDER BY score DESC, rp.row_number ASC
            LIMIT 5;

        WHEN 'weight_volume' THEN
            -- Pesados abajo (row 1-2), livianos arriba (row 3+)
            RETURN QUERY
            SELECT rp.id, r.code,
                   r.code || '-' || rp.row_number || '-' || rp.column_number,
                   CASE 
                     WHEN v_weight > 500 AND rp.row_number <= 2 THEN 95
                     WHEN v_weight <= 500 AND rp.row_number >= 3 THEN 90
                     ELSE 50
                   END as score,
                   CASE 
                     WHEN v_weight > 500 THEN 'Nivel bajo para carga pesada'
                     ELSE 'Nivel superior para carga liviana'
                   END as reason
            FROM rack_positions rp
            JOIN racks r ON rp.rack_id = r.id
            WHERE r.warehouse_id = p_warehouse_id
              AND rp.status = 'available'
              AND (rp.max_weight IS NULL OR rp.max_weight >= v_weight)
            ORDER BY score DESC
            LIMIT 5;

        ELSE  -- Default: proximity / random
            RETURN QUERY
            SELECT rp.id, r.code,
                   r.code || '-' || rp.row_number || '-' || rp.column_number,
                   50 as score,
                   'Primera posición disponible' as reason
            FROM rack_positions rp
            JOIN racks r ON rp.rack_id = r.id
            WHERE r.warehouse_id = p_warehouse_id
              AND rp.status = 'available'
              AND (rp.max_weight IS NULL OR rp.max_weight >= v_weight)
            ORDER BY r.position_x ASC, rp.row_number ASC
            LIMIT 5;
    END CASE;
END;
$$ LANGUAGE plpgsql;
```

### UI: Panel de Sugerencia de Putaway

```
┌─ Sugerencia de Ubicación — Rodamiento SKF 6205 (100 UN) ────────┐
│                                                                   │
│  Estrategia activa: 🔵 Zona por Categoría (zone_category)       │
│  Categoría: Mecánicos → Zona A-B                                 │
│                                                                   │
│  ┌─ Posiciones Sugeridas ─────────────────────────────────────┐  │
│  │ # │ Posición │ Score │ Razón                     │ Acción  │  │
│  │ 1 │ A01-3-2  │ ⭐ 95 │ Zona correcta + prod.sim. │ [✓ Sel] │  │
│  │ 2 │ A02-1-4  │ ⭐ 90 │ Zona correcta             │ [  Sel] │  │
│  │ 3 │ B01-2-1  │ ⭐ 85 │ Zona correcta, nivel bajo │ [  Sel] │  │
│  │ 4 │ C03-4-2  │ ⭐ 30 │ Zona alternativa          │ [  Sel] │  │
│  │ 5 │ D01-1-3  │ ⭐ 30 │ Zona alternativa          │ [  Sel] │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [📍 Selección Manual]  [🔄 Cambiar Estrategia]                 │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.3 Estrategias de Picking / Consumo

### ¿Qué resuelve?
Determina de **cuáles posiciones** sacar mercancía cuando hay stock del mismo producto en múltiples ubicaciones.

### Estrategias Soportadas

| Estrategia | Código | Lógica | Caso de uso |
|-----------|--------|--------|-------------|
| **FIFO** | `fifo` | Primero en entrar, primero en salir (por `entry_date`) | **Default** — productos perecederos, trazabilidad |
| **LIFO** | `lifo` | Último en entrar, primero en salir | Materiales a granel no perecederos |
| **FEFO** | `fefo` | Primero en expirar, primero en salir (por `expiry_date`) | Alimentos, químicos, medicamentos |
| **Lote Más Antiguo** | `oldest_lot` | Priorizar el lote con número más bajo | Gestión estricta de lotes |
| **Mínimo Movimiento** | `min_movement` | Sacar de la posición más cercana al dock | Eficiencia operativa |
| **Consolidación** | `consolidate` | Vaciar primero las posiciones con menos stock | Liberar espacio |

### Diagrama: FIFO vs FEFO vs Consolidación

```
Inventario de "Aceite Hidráulico SAE 68" en 3 posiciones:

┌─────────────┬───────────────┬──────────┬────────────┬──────────┐
│ Posición    │ Lote          │ Cantidad │ Ingreso    │ Vence    │
├─────────────┼───────────────┼──────────┼────────────┼──────────┤
│ A02-4-2     │ LOT-20260115  │ 30 L     │ 15/01/2026 │ 15/07/26 │
│ B01-1-3     │ LOT-20260220  │ 15 L     │ 20/02/2026 │ 20/06/26 │ ← Vence antes
│ C03-2-1     │ LOT-20260310  │ 50 L     │ 10/03/2026 │ 10/09/26 │
└─────────────┴───────────────┴──────────┴────────────┴──────────┘

Pedido: 40 L de Aceite Hidráulico SAE 68

FIFO resuelve:                    FEFO resuelve:
├── A02-4-2: 30 L (ene 15)       ├── B01-1-3: 15 L (vence jun 20)
└── B01-1-3: 10 L (feb 20)       └── A02-4-2: 25 L (vence jul 15)

Consolidación resuelve:
├── B01-1-3: 15 L (vacía posición)
└── A02-4-2: 25 L
```

### UI en el Flujo de Salida

```
┌─ Auto-Localización — Motor Eléctrico 5HP ─────────────────────┐
│                                                                 │
│  Estrategia: 🟢 FIFO (First In, First Out)     [Cambiar ▼]    │
│  Solicitado: 20 UN                                              │
│                                                                 │
│  ┌─ Fuentes Seleccionadas ────────────────────────────────────┐│
│  │ # │ Posición │ Lote          │ Ingreso    │ Cant.│ Parcial ││
│  │ 1 │ B02-1-4  │ LOT-20260215  │ 15/02/2026 │ 15   │ 15 ✅  ││
│  │ 2 │ A01-2-3  │ LOT-20260301  │ 01/03/2026 │  85  │  5 ✅  ││
│  │   │          │               │     Total:  │      │ 20     ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ℹ️  FIFO: Lote LOT-20260215 se consume primero (más antiguo) │
│                                                                 │
│  Estrategias alternativas:                                      │
│  ├── FEFO: Mismo resultado (ningún lote tiene fecha vence)      │
│  ├── Consolidación: B02-1-4 (15) + A01-2-3 (5) — vacía B02   │
│  └── Mín. Movimiento: A01-2-3 (20) — más cerca del dock       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15.4 Estrategias de Transferencia

### Motivos de Transferencia (como proceso)

| Proceso | Descripción | Disparador |
|---------|-------------|-----------|
| **Reslotting ABC** | Reorganizar según clasificación ABC | Manual o IA sugiere |
| **Consolidación** | Juntar parciales del mismo producto | Automático post-conteo |
| **Balanceo** | Equilibrar stock entre almacenes por demanda | IA detecta desbalance |
| **Reposición** | Mover de bulk storage a zona de picking | Cuando pick-zone < mínimo |
| **Cuarentena** | Mover a zona de inspección/hold | Alerta de calidad o vencimiento |
| **Cross-Docking** | Mover directo de recepción a despacho | OC urgente con SO pendiente |

---

## 15.5 Control de Lotes y Características Especiales

### Modelo de Datos: Lotes

```sql
-- Tabla dedicada de lotes (si el mismo lote tiene múltiples posiciones)
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
    -- Características especiales
    characteristics JSONB DEFAULT '{}',
    -- Ejemplo: {"temperature_range": "2-8°C", "hazard_class": "3", 
    --           "certification": "ISO-9001", "origin_country": "DE"}
    vendor_id UUID REFERENCES public.vendors(id),
    po_number VARCHAR,
    gr_number VARCHAR,
    total_quantity NUMERIC DEFAULT 0,
    remaining_quantity NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lot_tracking_product ON lot_tracking(product_id);
CREATE INDEX idx_lot_tracking_expiry ON lot_tracking(expiry_date);
CREATE INDEX idx_lot_tracking_status ON lot_tracking(status);
```

### Tipos de Características Especiales

| Característica | Campo JSONB | Restricciones | Ejemplo |
|---------------|-------------|---------------|---------|
| **Temperatura** | `temperature_range` | Solo almacenar en racks con sensor de temp. | `"2-8°C"` → Cámara Fría |
| **Clase Peligrosa** | `hazard_class` | Separación mínima de otros materiales | `"3" (Inflamable)` |
| **Certificación** | `certification` | Requiere doc. adjunta | `"ISO-9001"` |
| **País Origen** | `origin_country` | Para trazabilidad | `"DE"`, `"CN"` |
| **MSDS** | `msds_required` | Hoja de seguridad obligatoria | `true` |
| **Peso Máximo** | `max_stack_height` | Límite de apilado | `3` |
| **Humedad** | `humidity_sensitive` | Requiere zona seca | `true` |
| **Fotosensible** | `light_sensitive` | Requiere almacenamiento oscuro | `true` |

### UI: Ficha de Lote

```
┌─ Lote LOT-20260401-042 ─────────────────────────────────────────┐
│                                                                   │
│  ┌─ Identificación ──────────────────────────────────────────┐   │
│  │ Producto: Aceite Hidráulico SAE 68                        │   │
│  │ Lote: LOT-20260401-042 | Batch: BCH-2026-089             │   │
│  │ Proveedor: QuimiTech Ecuador | OC: PO-2026-0089          │   │
│  │ Cantidad original: 200 L | Restante: 145 L               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Fechas ──────────────────────────────────────────────────┐   │
│  │ Fabricación: 15/03/2026                                    │   │
│  │ Ingreso: 01/04/2026                                       │   │
│  │ Vencimiento: 15/09/2026                                   │   │
│  │ Días restantes: 167 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 🟢               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Características Especiales ──────────────────────────────┐   │
│  │ 🌡️ Temperatura: Ambiente (15-30°C)                       │   │
│  │ ⚠️ Clase Peligrosa: 3 (Líquido Inflamable)               │   │
│  │ 📋 MSDS: Requerida ✅ (adjunta)                           │   │
│  │ 🔒 Certificación: ISO 9001:2015 ✅                        │   │
│  │ 🌍 Origen: Ecuador (EC)                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Ubicaciones Actuales ────────────────────────────────────┐   │
│  │ A02-4-2: 80 L | A02-4-3: 65 L                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Historial de Movimientos ────────────────────────────────┐   │
│  │ 01/04 📥 Entrada 200 L (GR-2026-0052)                    │   │
│  │ 01/04 📤 Salida 30 L CC-MTTO (GI-2026-CC-0015)           │   │
│  │ 01/04 🔄 Traspaso 25 L → A02-4-3 (TO-2026-0013)         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [🔄 Traspasar] [🔒 Cuarentena] [📊 Trazabilidad Completa]    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Alertas Automáticas de Lotes

```
┌─ Alertas de Lotes ───────────────────────────────────────────────┐
│                                                                   │
│  🔴 VENCIDOS (acción inmediata)                                  │
│  └── LOT-20260101-008: Guantes Nitrilo — venció hace 5 días     │
│      [Mover a Cuarentena] [Registrar Merma]                     │
│                                                                   │
│  🟡 PRÓXIMOS A VENCER (< 30 días)                               │
│  ├── LOT-20260115-042: Aceite Vegetal — vence 15/04 (14 días)   │
│  ├── LOT-20260120-089: Resina Epóxica — vence 20/04 (19 días)  │
│  └── LOT-20260125-103: Solvente — vence 25/04 (24 días)        │
│      [Priorizar Despacho] [Notificar Compras]                    │
│                                                                   │
│  🔵 EN CUARENTENA                                                │
│  └── LOT-20260310-055: Cemento Portland — inspección pendiente   │
│      [Liberar] [Rechazar]                                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.6 Configuración de Estrategias por Almacén (UI)

```
┌─ Configuración de Estrategias — Almacén Central ─────────────────┐
│                                                                   │
│  ┌─ Putaway (Almacenamiento) ────────────────────────────────┐   │
│  │ Estrategia primaria: [Zona por Categoría ▼]    🟢 Activa  │   │
│  │ Fallback: [Peso/Volumen ▼]                                │   │
│  │ ☑ Verificar peso máximo por posición                      │   │
│  │ ☑ Preferir niveles bajos para cargas pesadas              │   │
│  │ ☐ Permitir posiciones compartidas (multi-SKU)             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Picking (Consumo/Salida) ────────────────────────────────┐   │
│  │ Estrategia primaria: [FIFO ▼]                  🟢 Activa  │   │
│  │ Override para lotes con vencimiento: [FEFO ▼]             │   │
│  │ ☑ Mostrar alternativas al operador                        │   │
│  │ ☐ Permitir override manual                               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Transferencias ──────────────────────────────────────────┐   │
│  │ ☑ Reslotting por ABC                                      │   │
│  │ ☑ Consolidación automática post-conteo                    │   │
│  │ ☑ Alertar cuando zona de picking < mínimo                 │   │
│  │ ☐ Cross-docking automático                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Lotes ───────────────────────────────────────────────────┐   │
│  │ ☑ Control de lotes obligatorio                            │   │
│  │ ☑ FEFO override para productos con vencimiento            │   │
│  │ ☑ Alertar lotes próximos a vencer (días): [30]            │   │
│  │ ☑ Auto-cuarentena para lotes vencidos                     │   │
│  │ ☑ Validar separación de materiales peligrosos             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [Guardar Configuración]                                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.7 Tabla para Navegación — Sub-tab "Estrategias"

Agregar como sub-tab dentro de la configuración del almacén o como tab independiente:

```
Almacenes
├── Dashboard
├── Almacenes
│   └── Detalle Almacén → Configuración → Estrategias
├── Operaciones
│   ├── Entradas
│   ├── Salidas → Usa estrategia de Picking
│   ├── Traspasos → Usa estrategia de Transferencia
│   └── Conteos
├── Inventario → Vista de Lotes como sub-filtro
├── Movimientos
├── Lotes → Sub-tab dedicada con alertas de vencimiento
└── 3D
```
