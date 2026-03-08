# ✅ Módulo: Calidad

> **SAP Equivalente:** QM (Quality Management)
> **Ruta:** `/calidad`
> **Prioridad:** 🟢 Baja (Fase 15)

## ¿Por qué es clave?

Es un diferenciador para empresas industriales con certificaciones ISO. Registrar inspecciones, no conformidades, y acciones correctivas de forma visual y trazable demuestra madurez operacional.

## Datos que vienen de SAP

| SAP Tabla/T-Code | Dato                          | Uso en Grixi         |
| ---------------- | ----------------------------- | -------------------- |
| `QALS`           | Lotes de inspección           | Control de calidad   |
| `QAMV`           | Características de inspección | Parámetros a medir   |
| `QAVE`           | Resultados de inspección      | Datos de medición    |
| `QMEL`           | Notificaciones QM             | No conformidades     |
| `QMSM`           | Acciones/medidas              | Acciones correctivas |
| `T-Code: QA01`   | Crear lote inspección         | Iniciar inspección   |
| `T-Code: QM01`   | Crear notificación QM         | Registrar NC         |

## Vistas Principales

### `/calidad` — Dashboard

- **KPIs**: tasa de rechazo %, NC abiertas, inspecciones del mes, CAPA pendientes
- **Pareto** de defectos (top 5 causas)
- **Tendencia** de calidad mensual (% conformes)
- **Alertas**: lotes retenidos, NC vencidas sin resolver

### `/calidad/inspecciones` — Registro de Inspecciones

- Lista con resultados: aprobado (verde), rechazado (rojo), condicional (amarillo)
- Formulario de inspección con parámetros medibles
- Adjuntar fotos de evidencia
- Vinculación con OC de entrada o producción

### `/calidad/no-conformidades` — NCRs

- Kanban: detectada → analizada → acción correctiva → verificada → cerrada
- Formulario 8D (problema, causa raíz, acciones)
- Timer de días abierta (SLA visual)
- Linking a inspección, proveedor, lote, OC

### `/calidad/capa` — Acciones Correctivas y Preventivas

- Lista de CAPAs con responsable, fecha límite, estado
- Por cada CAPA: evidencia, seguimiento, cierre
- Dashboard de efectividad (% de recurrencia)

## Tablas Supabase

```sql
CREATE TABLE quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  inspection_number VARCHAR(20) NOT NULL,
  type TEXT CHECK (type IN ('incoming', 'in_process', 'final', 'periodic')),
  reference_type TEXT, -- purchase_order, production_order
  reference_id UUID,
  material_code VARCHAR(20),
  lot_number VARCHAR(20),
  inspector_id UUID REFERENCES profiles(id),
  inspection_date DATE NOT NULL,
  result TEXT CHECK (result IN ('approved', 'rejected', 'conditional')),
  parameters JSONB, -- [{name: 'pH', spec: '6.5-7.5', actual: '7.1', pass: true}]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE non_conformances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  ncr_number VARCHAR(20) NOT NULL,
  inspection_id UUID REFERENCES quality_inspections(id),
  severity TEXT DEFAULT 'minor' CHECK (severity IN ('observation', 'minor', 'major', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'analyzing', 'action_defined', 'implementing', 'verifying', 'closed'
  )),
  description TEXT NOT NULL,
  root_cause TEXT,
  immediate_action TEXT,
  responsible_id UUID REFERENCES profiles(id),
  due_date DATE,
  closed_date DATE,
  cost_impact DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  capa_number VARCHAR(20) NOT NULL,
  ncr_id UUID REFERENCES non_conformances(id),
  type TEXT CHECK (type IN ('corrective', 'preventive')),
  description TEXT NOT NULL,
  responsible_id UUID REFERENCES profiles(id),
  due_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'effective')),
  evidence TEXT,
  effectiveness_check BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Datos Demo

- **100 inspecciones** (85% aprobadas, 10% rechazadas, 5% condicionales)
- **25 no conformidades** en distintos estados
- **15 CAPAs** con seguimiento
- Datos de Pareto realistas (contaminación, dimensiones, embalaje, etc.)
