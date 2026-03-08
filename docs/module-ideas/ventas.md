# 📈 Módulo: Ventas & Clientes

> **SAP Equivalente:** SD (Sales & Distribution)
> **Ruta:** `/ventas`
> **Prioridad:** 🔴 Alta (Fase 10)

## ¿Por qué es clave?

Completa el ciclo comercial: **Comprar → Almacenar → Vender**. Revenue es lo que mueve la empresa. Un dashboard de ventas impresionante con pipeline visual, predicciones AI, y tracking de entregas es lo que cierra deals en una demo.

## Datos que vienen de SAP

| SAP Tabla/T-Code | Dato                   | Uso en Grixi                        |
| ---------------- | ---------------------- | ----------------------------------- |
| `VBAK` / `VBAP`  | Pedidos de venta       | Pipeline de ventas                  |
| `LIKP` / `LIPS`  | Entregas               | Tracking de despachos               |
| `VBRK` / `VBRP`  | Facturas               | Facturación y revenue               |
| `KNA1` / `KNB1`  | Datos maestros cliente | Directorio de clientes              |
| `KONV`           | Condiciones de precio  | Precios y descuentos                |
| `VBFA`           | Flujo de documentos    | Trazabilidad pedido→entrega→factura |
| `T-Code: VA01`   | Crear pedido de venta  | Referencia de campos                |
| `T-Code: VL01N`  | Crear entrega          | Despacho de almacén                 |
| `T-Code: VF01`   | Crear factura          | Facturación                         |

## Subsección: Rutas y Vistas

### `/ventas` — Dashboard de Ventas

```
┌──────────────────────────────────────────────────────────┐
│  📈 Centro de Ventas                                      │
│                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │Revenue│  │Pedidos│  │Margen│  │Conv. │  │Ticket│    │
│  │Mes    │  │Nuevos │  │Bruto │  │Rate  │  │Prom. │    │
│  │$1.2M  │  │  47   │  │ 32%  │  │ 68%  │  │$25K  │    │
│  │↑ 18%  │  │↑ 23%  │  │↑ 2%  │  │↓ 3%  │  │↑ 5%  │    │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘    │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Revenue Mensual     │  │ Pipeline por Estado      │  │
│  │ (Area + Line Chart) │  │ (Funnel / Sankey)        │  │
│  │                     │  │                          │  │
│  │  ~~~~/\~~~~         │  │ Cotización  ███████ 45  │  │
│  │ /         \         │  │ Pedido      █████   28  │  │
│  │/           ~        │  │ Despacho    ████    19  │  │
│  │                     │  │ Facturado   ███     15  │  │
│  └─────────────────────┘  │ Cobrado     ██      12  │  │
│                           └──────────────────────────┘  │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Top 10 Clientes     │  │ Ventas por Producto      │  │
│  │ (Revenue Table)     │  │ (Horizontal Bars)        │  │
│  │                     │  │                          │  │
│  │ 1. Acme  $340K 🟢  │  │ Acero Inox  ████████    │  │
│  │ 2. Beta  $280K 🟢  │  │ Resina EP   ██████      │  │
│  │ 3. Gamma $195K 🟡  │  │ Cable 12AWG █████       │  │
│  └─────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### `/ventas/pedidos` — Lista de Pedidos

- DataTable premium con sort, filter, search
- Columnas: #Pedido, cliente, fecha, monto, estado, vendedor
- Estado visual: cotización → pedido → despachado → facturado → cobrado
- Quick actions: crear entrega, facturar, ver timeline

### `/ventas/pedidos/[id]` — Detalle de Pedido

- Header con progreso visual del flujo documentos
- Posiciones con productos, precios, descuentos
- Documentos relacionados: OC del cliente, entrega, factura
- Mapa de entrega (si hay dirección) — opcional
- Historial de cambios (audit)

### `/ventas/clientes` — Directorio de Clientes

- Cards con logo, datos de contacto, revenue acumulado
- Clasificación ABC (por volumen de compras)
- Historial de pedidos por cliente
- Crédito disponible vs utilizado
- Rentabilidad por cliente (revenue - costo)

### `/ventas/forecast` — Predicciones AI

- Gráfico de revenue proyectado (próximos 3-6 meses)
- Basado en tendencia histórica + pipeline actual
- Gemini proporciona explicaciones narrativas
- Alertas: "Si se cierra la OC de Acme Corp, superamos la meta del Q2"

## Tablas Supabase

```sql
-- Clientes
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(10) NOT NULL, -- CLI-001
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id VARCHAR(20),
  classification TEXT DEFAULT 'B' CHECK (classification IN ('A', 'B', 'C')),
  industry TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Ecuador',
  credit_limit DECIMAL(15,2) DEFAULT 0,
  credit_used DECIMAL(15,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  salesperson_id UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  sap_customer_code VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pedidos de venta (cabecera)
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  so_number VARCHAR(20) NOT NULL, -- PV-2026-0001
  customer_id UUID NOT NULL REFERENCES customers(id),
  salesperson_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'quotation' CHECK (status IN (
    'quotation', 'confirmed', 'in_production',
    'ready_to_ship', 'shipped', 'delivered',
    'invoiced', 'paid', 'cancelled'
  )),
  order_date DATE NOT NULL,
  requested_delivery DATE,
  actual_delivery DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  shipping_address TEXT,
  notes TEXT,
  sap_so_number VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Posiciones de pedido
CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  product_code VARCHAR(20),
  description TEXT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT DEFAULT 'UN',
  unit_price DECIMAL(15,4) NOT NULL,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  total_price DECIMAL(15,2),
  warehouse_id UUID, -- de dónde sale
  delivered_quantity DECIMAL(12,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entregas / Despachos
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  delivery_number VARCHAR(20) NOT NULL,
  so_id UUID NOT NULL REFERENCES sales_orders(id),
  warehouse_id UUID NOT NULL,
  status TEXT DEFAULT 'picking' CHECK (status IN (
    'picking', 'packed', 'shipped', 'in_transit', 'delivered'
  )),
  ship_date DATE,
  delivery_date DATE,
  carrier TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Facturas de venta
CREATE TABLE sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  invoice_number VARCHAR(20) NOT NULL,
  so_id UUID NOT NULL REFERENCES sales_orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  tax DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  status TEXT DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
  sap_invoice_number VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Conexión con Almacenes 3D

Cuando se despacha un pedido:

1. Se crea `delivery` vinculada al `sales_order`
2. Se resta stock de `inventory` (tabla existente)
3. El rack origen se actualiza en el Almacén 3D
4. En la vista 3D, la posición cambia de "ocupada" a "vacía"

```
Pedido Confirmado → delivery (picking) → inventory ↓ → 🏭 3D Update → delivery (shipped)
```

## AI Integration (Gemini)

```
→ "¿Cuánto vendimos este mes?"
→ "¿Quién es nuestro mejor cliente?"
→ "¿Cuántos pedidos están pendientes de despacho?"
→ "Proyecta las ventas del próximo trimestre"
→ "¿Qué productos tienen mayor margen?"
→ "¿Cuál es la tasa de conversión cotización → pedido?"

Function calling:
• get_sales_dashboard(period) → KPIs de ventas
• get_pipeline_status() → Funnel de ventas
• get_customer_ranking() → Top clientes
• forecast_revenue(months) → Proyección con AI
• get_overdue_deliveries() → Entregas atrasadas
```

## Datos Demo (Seed)

- **20 clientes** con datos realistas (empresas ecuatorianas)
- **300 pedidos de venta** en todos los estados (12 meses)
- **800 posiciones** con productos industriales
- **150 entregas** vinculadas a pedidos
- **200 facturas** con distintos estados de pago
- Revenue mensual entre $80K y $250K con tendencia creciente
