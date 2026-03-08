# 📋 Módulo: Proyectos

> **SAP Equivalente:** PS (Project System) / Jira / Monday.com
> **Ruta:** `/proyectos`
> **Prioridad:** 🟢 Baja (Fase 16)

## ¿Por qué es clave?

Todo equipo necesita gestionar proyectos. Un Kanban + Gantt integrado con los otros módulos de Grixi permite vincular tareas con equipos (mantenimiento), productos (producción), o presupuestos (finanzas).

## Datos que vienen de SAP

| SAP Tabla/T-Code | Dato                    | Uso en Grixi            |
| ---------------- | ----------------------- | ----------------------- |
| `PROJ`           | Definición de proyecto  | Cabecera de proyecto    |
| `PRPS`           | Elementos PEP (WBS)     | Estructura del proyecto |
| `AUFK` (PS)      | Redes/actividades       | Tareas                  |
| `BPGE`           | Presupuesto de proyecto | Control de costos       |
| `T-Code: CJ01`   | Crear proyecto          | Referencia              |
| `T-Code: CJ20N`  | Project Builder         | Estructura              |

## Vistas Principales

### `/proyectos` — Lista de Proyectos

- Cards de proyectos con barra de progreso, líder, fecha límite
- Filtros: estado, departamento, prioridad
- KPIs: proyectos activos, % a tiempo, presupuesto total

### `/proyectos/[id]` — Detalle de Proyecto

- **4 vistas** intercambiables:
  - **Kanban**: Columnas por estado (drag & drop)
  - **Gantt**: Timeline con dependencias
  - **Lista**: DataTable de tareas
  - **Calendario**: Vista mensual de deadlines

### `/proyectos/[id]/tareas/[task_id]` — Detalle de Tarea

- Descripción, assignee, fecha límite, prioridad, etiquetas
- Subtareas con checklist
- Comentarios tipo Slack thread
- Adjuntos
- Time tracking (timer start/stop)

## Tablas Supabase

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN (
    'planning', 'active', 'on_hold', 'completed', 'cancelled'
  )),
  priority TEXT DEFAULT 'medium',
  owner_id UUID REFERENCES profiles(id),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15,2),
  spent DECIMAL(15,2) DEFAULT 0,
  progress DECIMAL(5,2) DEFAULT 0, -- 0-100
  department TEXT,
  sap_project_number VARCHAR(24),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES project_tasks(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT DEFAULT 'medium',
  assignee_id UUID REFERENCES profiles(id),
  start_date DATE,
  due_date DATE,
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  labels JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Visual WOW

- **Kanban** con animaciones de Framer Motion al arrastrar
- **Gantt** con dependencias, línea de hoy, y milestone markers
- **Progress rings** animados por proyecto
- **Time tracker** en vivo tipo Toggl

## Datos Demo

- **8 proyectos** en distintos estados
- **120 tareas** distribuidas en los proyectos
- **50 comentarios** con conversaciones realistas
- **200 registros** de time tracking
