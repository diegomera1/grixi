# 👥 Módulo: Recursos Humanos

> **SAP Equivalente:** HCM (Human Capital Management) / SuccessFactors
> **Ruta:** `/rrhh`
> **Prioridad:** 🟡 Media (Fase 14)

## ¿Por qué es clave?

Las personas son el recurso más valioso. Un módulo de RRHH moderno con organigramas interactivos, nómina visual, y gestión de asistencia elimina la dependencia de Excel y SAP HCM para consultas del día a día.

## Datos que vienen de SAP

| SAP Tabla/T-Code         | Dato                     | Uso en Grixi             |
| ------------------------ | ------------------------ | ------------------------ |
| `PA0001`                 | Org Assignment           | Departamento, posición   |
| `PA0002`                 | Datos personales         | Nombre, fecha nacimiento |
| `PA0006`                 | Direcciones              | Datos de contacto        |
| `PA0008`                 | Salario base             | Info de nómina           |
| `PA0014`                 | Deducciones recurrentes  | Préstamos, seguros       |
| `PA0015`                 | Pagos adicionales        | Bonos, horas extra       |
| `PA2001`                 | Asistencia               | Marcaciones              |
| `PA2002`                 | Ausencias                | Vacaciones, permisos     |
| `HRP1000`                | Objetos organizacionales | Organigrama              |
| `T-Code: PA20`           | Visualizar empleado      | Maestro de personal      |
| `T-Code: PT61`           | Reporte de tiempo        | Control horario          |
| `T-Code: PC00_M99_CLSTR` | Resultados de nómina     | Recibos                  |

## Vistas Principales

### `/rrhh` — Dashboard de RRHH

- **KPIs**: headcount, rotación %, asistencia hoy %, sobrecosto OT
- **Headcount por departamento** (treemap o bar chart)
- **Cumpleaños del mes** (cards de empleados)
- **Alertas**: contratos por vencer, vacaciones pendientes, evaluaciones

### `/rrhh/organigrama` — Organigrama Interactivo

- **Vista de árbol** expandible/colapsable
- Click en persona → card con datos, reporta a, reportan a él
- Zoom/pan como un mapa
- Colores por departamento
- Drag & drop para simular reorganizaciones

### `/rrhh/empleados` — Directorio de Empleados

- DataTable con foto, nombre, departamento, posición, estado
- Filtros: departamento, tipo contrato, antigüedad
- Click → perfil completo con tabs (personal, laboral, nómina, asistencia)

### `/rrhh/asistencia` — Control de Asistencia

- Vista calendario con marcaciones diarias
- Semáforo: presente (verde), tarde (amarillo), ausente (rojo)
- Resumen semanal/mensual por persona o departamento
- Integración con reloj biométrico (futuro)

### `/rrhh/nomina` — Recibos de Nómina

- Vista de recibo de pago detallada
- Ingresos vs deducciones (gráfico apilado)
- Historial de pagos mensuales
- Comparación inter-mensual

## Tablas Supabase

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  profile_id UUID REFERENCES profiles(id), -- si tiene cuenta Grixi
  employee_number VARCHAR(10) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  document_id VARCHAR(20), -- cédula/pasaporte
  birth_date DATE,
  hire_date DATE NOT NULL,
  contract_end DATE,
  contract_type TEXT DEFAULT 'indefinite' CHECK (contract_type IN ('indefinite', 'fixed', 'temporary', 'intern')),
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  manager_id UUID REFERENCES employees(id),
  work_location TEXT,
  email TEXT,
  phone TEXT,
  base_salary DECIMAL(10,2),
  salary_currency VARCHAR(3) DEFAULT 'USD',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave')),
  sap_personnel_number VARCHAR(8),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'vacation', 'sick', 'permission')),
  hours_worked DECIMAL(4,2),
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  base_salary DECIMAL(10,2),
  overtime_pay DECIMAL(10,2) DEFAULT 0,
  bonuses DECIMAL(10,2) DEFAULT 0,
  deductions JSONB, -- [{type: 'IESS', amount: 120}, ...]
  total_income DECIMAL(10,2),
  total_deductions DECIMAL(10,2),
  net_pay DECIMAL(10,2),
  payment_date DATE,
  status TEXT DEFAULT 'calculated' CHECK (status IN ('calculated', 'approved', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type TEXT NOT NULL CHECK (leave_type IN ('vacation', 'sick', 'maternity', 'paternity', 'personal', 'bereavement')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Visual WOW

- **Organigrama D3.js** tipo LinkedIn con fotos, zoom, pan, animaciones
- **Recibo de nómina** estilo app bancaria moderna (glassmorphism)
- **Calendario de asistencia** con heatmap de colores tipo GitHub contributions
- **Dashboard** con cards animadas y sparklines

## Datos Demo

- **80 empleados** con datos realistas (nombres ecuatorianos, departamentos)
- **Organigrama** de 4 niveles (CEO → directores → gerentes → staff)
- **6 meses** de registros de asistencia
- **6 meses** de recibos de nómina con variaciones realistas
- **20 solicitudes** de vacaciones/permisos
