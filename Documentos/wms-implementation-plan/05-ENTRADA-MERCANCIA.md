# 05 — Entrada de Mercancía (Goods Receipt)

## 5.1 Concepto

La Entrada de Mercancía es el proceso de **recibir materiales** en el almacén contra una Orden de Compra (OC) proveniente de SAP. Es el equivalente a la transacción **MIGO con movimiento tipo 101** en SAP.

En GRIXI, el flujo completo es:
1. SAP genera una OC → GRIXI la recibe (simulado, ya existe en `purchase_orders`)
2. El material llega físicamente al almacén
3. El operador selecciona la OC, verifica las cantidades y selecciona las ubicaciones
4. GRIXI registra la entrada, actualiza el inventario y opcionalmente envía confirmación a SAP

---

## 5.2 Flujo Paso a Paso

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ENTRADA DE MERCANCÍA                 │
│                                                                  │
│  ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐ │
│  │  PASO 1 │────▶│  PASO 2  │────▶│  PASO 3  │────▶│ PASO 4  │ │
│  │Seleccion│     │Verificar │     │ Asignar  │     │ Contab. │ │
│  │   OC    │     │Cantidades│     │Ubicación │     │(Posting)│ │
│  └─────────┘     └──────────┘     └──────────┘     └─────────┘ │
│       │                │                │                │      │
│       ▼                ▼                ▼                ▼      │
│  Pool de OCs     Comp. física     Rack/Pos libre   inv_movements│
│  sent/approved   vs. OC items     putaway suggest  rack_positions│
│                  qty check        quality flag      inventory    │
│                                                    goods_receipt│
└──────────────────────────────────────────────────────────────────┘
```

---

## 5.3 Paso 1: Selección de Orden de Compra

### UI: Panel de OCs Disponibles

El operador ve las OCs que están pendientes de recepción para el almacén seleccionado:

```
┌─ Seleccionar Orden de Compra ────────────────────────────────────┐
│                                                                  │
│  ┌─ Filtros ─────────────────────────────────────────────────┐  │
│  │ [Todas ▼] [Buscar por # OC o proveedor...] [Urgentes ☑]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ OCs Pendientes de Recepción (Almacén Central) ──────────────┐│
│  │                                                                ││
│  │  ┌────────────────────────────────────────────────────────┐   ││
│  │  │ 📋 PO-2026-0089         🟠 Urgente                    │   ││
│  │  │ Proveedor: MetalTech Ecuador                           │   ││
│  │  │ SAP: 4500012345                                        │   ││
│  │  │ Items: 4 materiales | Total: $12,450.00                │   ││
│  │  │ Entrega esperada: 01/04/2026 (hoy) ⚠️                 │   ││
│  │  │ [Seleccionar →]                                        │   ││
│  │  └────────────────────────────────────────────────────────┘   ││
│  │                                                                ││
│  │  ┌────────────────────────────────────────────────────────┐   ││
│  │  │ 📋 PO-2026-0087         🔵 Media                      │   ││
│  │  │ Proveedor: Suministros Quito S.A.                      │   ││
│  │  │ SAP: 4500012340                                        │   ││
│  │  │ Items: 3 materiales | Total: $8,920.00                 │   ││
│  │  │ Entrega esperada: 03/04/2026                           │   ││
│  │  │ Recibido parcial: 2/3 items ██████░░ 67%              │   ││
│  │  │ [Seleccionar →]                                        │   ││
│  │  └────────────────────────────────────────────────────────┘   ││
│  │                                                                ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                  │
│  💡 Solo se muestran OCs con status: 'sent', 'approved',        │
│     'partially_received' asignadas a este almacén                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Lógica de filtrado

```sql
-- OCs disponibles para recepción en un almacén
SELECT po.*, v.name as vendor_name, v.sap_vendor_code,
       COUNT(poi.id) as total_items,
       SUM(CASE WHEN poi.received_quantity < poi.quantity THEN 1 ELSE 0 END) as pending_items
FROM purchase_orders po
JOIN vendors v ON po.vendor_id = v.id
JOIN purchase_order_items poi ON poi.po_id = po.id
WHERE po.org_id = $1
  AND po.warehouse_id = $2
  AND po.status IN ('approved', 'sent', 'partially_received')
GROUP BY po.id, v.name, v.sap_vendor_code
HAVING SUM(CASE WHEN poi.received_quantity < poi.quantity THEN 1 ELSE 0 END) > 0
ORDER BY po.priority DESC, po.expected_delivery ASC;
```

---

## 5.4 Paso 2: Verificación de Cantidades

Después de seleccionar la OC, se muestra el formulario de verificación:

```
┌─ Entrada de Mercancía — PO-2026-0089 ───────────────────────────┐
│                                                                  │
│  ┌─ Header ──────────────────────────────────────────────────┐  │
│  │ Documento: GR-2026-0052 (auto-generado)                   │  │
│  │ Referencia: PO-2026-0089 | SAP: 4500012345                │  │
│  │ Proveedor: MetalTech Ecuador                               │  │
│  │ Movimiento SAP: 101 — Entrada contra OC                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Datos de Transporte ─────────────────────────────────────┐  │
│  │ Nota de Entrega: [________________]                        │  │
│  │ Transportista:   [________________]                        │  │
│  │ Placa Vehículo:  [________________]                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Ítems de la OC ─────────────────────────────────────────────┐│
│  │                                                                ││
│  │  Item 10 | MEC-BRD-001 — Rodamiento SKF 6205                 ││
│  │  ┌──────────┬──────────┬───────────┬──────────┬───────────┐  ││
│  │  │ Ordenado │ Ya Recib.│ Recibir   │ Aceptar  │ Rechazar  │  ││
│  │  │    100   │    0     │ [100    ] │ [100   ] │ [0     ]  │  ││
│  │  └──────────┴──────────┴───────────┴──────────┴───────────┘  ││
│  │  Lote: [LOT-20260401-___]  Vence: [DD/MM/AAAA]              ││
│  │  Ubicación: [A01 ▼] Fila: [3 ▼] Col: [2 ▼]  [📍 Auto]     ││
│  │  ☑ Inspección de calidad requerida                            ││
│  │  ─────────────────────────────────────────────────────────── ││
│  │                                                                ││
│  │  Item 20 | HYD-PMP-001 — Bomba Hidráulica Rexroth A10V      ││
│  │  ┌──────────┬──────────┬───────────┬──────────┬───────────┐  ││
│  │  │ Ordenado │ Ya Recib.│ Recibir   │ Aceptar  │ Rechazar  │  ││
│  │  │    5     │    0     │ [5      ] │ [5     ] │ [0     ]  │  ││
│  │  └──────────┴──────────┴───────────┴──────────┴───────────┘  ││
│  │  Lote: [LOT-20260401-___]  Vence: [N/A]                     ││
│  │  Ubicación: [B02 ▼] Fila: [1 ▼] Col: [1 ▼]  [📍 Auto]     ││
│  │  ☐ Inspección de calidad requerida                            ││
│  │  ─────────────────────────────────────────────────────────── ││
│  │                                                                ││
│  │  Item 30 | ELE-INV-001 — Variador de Frecuencia ABB ACS580  ││
│  │  ┌──────────┬──────────┬───────────┬──────────┬───────────┐  ││
│  │  │ Ordenado │ Ya Recib.│ Recibir   │ Aceptar  │ Rechazar  │  ││
│  │  │    3     │    0     │ [3      ] │ [2     ] │ [1     ]  │  ││
│  │  └──────────┴──────────┴───────────┴──────────┴───────────┘  ││
│  │  Lote: [LOT-20260401-___]  Vence: [N/A]                     ││
│  │  Ubicación: [A03 ▼] Fila: [2 ▼] Col: [3 ▼]  [📍 Auto]     ││
│  │  ☐ Inspección de calidad requerida                            ││
│  │  Motivo rechazo: [Daño en empaque ▼]                          ││
│  │                                                                ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Resumen ─────────────────────────────────────────────────┐  │
│  │ Total Ítems: 3                                             │  │
│  │ Total Recibido: 108 unidades                               │  │
│  │ Total Aceptado: 107 unidades                               │  │
│  │ Total Rechazado: 1 unidad                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Notas ───────────────────────────────────────────────────┐  │
│  │ [___________________________________________]              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancelar]                    [Guardar Borrador]  [✓ Contab.]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5.5 Paso 3: Asignación de Ubicación (Putaway)

### Algoritmo de Sugerencia de Ubicación

El botón [📍 Auto] ejecuta `wms_suggest_putaway()` (ver `15-ESTRATEGIAS-ALMACEN.md §15.2`) que aplica la **estrategia de putaway activa** del almacén:

```
Estrategias disponibles (configuradas en warehouse_strategies):
├── zone_category  → Asigna por zona según categoría del producto
├── weight_volume  → Pesados abajo, livianos arriba
├── fixed_slot     → Posiciones dedicadas por SKU
├── proximity      → Cerca del dock de despacho
└── random_available → Primera posición libre (fallback)

El panel muestra las 5 mejores posiciones con SCORE y RAZÓN
```

### Panel de Sugerencia de Putaway

Cuando el operador hace click en [📍 Auto], aparece el panel de sugerencias:

```
┌─ Sugerencia de Ubicación ─────────────────────────────────────────┐
│                                                                     │
│  Producto: Rodamiento SKF 6205 (100 UN, 12 kg)                    │
│  Estrategia activa: 🔵 Zona por Categoría (zone_category)         │
│  Categoría: Mecánicos → Zona A-B                                   │
│                                                                     │
│  ┌─ Posiciones Sugeridas ──────────────────────────────────────┐   │
│  │ # │ Posición │ Score │ Razón                       │ Acción │   │
│  │ 1 │ A01-3-2  │ ⭐ 95 │ Zona correcta + prod. sim.  │ [✓ Sel]│   │
│  │ 2 │ A02-1-4  │ ⭐ 90 │ Zona correcta               │ [  Sel]│   │
│  │ 3 │ B01-2-1  │ ⭐ 85 │ Zona correcta, nivel bajo   │ [  Sel]│   │
│  │ 4 │ C03-4-2  │ ⭐ 30 │ Zona alternativa (fallback)  │ [  Sel]│   │
│  │ 5 │ D01-1-3  │ ⭐ 30 │ Zona alternativa             │ [  Sel]│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [📍 Selección Manual]  [🔄 Cambiar Estrategia]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

> Para el detalle de los algoritmos de cada estrategia y la función `wms_suggest_putaway()`, ver **15-ESTRATEGIAS-ALMACEN.md §15.2**.

### Selector Visual de Posición

```
┌─ Seleccionar Ubicación ─────────────────────────────────────────┐
│                                                                  │
│  Almacén: Almacén Central       Pasillo: [A ▼]                 │
│                                                                  │
│  ┌─ Rack A01 ────────────────────────────────────────────────┐  │
│  │        Col 1      Col 2      Col 3      Col 4            │  │
│  │ Fila 5 [🟢 Libre] [🟡 Reser] [🔵 Ocup.] [🔵 Ocup.]     │  │
│  │ Fila 4 [🔵 Ocup.] [🟢 Libre] [🔵 Ocup.] [🟢 Libre]     │  │
│  │ Fila 3 [🔵 Ocup.] [🟢★SUGE.] [🔵 Ocup.] [🔵 Ocup.]     │  │
│  │ Fila 2 [🔵 Ocup.] [🔵 Ocup.] [🔵 Ocup.] [🟢 Libre]     │  │
│  │ Fila 1 [🔵 Ocup.] [🔵 Ocup.] [🔵 Ocup.] [🔵 Ocup.]     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ★ Posición sugerida: A01-3-2 (Mismo pasillo que stock actual)  │
│  Peso máximo: 1,500 kg | Peso producto: 0.12 kg × 100 = 12 kg  │
│                                                                  │
│  [Confirmar A01-3-2]                                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5.6 Paso 4: Contabilización (Posting)

Al hacer click en [✓ Contabilizar], se ejecuta la transacción atómica:

### Transacción RPC: `wms_post_goods_receipt`

```sql
CREATE OR REPLACE FUNCTION wms_post_goods_receipt(
    p_receipt_id UUID,
    p_items JSONB  -- [{po_item_id, qty_received, qty_accepted, qty_rejected, 
                   --   target_position_id, lot_number, batch_code, expiry_date, 
                   --   rejection_reason}]
) RETURNS JSONB AS $$
DECLARE
    v_receipt goods_receipts%ROWTYPE;
    v_item JSONB;
    v_po_item purchase_order_items%ROWTYPE;
    v_product_id UUID;
    v_movement_id UUID;
    v_doc_number VARCHAR;
BEGIN
    -- 1. Obtener receipt
    SELECT * INTO v_receipt FROM goods_receipts WHERE id = p_receipt_id;
    
    -- 2. Generar número de documento SAP simulado
    v_doc_number := 'MAT-' || to_char(now(), 'YYYYMMDD') || '-' || 
                     lpad(nextval('sap_doc_seq')::text, 4, '0');
    
    -- 3. Para cada item...
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- a) Actualizar received_quantity en purchase_order_items
        UPDATE purchase_order_items 
        SET received_quantity = received_quantity + (v_item->>'qty_accepted')::numeric
        WHERE id = (v_item->>'po_item_id')::uuid
        RETURNING * INTO v_po_item;
        
        -- b) Si qty_accepted > 0: Crear registro de inventory
        IF (v_item->>'qty_accepted')::numeric > 0 THEN
            -- Obtener product_id del PO item
            SELECT p.id INTO v_product_id 
            FROM products p WHERE p.sap_material_number = v_po_item.sap_material_number
            OR p.sku = v_po_item.material_code;
            
            INSERT INTO inventory (position_id, product_id, lot_number, batch_code,
                                   quantity, entry_date, vendor_id, po_id, gr_id, status)
            VALUES (
                (v_item->>'target_position_id')::uuid,
                v_product_id,
                v_item->>'lot_number',
                v_item->>'batch_code',
                (v_item->>'qty_accepted')::numeric,
                now(),
                v_receipt.receiver_id,  -- will be vendor_id from PO
                (SELECT po_id FROM goods_receipts WHERE id = p_receipt_id),
                p_receipt_id,
                'active'
            );
            
            -- c) Actualizar rack_position status a 'occupied'
            UPDATE rack_positions 
            SET status = 'occupied', last_movement_at = now()
            WHERE id = (v_item->>'target_position_id')::uuid;
            
            -- d) Crear inventory_movement (audit trail)
            INSERT INTO inventory_movements (
                org_id, product_id, to_position_id, quantity,
                movement_type, sap_movement_type, reference_type,
                reference_id, reference_number, performed_by
            ) VALUES (
                v_receipt.org_id, v_product_id,
                (v_item->>'target_position_id')::uuid,
                (v_item->>'qty_accepted')::numeric,
                'goods_receipt', '101', 'goods_receipt',
                p_receipt_id, v_receipt.receipt_number,
                v_receipt.receiver_id
            );
        END IF;
        
        -- e) Actualizar goods_receipt_items
        UPDATE goods_receipt_items SET
            quantity_received = (v_item->>'qty_received')::numeric,
            quantity_accepted = (v_item->>'qty_accepted')::numeric,
            quantity_rejected = (v_item->>'qty_rejected')::numeric,
            target_position_id = (v_item->>'target_position_id')::uuid,
            lot_number = v_item->>'lot_number',
            rejection_reason = v_item->>'rejection_reason'
        WHERE id = (v_item->>'po_item_id')::uuid;
    END LOOP;
    
    -- 4. Actualizar status del goods_receipt
    UPDATE goods_receipts SET 
        status = 'accepted',
        sap_document_id = v_doc_number
    WHERE id = p_receipt_id;
    
    -- 5. Evaluar si la OC está completamente recibida
    -- (lógica para cambiar PO status a 'received' o 'partially_received')
    
    RETURN jsonb_build_object(
        'success', true,
        'receipt_id', p_receipt_id,
        'sap_document', v_doc_number,
        'message', 'Entrada de mercancía contabilizada exitosamente'
    );
END;
$$ LANGUAGE plpgsql;
```

---

## 5.7 Estados del Goods Receipt

```
planned → pending → inspecting → accepted / partial / rejected
                                    │
                                    ▼
                              (posted to SAP)
```

| Estado | Significado | Badge Color |
|--------|------------|-------------|
| `pending` | Creado, pendiente de verificación | Blue |
| `inspecting` | En inspección de calidad | Amber |
| `accepted` | Completamente aceptado y contabilizado | Emerald |
| `partial` | Parcialmente aceptado | Orange |
| `rejected` | Rechazado completamente | Red |

---

## 5.8 Notificaciones Post-Entrada

Cuando la entrada se contabiliza exitosamente:

1. **Toast premium** con animación de check:
   ```
   ✅ Entrada GR-2026-0052 contabilizada
   108 unidades → Almacén Central
   Doc. SAP: MAT-20260401-0052
   ```

2. **Actualización 3D:** La posición del rack destino cambia de color (available → occupied)

3. **Dashboard:** KPIs se actualizan inmediatamente

4. **Movimientos:** Se registra en el historial con badge "101"

---

## 5.9 Variante: Entrada sin Orden de Compra (Mov. 501)

Para ajustes de inventario inicial o mercancía sin OC:

```
┌─ Entrada sin Orden de Compra ────────────────────────────────────┐
│                                                                  │
│  Tipo: Entrada sin referencia (501)                              │
│  Documento: GR-2026-NOPO-0001                                   │
│                                                                  │
│  [+ Agregar Material]                                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Material: [🔍 Buscar por SKU o nombre...]                 │  │
│  │ Cantidad: [_______]  Unidad: [UN ▼]                       │  │
│  │ Lote: [____________]  Valor: [$________]                  │  │
│  │ Ubicación: [Auto ▼]                                       │  │
│  │ Motivo: [Inventario inicial ▼]                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancelar]                              [✓ Contabilizar]       │
└──────────────────────────────────────────────────────────────────┘
```
