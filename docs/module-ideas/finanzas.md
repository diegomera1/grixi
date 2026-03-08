# 💰 Módulo: Finanzas

> **SAP Equivalente:** FI (Financial Accounting) + CO (Controlling)
> **Ruta:** `/finanzas`
> **Prioridad:** 🔴 Alta (Fase 8)

## ¿Por qué es clave?

Es lo primero que pide un CEO o CFO. Si Grixi puede mostrar la salud financiera de la empresa en un dashboard hermoso y en tiempo real, el valor es inmediato. SAP FI/CO tiene la data, pero la experiencia de usuario es de los años 90.

## Datos que vienen de SAP

| SAP Tabla/T-Code         | Dato                                   | Uso en Grixi              |
| ------------------------ | -------------------------------------- | ------------------------- |
| `BKPF` / `BSEG`          | Documentos contables                   | Transacciones financieras |
| `FAGLFLEXA`              | Libro mayor (New GL)                   | Balance general, P&L      |
| `BSID` / `BSAD`          | Partidas abiertas/cerradas clientes    | Cuentas por cobrar (AR)   |
| `BSIK` / `BSAK`          | Partidas abiertas/cerradas proveedores | Cuentas por pagar (AP)    |
| `SKA1` / `SKAT`          | Plan de cuentas                        | Estructura contable       |
| `CSKS` / `CSKT`          | Centros de costo                       | Controlling               |
| `CEPC`                   | Centros de beneficio                   | Rentabilidad              |
| `T-Code: F.01`           | Balance general                        | Dashboard                 |
| `T-Code: S_ALR_87013611` | P&L statement                          | P&L interactivo           |
| `T-Code: FBL5N`          | AR line items                          | Aging de cartera          |

## Subsección: Rutas y Vistas

### `/finanzas` — Dashboard Principal

```
┌──────────────────────────────────────────────────────┐
│  💰 Finanzas en Tiempo Real                          │
│                                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │Ingresos│ │Gastos│ │EBITDA│ │Flujo  │           │
│  │$2.4M  │ │$1.8M │ │$420K │ │Caja   │           │
│  │↑ 12%  │ │↑ 8%  │ │↑ 15% │ │$340K  │           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
│                                                      │
│  ┌────────────────────────┐  ┌──────────────────┐   │
│  │ P&L Interactivo        │  │ Flujo de Caja    │   │
│  │ (Area Chart animado)   │  │ (Proyección 6M)  │   │
│  │                        │  │                  │   │
│  │ Ingresos vs Gastos     │  │ Entradas ▲       │   │
│  │ por mes/trimestre      │  │ Salidas  ▼       │   │
│  └────────────────────────┘  └──────────────────┘   │
│                                                      │
│  ┌────────────────────────┐  ┌──────────────────┐   │
│  │ Aging de Cartera       │  │ Top 10 Clientes  │   │
│  │ ████ 0-30d  $120K     │  │ por Revenue      │   │
│  │ ███  30-60d $85K      │  │                  │   │
│  │ ██   60-90d $42K      │  │ 1. Acme Corp     │   │
│  │ █    90+d   $18K      │  │ 2. Beta Inc      │   │
│  └────────────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### `/finanzas/cuentas-cobrar` — AR (Accounts Receivable)

- Tabla con todas las facturas pendientes de cobro
- Filtros: cliente, monto, antigüedad, vendedor
- Estado visual: verde (al día), amarillo (30-60d), rojo (60+d)
- Click en factura → detalle con historial de pagos
- KPIs: DSO (Days Sales Outstanding), total pendiente, promedio de cobro

### `/finanzas/cuentas-pagar` — AP (Accounts Payable)

- Tabla con todas las facturas pendientes de pago
- Filtros: proveedor, monto, fecha vencimiento
- Calendario de pagos (timeline visual)
- Alertas AI: "3 facturas vencen esta semana por $45,000"

### `/finanzas/centros-costo` — Controlling

- Treemap interactivo de gastos por centro de costo
- Drill-down: empresa → departamento → centro de costo → partidas
- Presupuesto vs real (gauge charts)
- Comparación año actual vs anterior

## Tablas Supabase

```sql
-- Cuentas y estructura contable
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  account_number VARCHAR(10) NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  sap_account_code VARCHAR(10), -- Mapping a SAP
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transacciones financieras (journal entries)
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  document_number VARCHAR(20) NOT NULL,
  posting_date DATE NOT NULL,
  document_date DATE NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  debit_credit TEXT CHECK (debit_credit IN ('debit', 'credit')),
  cost_center_id UUID REFERENCES cost_centers(id),
  description TEXT,
  sap_document_id VARCHAR(10), -- Mapping a BKPF
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cuentas por cobrar
CREATE TABLE accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL, -- FK a tabla de clientes
  invoice_number VARCHAR(20) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'overdue', 'written_off')),
  salesperson_id UUID,
  sap_document_id VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cuentas por pagar
CREATE TABLE accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  vendor_id UUID NOT NULL, -- FK a tabla de proveedores
  invoice_number VARCHAR(20) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'overdue')),
  purchase_order_id UUID,
  sap_document_id VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Centros de costo
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  manager_id UUID,
  budget_annual DECIMAL(15,2),
  actual_ytd DECIMAL(15,2) DEFAULT 0,
  parent_id UUID REFERENCES cost_centers(id),
  sap_cost_center VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## UI Components Clave

| Componente           | Librería             | Descripción                                             |
| -------------------- | -------------------- | ------------------------------------------------------- |
| P&L Area Chart       | Recharts `AreaChart` | Ingresos vs gastos, gradiente, tooltips ricos           |
| Aging Bar Chart      | Recharts `BarChart`  | Horizontal, colores por rango de días                   |
| Cash Flow Timeline   | Custom SVG           | Entradas (verde) vs salidas (rojo), proyección punteada |
| Treemap de Costos    | Recharts `Treemap`   | Drill-down por centro de costo                          |
| Gauge de Presupuesto | Custom radial        | Presupuesto vs ejecutado con color dinámico             |
| DataTable            | shadcn `DataTable`   | Facturas AR/AP con sort, filter, export                 |

## AI Integration (Gemini)

```
Preguntas que el usuario puede hacer:
─────────────────────────────────────
→ "¿Cuánto nos deben los clientes?"
→ "¿Qué facturas vencen esta semana?"
→ "¿Cómo va el P&L comparado con el año pasado?"
→ "¿Qué centro de costo gasta más?"
→ "Dame un resumen financiero del mes"
→ "¿Cuál es la proyección de flujo de caja para los próximos 3 meses?"

Function calling:
─────────────────
• get_financial_summary(period) → KPIs financieros
• get_ar_aging() → Aging de cartera
• get_overdue_invoices() → Facturas vencidas
• get_cost_center_analysis(center_id) → Análisis de costos
• project_cash_flow(months) → Proyección flujo de caja
```

## Datos Demo (Seed)

Para la demo, generar:

- **1 plan de cuentas** con ~50 cuentas organizadas jerárquicamente
- **500+ transacciones** distribuidas en los últimos 12 meses
- **80 facturas AR** (30% vencidas) con 15 clientes
- **60 facturas AP** (20% vencidas) con 10 proveedores
- **8 centros de costo** con presupuesto y ejecución
- Montos realistas en USD ($1K - $500K)
