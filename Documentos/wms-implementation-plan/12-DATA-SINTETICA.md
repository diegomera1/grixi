# 12 — Data Sintética y Seed

## 12.1 Estrategia

La data actual necesita ser **realineada** para soportar los flujos WMS completos. Esto implica:

1. **Ampliar campos en tablas existentes** (SAP codes, etc.)
2. **Crear data en tablas nuevas** (sales_orders, goods_issues, etc.)
3. **Asegurar coherencia** entre POs → GRs → Inventory → Positions
4. **Crear escenarios demo** predefinidos para cada flujo

---

## 12.2 Data de Warehouses — Agregar SAP Codes

```sql
-- Actualizar warehouses con códigos SAP
UPDATE warehouses SET 
    sap_plant_code = '1000',
    sap_storage_location = '0001',
    address = 'Km 7.5 Vía a Quevedo, Parque Industrial',
    manager_name = 'Ing. Carlos Mendoza'
WHERE name = 'Almacén Central';

UPDATE warehouses SET 
    sap_plant_code = '1000',
    sap_storage_location = '0002',
    address = 'Km 7.5 Vía a Quevedo, Zona de Materias Primas',
    manager_name = 'Ing. María Rodríguez'
WHERE name LIKE '%Materia Prima%';

UPDATE warehouses SET 
    sap_plant_code = '2000',
    sap_storage_location = '0001',
    address = 'Km 12 Vía Daule, Zona Industrial',
    manager_name = 'Ing. Roberto Falconí'
WHERE name LIKE '%Productos Terminados%';

UPDATE warehouses SET 
    sap_plant_code = '1000',
    sap_storage_location = '0003',
    address = 'Km 7.5 Vía a Quevedo, Área Refrigerada',
    manager_name = 'Ing. Ana Villavicencio'
WHERE name LIKE '%Cámara Fría%';

UPDATE warehouses SET 
    sap_plant_code = '3000',
    sap_storage_location = '0001',
    address = 'Av. de las Américas, Parque Logístico Norte',
    manager_name = 'Ing. Luis Zambrano'
WHERE name LIKE '%Centro Logístico%';
```

---

## 12.3 Sales Orders (Demo Data)

```sql
-- Insertar Pedidos de Venta simulados de SAP
INSERT INTO sales_orders (org_id, so_number, customer_name, customer_code, status, 
                          warehouse_id, requested_delivery_date, subtotal, tax, total,
                          currency, priority, shipping_address, sap_so_number, created_by)
VALUES
-- Pedido urgente (para demo de salida completa)
('a0000000-0000-0000-0000-000000000001', 'SO-2026-0048', 
 'PETROECUADOR EP', 'CL-001', 'confirmed',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 '2026-04-02', 16109.50, 2416.43, 18525.93, 'USD', 'urgent',
 'Km 7.5 Vía a Quevedo, Esmeraldas', '0080054321',
 (SELECT id FROM auth.users LIMIT 1)),

-- Pedido en picking (para demo de picking list)
('a0000000-0000-0000-0000-000000000001', 'SO-2026-0047',
 'Industrias del Pacífico S.A.', 'CL-002', 'picking',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 '2026-04-05', 7608.70, 1141.30, 8750.00, 'USD', 'high',
 'Km 16.5 Vía Daule, Guayaquil', '0080054320',
 (SELECT id FROM auth.users LIMIT 1)),

-- Pedido ya despachado (para historial)
('a0000000-0000-0000-0000-000000000001', 'SO-2026-0046',
 'Distribuidora Nacional del Ecuador', 'CL-003', 'shipped',
 (SELECT id FROM warehouses WHERE name LIKE '%Productos Terminados%'),
 '2026-03-30', 10695.65, 1604.35, 12300.00, 'USD', 'medium',
 'Av. 25 de Junio, Machala', '0080054315',
 (SELECT id FROM auth.users LIMIT 1)),

-- Pedidos pendientes adicionales
('a0000000-0000-0000-0000-000000000001', 'SO-2026-0045',
 'Marbelize S.A.', 'CL-004', 'confirmed',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 '2026-04-07', 2782.61, 417.39, 3200.00, 'USD', 'medium',
 'Malecón de Manta, Zona Portuaria', '0080054310',
 (SELECT id FROM auth.users LIMIT 1)),

('a0000000-0000-0000-0000-000000000001', 'SO-2026-0044',
 'Cervecería Nacional CN S.A.', 'CL-005', 'pending',
 (SELECT id FROM warehouses WHERE name LIKE '%Cámara Fría%'),
 '2026-04-08', 4347.83, 652.17, 5000.00, 'USD', 'low',
 'Km 16.5 Vía Daule, Guayaquil', '0080054308',
 (SELECT id FROM auth.users LIMIT 1)),

('a0000000-0000-0000-0000-000000000001', 'SO-2026-0043',
 'Holcim Ecuador S.A.', 'CL-006', 'confirmed',
 (SELECT id FROM warehouses WHERE name LIKE '%Materia Prima%'),
 '2026-04-04', 21739.13, 3260.87, 25000.00, 'USD', 'high',
 'Km 24 Vía Perimetral, Guayaquil', '0080054305',
 (SELECT id FROM auth.users LIMIT 1)),

('a0000000-0000-0000-0000-000000000001', 'SO-2026-0042',
 'Pronaca C.A.', 'CL-007', 'confirmed',
 (SELECT id FROM warehouses WHERE name LIKE '%Cámara Fría%'),
 '2026-04-06', 6956.52, 1043.48, 8000.00, 'USD', 'medium',
 'Av. Galo Plaza Lasso, Quito', '0080054300',
 (SELECT id FROM auth.users LIMIT 1)),

('a0000000-0000-0000-0000-000000000001', 'SO-2026-0041',
 'OCP Ecuador S.A.', 'CL-008', 'pending',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 '2026-04-10', 34782.61, 5217.39, 40000.00, 'USD', 'urgent',
 'Terminal Balao, Esmeraldas', '0080054295',
 (SELECT id FROM auth.users LIMIT 1));
```

---

## 12.4 Sales Order Items

```sql
-- Items para SO-2026-0048 (PETROECUADOR EP - urgente)
INSERT INTO sales_order_items (sale_order_id, item_number, product_id, description,
                               quantity, unit, unit_price, total_price, warehouse_id)
SELECT 
    so.id, items.item_number, p.id, p.name,
    items.qty, p.unit_of_measure, items.price, items.qty * items.price,
    so.warehouse_id
FROM sales_orders so
CROSS JOIN (VALUES
    (10, 'MEC-MOT-001', 20, 180.00),
    (20, 'HYD-PMP-001', 10, 450.00),
    (30, 'ELE-INV-001', 5, 1200.00),
    (40, 'ELE-CAB-001', 3, 85.00),
    (50, 'SEG-GUA-001', 50, 12.50)
) AS items(item_number, sku, qty, price)
JOIN products p ON p.sku = items.sku
WHERE so.so_number = 'SO-2026-0048';

-- Items para SO-2026-0047 (Industrias del Pacífico - picking)
-- (Similar pattern for each SO...)
```

---

## 12.5 OCs Pendientes de Recepción (Para Demo de Entrada)

Asegurar que hay OCs en status `sent` listas para demostrar Goods Receipt:

```sql
-- Actualizar algunas OCs existentes a status 'sent' para demo
UPDATE purchase_orders 
SET status = 'sent', 
    sent_at = now() - interval '3 days',
    expected_delivery = CURRENT_DATE
WHERE po_number IN ('PO-2026-0089', 'PO-2026-0087')
AND status NOT IN ('received', 'closed');

-- Crear 2 OCs nuevas específicas para demo de GR
INSERT INTO purchase_orders (org_id, po_number, vendor_id, requester_id, status,
                             order_date, expected_delivery, warehouse_id,
                             sap_po_number, priority, subtotal, tax, total)
VALUES
('a0000000-0000-0000-0000-000000000001', 'PO-2026-0095',
 (SELECT id FROM vendors WHERE code = 'V-001'),
 (SELECT id FROM profiles LIMIT 1),
 'sent', '2026-03-25', '2026-04-01',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 '4500012890', 'urgent', 8500.00, 1275.00, 9775.00),

('a0000000-0000-0000-0000-000000000001', 'PO-2026-0096',
 (SELECT id FROM vendors WHERE code = 'V-003'),
 (SELECT id FROM profiles LIMIT 1),
 'sent', '2026-03-28', '2026-04-02',
 (SELECT id FROM warehouses WHERE name LIKE '%Materia Prima%'),
 '4500012895', 'high', 15200.00, 2280.00, 17480.00);
```

---

## 12.6 Goods Issues Demo (Históricos)

```sql
-- Crear algunas salidas ya contabilizadas para historial
INSERT INTO goods_issues (org_id, issue_number, issue_type, reference_type,
                          reference_id, warehouse_id, issued_by, status,
                          movement_type, sap_document_id, posted_at)
VALUES
('a0000000-0000-0000-0000-000000000001', 'GI-2026-0020',
 'sales_order', 'sales_order',
 (SELECT id FROM sales_orders WHERE so_number = 'SO-2026-0046'),
 (SELECT id FROM warehouses WHERE name LIKE '%Productos Terminados%'),
 (SELECT id FROM auth.users LIMIT 1), 'posted',
 '261', 'MAT-20260330-0085', now() - interval '2 days'),

('a0000000-0000-0000-0000-000000000001', 'GI-2026-0021',
 'cost_center', NULL, NULL,
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 (SELECT id FROM auth.users LIMIT 1), 'posted',
 '201', 'MAT-20260331-0086', now() - interval '1 day');
```

---

## 12.7 Transfer Orders Demo

```sql
INSERT INTO transfer_orders (org_id, transfer_number, transfer_type,
                             from_warehouse_id, to_warehouse_id,
                             requested_by, status, movement_type, priority, reason)
VALUES
('a0000000-0000-0000-0000-000000000001', 'TO-2026-0010', 'internal',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 (SELECT id FROM auth.users LIMIT 1), 'posted', '311', 'medium',
 'Reslotting por clasificación ABC'),

('a0000000-0000-0000-0000-000000000001', 'TO-2026-0011', 'cross_warehouse',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 (SELECT id FROM warehouses WHERE name LIKE '%Cámara Fría%'),
 (SELECT id FROM auth.users LIMIT 1), 'pending', '301', 'high',
 'Transferencia de insumos alimenticios a zona refrigerada');
```

---

## 12.8 Physical Counts Demo

```sql
INSERT INTO physical_counts (org_id, count_number, warehouse_id, count_type,
                             status, counted_by, start_date, total_positions,
                             counted_positions, variance_count)
VALUES
('a0000000-0000-0000-0000-000000000001', 'PC-2026-0005',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 'cycle', 'completed',
 (SELECT id FROM auth.users LIMIT 1),
 now() - interval '3 hours', 64, 64, 6);
```

---

## 12.9 Inventory Movements — Expandir

```sql
-- Actualizar movimientos existentes con SAP metadata
UPDATE inventory_movements SET
    sap_movement_type = CASE movement_type
        WHEN 'inbound' THEN '101'
        WHEN 'outbound' THEN '201'
        WHEN 'transfer' THEN '311'
        ELSE '999'
    END,
    reference_type = CASE movement_type
        WHEN 'inbound' THEN 'goods_receipt'
        WHEN 'outbound' THEN 'goods_issue'
        WHEN 'transfer' THEN 'transfer_order'
        ELSE 'manual'
    END
WHERE sap_movement_type IS NULL;
```

---

## 12.10 Secuencia de Documentos

```sql
-- Secuencia para números de documento SAP simulados
CREATE SEQUENCE IF NOT EXISTS sap_doc_seq START 100;

-- Secuencia para cada tipo de documento WMS
CREATE SEQUENCE IF NOT EXISTS gr_number_seq START 52;
CREATE SEQUENCE IF NOT EXISTS gi_number_seq START 25;
CREATE SEQUENCE IF NOT EXISTS to_number_seq START 14;
CREATE SEQUENCE IF NOT EXISTS so_number_seq START 49;
CREATE SEQUENCE IF NOT EXISTS pc_number_seq START 7;
```

---

## 12.11 Warehouse Strategies (Configuración por Almacén)

```sql
-- Estrategias de Putaway
INSERT INTO warehouse_strategies (org_id, warehouse_id, strategy_type, strategy_code, priority, config, is_active)
VALUES
-- Almacén Central: Zona por categoría + FIFO picking
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 'putaway', 'zone_category', 1,
 '{"zones": {"mecanicos": {"aisles": ["A","B"]}, "hidraulicos": {"aisles": ["C"]}, "electricos": {"aisles": ["D","E"]}, "seguridad": {"aisles": ["F"]}}, "fallback": "random_available", "prefer_lower_levels": true}',
 true),

('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name = 'Almacén Central'),
 'picking', 'fifo', 1, '{"fefo_override_for_expiry": true, "show_alternatives": true}', true),

-- Materia Prima: Peso/Volumen + FIFO
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Materia Prima%'),
 'putaway', 'weight_volume', 1,
 '{"heavy_threshold_kg": 500, "max_level_for_heavy": 2, "prefer_lower_levels": true}',
 true),

('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Materia Prima%'),
 'picking', 'fifo', 1, '{"fefo_override_for_expiry": true}', true),

-- Cámara Fría: Fixed slot + FEFO obligatorio
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Cámara Fría%'),
 'putaway', 'fixed_slot', 1,
 '{"require_temperature_check": true}',
 true),

('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Cámara Fría%'),
 'picking', 'fefo', 1, '{"strict_expiry": true, "reject_expired": true}', true),

-- Productos Terminados: Proximidad al dock
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Productos Terminados%'),
 'putaway', 'proximity', 1,
 '{"dock_position": "entrance", "abc_a_near_dock": true}',
 true),

('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Productos Terminados%'),
 'picking', 'consolidate', 1, '{"prefer_empty_positions": true}', true),

-- Centro Logístico: Random
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Centro Logístico%'),
 'putaway', 'random_available', 1, '{}', true),

('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Centro Logístico%'),
 'picking', 'fifo', 1, '{}', true);
```

---

## 12.12 Lot Tracking (Control de Lotes)

```sql
-- Lotes activos con diferentes características
INSERT INTO lot_tracking (org_id, lot_number, product_id, batch_code, manufacturing_date,
                          expiry_date, status, characteristics, vendor_id, po_number,
                          total_quantity, remaining_quantity)
VALUES
-- Aceites con vencimiento y clase peligrosa
('a0000000-0000-0000-0000-000000000001', 'LOT-20260115-042',
 (SELECT id FROM products WHERE sku = 'HYD-ACE-001'),
 'BCH-2026-042', '2025-11-15', '2026-07-15', 'active',
 '{"temperature_range": "15-30°C", "hazard_class": "3", "msds_required": true, "certification": "ISO-9001", "origin_country": "EC"}',
 (SELECT id FROM vendors WHERE code = 'V-003'), 'PO-2026-0075', 200, 145),

('a0000000-0000-0000-0000-000000000001', 'LOT-20260220-089',
 (SELECT id FROM products WHERE sku = 'HYD-ACE-001'),
 'BCH-2026-089', '2025-12-20', '2026-06-20', 'active',
 '{"temperature_range": "15-30°C", "hazard_class": "3", "msds_required": true, "origin_country": "EC"}',
 (SELECT id FROM vendors WHERE code = 'V-003'), 'PO-2026-0080', 150, 135),

-- Rodamientos sin vencimiento
('a0000000-0000-0000-0000-000000000001', 'LOT-20260115-015',
 (SELECT id FROM products WHERE sku = 'MEC-BRD-001'),
 'BCH-2026-015', '2025-10-01', NULL, 'active',
 '{"certification": "ISO-6205", "origin_country": "DE"}',
 (SELECT id FROM vendors WHERE code = 'V-001'), 'PO-2026-0065', 250, 205),

-- Guantes con vencimiento próximo (para alerta demo)
('a0000000-0000-0000-0000-000000000001', 'LOT-20260101-008',
 (SELECT id FROM products WHERE sku = 'SEG-GUA-001'),
 'BCH-2026-008', '2025-07-01', '2026-04-10', 'active',
 '{"certification": "CE-EN374", "origin_country": "MY"}',
 (SELECT id FROM vendors WHERE code = 'V-005'), 'PO-2026-0050', 500, 180),

-- Resina epóxica próxima a vencer
('a0000000-0000-0000-0000-000000000001', 'LOT-20260120-055',
 (SELECT id FROM products WHERE sku = 'QUI-RES-001'),
 'BCH-2026-055', '2025-08-20', '2026-04-20', 'active',
 '{"temperature_range": "5-25°C", "hazard_class": "6.1", "msds_required": true, "humidity_sensitive": true, "origin_country": "BR"}',
 (SELECT id FROM vendors WHERE code = 'V-003'), 'PO-2026-0070', 100, 75),

-- Lote en cuarentena
('a0000000-0000-0000-0000-000000000001', 'LOT-20260310-077',
 (SELECT id FROM products WHERE sku = 'QUI-CEM-001'),
 'BCH-2026-077', '2026-01-10', '2027-01-10', 'quarantine',
 '{"origin_country": "EC", "max_stack_height": 3}',
 (SELECT id FROM vendors WHERE code = 'V-006'), 'PO-2026-0085', 200, 200),

-- Lote expirado (para alerta roja)
('a0000000-0000-0000-0000-000000000001', 'LOT-20250801-003',
 (SELECT id FROM products WHERE sku = 'SEG-GUA-001'),
 'BCH-2025-003', '2025-02-01', '2026-03-28', 'expired',
 '{"certification": "CE-EN374", "origin_country": "MY"}',
 (SELECT id FROM vendors WHERE code = 'V-005'), 'PO-2025-0820', 300, 42),

-- Motores sin vencimiento
('a0000000-0000-0000-0000-000000000001', 'LOT-20260215-040',
 (SELECT id FROM products WHERE sku = 'MEC-MOT-001'),
 'BCH-2026-040', '2025-12-15', NULL, 'active',
 '{"certification": "IEC-60034", "origin_country": "CN", "max_weight_per_unit": 25}',
 (SELECT id FROM vendors WHERE code = 'V-002'), 'PO-2026-0072', 50, 35),

('a0000000-0000-0000-0000-000000000001', 'LOT-20260301-065',
 (SELECT id FROM products WHERE sku = 'MEC-MOT-001'),
 'BCH-2026-065', '2026-01-01', NULL, 'active',
 '{"certification": "IEC-60034", "origin_country": "CN", "max_weight_per_unit": 25}',
 (SELECT id FROM vendors WHERE code = 'V-002'), 'PO-2026-0078', 50, 50),

-- Bombas hidráulicas
('a0000000-0000-0000-0000-000000000001', 'LOT-20260220-103',
 (SELECT id FROM products WHERE sku = 'HYD-PMP-001'),
 'BCH-2026-103', '2025-11-20', NULL, 'active',
 '{"certification": "ISO-4401", "origin_country": "DE", "max_weight_per_unit": 45}',
 (SELECT id FROM vendors WHERE code = 'V-001'), 'PO-2026-0076', 20, 12),

-- Cables eléctricos
('a0000000-0000-0000-0000-000000000001', 'LOT-20260305-120',
 (SELECT id FROM products WHERE sku = 'ELE-CAB-001'),
 'BCH-2026-120', '2026-01-05', NULL, 'active',
 '{"certification": "UL/CSA", "origin_country": "CO"}',
 (SELECT id FROM vendors WHERE code = 'V-004'), 'PO-2026-0082', 100, 65);
```

---

## 12.13 WMS AI Insights (Pre-generados para Dashboard)

```sql
-- Insights pre-generados para que el dashboard tenga data al cargar
INSERT INTO wms_ai_insights (org_id, warehouse_id, insight_type, severity, title, message, data, action)
VALUES
('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Productos Terminados%'),
 'prediction', 'high',
 'Riesgo de desabasto en 14 días',
 'Motor Eléctrico 5HP: Consumo promedio 12 UN/día, stock actual 85 UN → Se agota ~15 abril. Lead time usual de MetalTech: 5-7 días. Recomiendo crear solicitud de compra antes del 8 de abril.',
 '{"product_sku": "MEC-MOT-001", "current_stock": 85, "daily_consumption": 12, "days_to_stockout": 7, "reorder_point": 85}',
 '{"type": "create_purchase_req", "product_sku": "MEC-MOT-001", "suggested_qty": 200}'),

('a0000000-0000-0000-0000-000000000001',
 NULL,
 'optimization', 'high',
 'Desbalance de ocupación detectado',
 'Productos Terminados al 92% vs Cámara Fría al 58%. Traspasar 45 posiciones de productos no perecederos ahorraría ~$2,100/mes en costos de almacenamiento y reduciría riesgo de congestión.',
 '{"critical_warehouse": "Productos Terminados", "available_warehouse": "Cámara Fría", "positions_to_move": 45, "monthly_savings": 2100}',
 '{"type": "create_transfer", "from_warehouse": "Productos Terminados", "to_warehouse": "Centro Logístico Norte"}'),

('a0000000-0000-0000-0000-000000000001',
 NULL,
 'info', 'low',
 '5 productos cambiaron de ABC-B a ABC-A este mes',
 'Basándome en el volumen de movimientos de los últimos 30 días, 5 productos subieron de clasificación B a A. Un reslotting a posiciones más cercanas al dock mejoraría tiempos de picking un ~15%.',
 '{"products_changed": 5, "estimated_improvement_pct": 15}',
 '{"type": "suggest_reslotting"}'),

('a0000000-0000-0000-0000-000000000001',
 (SELECT id FROM warehouses WHERE name LIKE '%Cámara Fría%'),
 'warning', 'medium',
 '3 lotes próximos a vencer en 30 días',
 'LOT-20260101-008 (Guantes, vence 10/04), LOT-20260120-055 (Resina, vence 20/04), y LOT-20260220-089 (Aceite, vence 20/06). Priorizar despacho o notificar compras para devolución.',
 '{"lots": ["LOT-20260101-008", "LOT-20260120-055", "LOT-20260220-089"], "total_value": 4350}',
 '{"type": "prioritize_dispatch"}');
```
