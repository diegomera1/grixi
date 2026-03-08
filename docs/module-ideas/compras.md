# 🛒 Módulo: Compras & Aprovisionamiento

> **SAP Equivalente:** MM (Materials Management)
> **Ruta:** `/compras`
> **Prioridad:** 🔴 Alta (Fase 9)

## ¿Por qué es clave?

Es el puente directo entre el mundo exterior (proveedores) y el módulo de Almacenes 3D que ya existe. Cuando una OC llega, el producto entra al almacén. Cierra el ciclo: **Comprar → Recibir → Almacenar**.

## Datos que vienen de SAP

| SAP Tabla/T-Code | Dato                      | Uso en Grixi           |
| ---------------- | ------------------------- | ---------------------- |
| `EKKO` / `EKPO`  | Cabecera/posiciones de OC | Pipeline de compras    |
| `EBAN`           | Solicitudes de pedido     | Solicitudes pendientes |
| `EKET`           | Programa de entregas      | Tracking de entregas   |
| `EKBE`           | Historial de OC           | Recepciones, facturas  |
| `LFA1` / `LFB1`  | Datos maestros proveedor  | Directorio proveedores |
| `MARA` / `MARC`  | Materiales                | Catálogo de materiales |
| `MBEW`           | Valoración de materiales  | Precios/costos         |
| `T-Code: ME21N`  | Crear OC                  | Referencia de campos   |
| `T-Code: ME23N`  | Visualizar OC             | Detalle de OC          |
| `T-Code: MIGO`   | Movimiento de mercadería  | Recepción en almacén   |
| `T-Code: MK01`   | Crear proveedor           | Gestión de proveedores |

## Subsección: Rutas y Vistas

### `/compras` — Dashboard de Compras

```
┌──────────────────────────────────────────────────────────┐
│  🛒 Compras & Aprovisionamiento                          │
│                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │OC     │  │Pend. │  │En    │  │Recib.│  │Total │    │
│  │Abiertas│ │Aprob.│  │Tránsi│  │Hoy   │  │Mes   │    │
│  │  24   │  │  8   │  │  12  │  │  3   │  │$380K │    │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ PIPELINE DE ÓRDENES DE COMPRA                       │ │
│  │                                                     │ │
│  │ Solicitud → Aprobación → OC Creada → En Tránsito   │ │
│  │    (8)         (5)          (12)         (7)        │ │
│  │                                                     │ │
│  │             → Recibido → Facturado → Cerrado        │ │
│  │                 (15)        (20)       (145)        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │ Top 5 Proveedores     │  │ Compras por Categoría  │  │
│  │ (por volumen)         │  │ (Donut Chart)          │  │
│  │                       │  │                        │  │
│  │ 1. AceroMax 🟢 95%   │  │  ● Materia Prima 45%  │  │
│  │ 2. QuímicaPro 🟡 82% │  │  ● Repuestos    25%   │  │
│  │ 3. LogiPack 🟢 91%   │  │  ● Embalaje     15%   │  │
│  │ 4. InduTech 🔴 65%   │  │  ● Servicios    15%   │  │
│  └───────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### `/compras/ordenes` — Lista de Órdenes de Compra

- DataTable con todas las OC
- Columnas: #OC, proveedor, fecha, monto, estado, comprador
- Filtros: estado, proveedor, rango de fechas, monto
- Click → Sheet lateral con detalle completo
- Quick actions: aprobar, rechazar, recibir

### `/compras/ordenes/[id]` — Detalle de OC

- Header con estado visual (barra de progreso)
- Posiciones (line items) con material, cantidad, precio, almacén destino
- Timeline: solicitud → aprobación → envío → recepción → factura
- Documentos adjuntos (factura PDF, guía de remisión)
- Chat/notas internas entre comprador y aprobador

### `/compras/proveedores` — Directorio de Proveedores

- Cards de proveedores con logo, datos, scorecard
- Scorecard: cumplimiento (%), calidad (%), lead time promedio
- Historial de OC por proveedor
- Mapa de ubicación de proveedores (opcional)
- Comparación de precios por material entre proveedores

### `/compras/solicitudes` — Solicitudes de Pedido (PR)

- Kanban: borrador → enviada → aprobada → convertida en OC
- Drag & drop para cambiar estado
- Aprobaciones con firma digital (botón aprobar/rechazar)
- Notificaciones automáticas al aprobador

## Tablas Supabase

```sql
-- Proveedores
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(10) NOT NULL, -- VEN-001
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id VARCHAR(20), -- RUC/NIT
  category TEXT, -- materia_prima, servicios, repuestos
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Ecuador',
  payment_terms INTEGER DEFAULT 30, -- días
  rating DECIMAL(3,2), -- 0.00 a 5.00
  compliance_score DECIMAL(5,2), -- % cumplimiento
  quality_score DECIMAL(5,2), -- % calidad
  is_active BOOLEAN DEFAULT true,
  sap_vendor_code VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Órdenes de compra (cabecera)
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  po_number VARCHAR(20) NOT NULL, -- OC-2026-0001
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  requester_id UUID NOT NULL REFERENCES profiles(id),
  approver_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'sent',
    'partially_received', 'received', 'invoiced', 'closed', 'cancelled'
  )),
  order_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  warehouse_id UUID, -- almacén de destino
  notes TEXT,
  sap_po_number VARCHAR(10),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Posiciones de OC (line items)
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL, -- 10, 20, 30...
  material_code VARCHAR(20),
  description TEXT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT DEFAULT 'UN', -- UN, KG, LT, MT
  unit_price DECIMAL(15,4) NOT NULL,
  total_price DECIMAL(15,2),
  received_quantity DECIMAL(12,3) DEFAULT 0,
  warehouse_id UUID,
  rack_code VARCHAR(10), -- A dónde va en el almacén
  sap_material_number VARCHAR(18),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Solicitudes de pedido
CREATE TABLE purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  pr_number VARCHAR(20) NOT NULL,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  department TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'approved', 'rejected', 'converted'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  description TEXT NOT NULL,
  justification TEXT,
  estimated_amount DECIMAL(15,2),
  po_id UUID REFERENCES purchase_orders(id), -- una vez convertida
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recepciones de mercadería
CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  receipt_number VARCHAR(20) NOT NULL,
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  warehouse_id UUID NOT NULL,
  receipt_date DATE NOT NULL,
  notes TEXT,
  sap_document_id VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Conexión con Almacenes 3D

Cuando se recibe mercadería en una OC:

1. Se crea registro en `goods_receipts`
2. Se actualiza `inventory` (tabla existente en Almacenes)
3. Se asigna la posición en el rack correspondiente
4. El Almacén 3D se actualiza en tiempo real (Supabase Realtime)
5. En la vista 3D, el rack destino parpadea/resalta indicando nuevo ingreso

```
OC Recibida → goods_receipts → inventory → rack_positions → 🏭 3D Update
```

## AI Integration (Gemini)

```
→ "¿Cuántas OC tenemos pendientes de recibir?"
→ "¿Cuál es el proveedor con mejor cumplimiento?"
→ "¿Qué materiales necesitamos reordenar?"
→ "Compara precios del acero entre proveedores"
→ "¿Cuánto hemos gastado en repuestos este trimestre?"

Function calling:
• get_open_pos() → OC abiertas
• get_vendor_scorecard(vendor_id) → Evaluación
• get_reorder_alerts() → Materiales bajo mínimo
• compare_vendor_prices(material) → Tabla comparativa
```

## Datos Demo (Seed)

- **12 proveedores** con datos realistas (nombres ecuatorianos)
- **200 órdenes de compra** en distintos estados (últimos 6 meses)
- **600 posiciones** de OC con materiales industriales
- **15 solicitudes de pedido** (5 pendientes de aprobación)
- **50 recepciones** de mercadería vinculadas a almacenes existentes
- Montos entre $200 y $150,000
