# ⚙️ Módulo: Producción

> **SAP Equivalente:** PP (Production Planning)
> **Ruta:** `/produccion`
> **Prioridad:** 🟡 Media (Fase 12)

## ¿Por qué es clave?

Para empresas industriales/manufactureras, la producción es el corazón. Visualizar en qué estado está cada orden, qué líneas están activas, y cuál es el rendimiento de la planta en tiempo real es algo que SAP PP hace con pantallas arcaicas. Grixi lo transforma en un monitor de planta moderno.

## Datos que vienen de SAP

| SAP Tabla/T-Code | Dato                      | Uso en Grixi                |
| ---------------- | ------------------------- | --------------------------- |
| `AUFK`           | Órdenes de producción     | Lista/timeline de OPs       |
| `AFKO` / `AFPO`  | Cabecera/posiciones OP    | Materiales y cantidades     |
| `AFVC` / `AFVV`  | Operaciones de ruta       | Secuencia de producción     |
| `STKO` / `STPO`  | Lista de materiales (BOM) | Árbol de componentes        |
| `CRHD`           | Puestos de trabajo        | Centros de trabajo/máquinas |
| `MSEG`           | Movimientos de material   | Consumos y producción       |
| `T-Code: CO01`   | Crear orden producción    | Referencia de campos        |
| `T-Code: CO11N`  | Notificación              | Reportes de avance          |
| `T-Code: CS01`   | Crear BOM                 | Lista de materiales         |

## Vistas Principales

### `/produccion` — Monitor de Planta

- **OEE Dashboard**: Disponibilidad × Rendimiento × Calidad (gauge charts)
- **Líneas de producción**: estado en vivo (activa / parada / mantenimiento)
- **Gantt Chart**: órdenes de producción en el tiempo (draggable)
- **KPIs**: producción hoy vs meta, unidades/hora, rendimiento

### `/produccion/ordenes` — Órdenes de Producción

- DataTable con filtros: estado, producto, línea, fecha
- Timeline visual: planificada → liberada → en proceso → terminada
- Detalle con BOM (árbol de materiales), operaciones, tiempos

### `/produccion/bom` — Bills of Materials

- Vista de árbol interactiva (expandible)
- Para cada producto terminado, ver todos los componentes
- Niveles de profundidad con cantidades
- Alertas: componentes sin stock suficiente

## Tablas Supabase

```sql
CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  order_number VARCHAR(20) NOT NULL,
  product_code VARCHAR(20) NOT NULL,
  product_name TEXT NOT NULL,
  quantity_planned DECIMAL(12,3) NOT NULL,
  quantity_produced DECIMAL(12,3) DEFAULT 0,
  quantity_scrapped DECIMAL(12,3) DEFAULT 0,
  status TEXT DEFAULT 'planned' CHECK (status IN (
    'planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled'
  )),
  production_line TEXT,
  start_date DATE,
  end_date DATE,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal',
  sap_order_number VARCHAR(12),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bill_of_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  parent_material VARCHAR(20) NOT NULL,
  component_material VARCHAR(20) NOT NULL,
  component_name TEXT NOT NULL,
  quantity_per DECIMAL(12,6) NOT NULL,
  unit TEXT DEFAULT 'UN',
  level INTEGER DEFAULT 1,
  is_phantom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  capacity_per_hour DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Visual WOW

- **Gantt chart drag & drop** (reprogramar órdenes arrastrando)
- **Monitor de líneas** tipo panel de control industrial (semáforos, barras de progreso animadas)
- **BOM tree** interactivo con colores por disponibilidad de stock
- **OEE gauge** estilo cockpit con animación fluida

## Datos Demo

- **50 órdenes** de producción en distintos estados
- **15 productos** terminados con BOMs de 3-8 componentes
- **5 líneas** de producción / centros de trabajo
- Datos de OEE realistas (75-92%)
