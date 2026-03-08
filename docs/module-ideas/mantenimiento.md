# 🔧 Módulo: Mantenimiento

> **SAP Equivalente:** PM (Plant Maintenance)
> **Ruta:** `/mantenimiento`
> **Prioridad:** 🟡 Media (Fase 13)

## ¿Por qué es clave?

Una parada no planificada puede costar miles de dólares por hora. El mantenimiento preventivo y predictivo ahorra dinero. Grixi puede visualizar el estado de cada equipo, programar trabajos, y usar AI para predecir fallas.

## Datos que vienen de SAP

| SAP Tabla/T-Code  | Dato                       | Uso en Grixi        |
| ----------------- | -------------------------- | ------------------- |
| `EQUI`            | Equipos                    | Catálogo de equipos |
| `TPLNR` / `IFLOT` | Ubicaciones técnicas       | Jerarquía de planta |
| `AUFK` (PM)       | Órdenes de mantenimiento   | Lista de OT         |
| `QMEL`            | Avisos (notificaciones)    | Reportes de falla   |
| `MHIS`            | Historial de mantenimiento | Timeline por equipo |
| `MPLA` / `MPOS`   | Planes de mantenimiento    | Calendarios         |
| `T-Code: IW21`    | Crear aviso                | Reporte de falla    |
| `T-Code: IW31`    | Crear OT                   | Orden de trabajo    |
| `T-Code: IP10`    | Programar plan             | Calendario          |

## Vistas Principales

### `/mantenimiento` — Dashboard

- **KPIs**: MTBF, MTTR, % cumplimiento preventivo, OT abiertas
- **Calendario** interactivo con OTs programadas (drag & drop)
- **Semáforo de equipos**: verde (OK) / amarillo (alerta) / rojo (falla)
- **Mapa de planta** con ubicación de equipos (opcional: 3D)

### `/mantenimiento/equipos` — Catálogo de Equipos

- Cards o lista de todos los equipos
- Filtros: ubicación, tipo, estado, criticidad
- Click → ficha técnica con historial completo
- Indicadores: horas operadas, último mantenimiento, próximo programado

### `/mantenimiento/ordenes` — Órdenes de Trabajo

- DataTable con estado visual (colores)
- Tipos: correctivo (rojo), preventivo (azul), predictivo (morado)
- Asignación de técnicos con disponibilidad
- Timer: tiempo de respuesta, tiempo de ejecución

### `/mantenimiento/predictivo` — AI Predictivo

- Gemini analiza patrones de falla históricos
- Alertas: "El compresor #3 tiene 87% probabilidad de falla en 15 días"
- Recomendaciones de mantenimiento basadas en datos
- Gráficos de tendencia (vibración, temperatura, presión — simulados)

## Tablas Supabase

```sql
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(20) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- compresor, bomba, motor, transportador
  location TEXT, -- Planta A, Línea 1
  criticality TEXT DEFAULT 'medium' CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'warning', 'failure', 'maintenance', 'decommissioned')),
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  install_date DATE,
  operating_hours DECIMAL(10,1) DEFAULT 0,
  last_maintenance DATE,
  next_maintenance DATE,
  mtbf_hours DECIMAL(10,1), -- Mean Time Between Failures
  sap_equipment_number VARCHAR(18),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  order_number VARCHAR(20) NOT NULL,
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  type TEXT NOT NULL CHECK (type IN ('corrective', 'preventive', 'predictive')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'assigned', 'in_progress', 'waiting_parts',
    'completed', 'closed', 'cancelled'
  )),
  description TEXT NOT NULL,
  failure_description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  downtime_hours DECIMAL(8,2),
  cost DECIMAL(12,2),
  sap_order_number VARCHAR(12),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  frequency_days INTEGER NOT NULL, -- cada 30, 60, 90, 180 días
  last_executed DATE,
  next_due DATE,
  tasks JSONB, -- lista de tareas a realizar
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Visual WOW

- **Calendario interactivo** tipo Google Calendar con OTs coloreadas por tipo
- **Ficha de equipo** con galería de fotos, medidores de horas, y timeline de historial
- **Dashboard de semáforos** tipo panel de control industrial
- **Predictivo AI** con gráfico de probabilidad de falla (curva con zona roja)

## Datos Demo

- **30 equipos** (compresores, bombas, motores, transportadores)
- **100 órdenes** de mantenimiento (60% correctivo, 30% preventivo, 10% predictivo)
- **10 planes** de mantenimiento activos
- Historial de 12 meses con tendencias
