# 09 — Pedidos de Venta (Sales Orders)

## 9.1 Concepto

Los Pedidos de Venta (Sales Orders) son el disparador principal para las Salidas de Mercancía. Simulan el módulo SD (Sales & Distribution) de SAP. En la demo, los pedidos "llegan de SAP" pre-cargados y el operador debe despacharlos.

---

## 9.2 Modelo de Datos

Ya definido en `02-MODELO-DATOS.md`: tablas `sales_orders` y `sales_order_items`.

---

## 9.3 UI: Lista de Pedidos de Venta

```
┌─ Pedidos de Venta ───────────────────────────────────────────────┐
│                                                                  │
│  ┌─ KPIs Rápidos ────────────────────────────────────────────┐  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │  │
│  │ │    18    │ │    10    │ │     6    │ │ $125K    │      │  │
│  │ │Pendientes│ │ Picking  │ │Despachados│ │ Valor    │      │  │
│  │ │          │ │ Activo   │ │ Hoy      │ │ Mes      │      │  │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Toolbar ─────────────────────────────────────────────────┐  │
│  │ [+ Nuevo Pedido] [Estado: Todos ▼] [Prioridad ▼] [🔍]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ # Pedido     │ Cliente            │ Items │ Total   │Estado│  │
│  │──────────────┼────────────────────┼───────┼─────────┼──────│  │
│  │ SO-2026-0048 │ PETROECUADOR EP    │ 5     │ $18,500 │🔴 Urg│  │
│  │ SO-2026-0047 │ Ind. del Pacífico  │ 3     │ $8,750  │🟡 Pick│  │
│  │ SO-2026-0046 │ Distr. Nacional    │ 4     │ $12,300 │🟢 Desp│  │
│  │ SO-2026-0045 │ MetalTech Ecuador  │ 2     │ $3,200  │🔵 Conf│  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9.4 Detalle del Pedido de Venta

Click en una fila abre drawer lateral:

```
┌─ Pedido SO-2026-0048 ────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Header ──────────────────────────────────────────────────┐  │
│  │ 📦 SO-2026-0048                       🔴 Urgente         │  │
│  │ SAP: 0080054321                                           │  │
│  │ Cliente: PETROECUADOR EP                                  │  │
│  │ Código: CL-001                                            │  │
│  │ Entrega solicitada: 02/04/2026                            │  │
│  │ Almacén: Almacén Central                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Progreso ────────────────────────────────────────────────┐  │
│  │ ░░░░░░░░░░░░░░░░░░░░ 0% Despachado                      │  │
│  │ Confirmado → Picking → Despacho → Entregado              │  │
│  │ ████████                                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Items ───────────────────────────────────────────────────┐  │
│  │ #  │ Material           │ Cant. │ Picked │ Disp. │ Estado│  │
│  │ 10 │ Motor Eléct. 5HP   │  20   │   0    │  85 ✅ │  ⏳  │  │
│  │ 20 │ Bomba Rexroth      │  10   │   0    │  12 ✅ │  ⏳  │  │
│  │ 30 │ Variador ABB       │   5   │   0    │   8 ✅ │  ⏳  │  │
│  │ 40 │ Cable 12AWG 100m   │   3   │   0    │  15 ✅ │  ⏳  │  │
│  │ 50 │ Guantes Nitrilo    │  50   │   0    │  80 ✅ │  ⏳  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Dirección de Envío ──────────────────────────────────────┐  │
│  │ Km 7.5 Vía a Quevedo, Parque Industrial La Maná          │  │
│  │ Contacto: Ing. Roberto Falconí — 0999-123-456            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Crear Salida de Mercancía →]                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9.5 Estados del Pedido de Venta

```
pending → confirmed → picking → partially_shipped → shipped → delivered
                                                                  │
                                                            cancelled
```

| Estado | Significado | Acción siguiente |
|--------|------------|------------------|
| `pending` | Recibido de SAP, sin confirmar | Confirmar stock |
| `confirmed` | Stock verificado y disponible | Crear Goods Issue |
| `picking` | Operador realizando picking | Confirmar picks |
| `partially_shipped` | Envío parcial (back-order) | Completar envío |
| `shipped` | Completamente despachado | Confirmar entrega |
| `delivered` | Cliente confirmó recepción | Cerrar |
| `cancelled` | Cancelado | — |

---

## 9.6 Data Demo: Clientes Simulados

| Código | Nombre | RUC | Ciudad | Tipo |
|--------|--------|-----|--------|------|
| CL-001 | PETROECUADOR EP | 1768152130001 | Quito | Estatal |
| CL-002 | Industrias del Pacífico S.A. | 0992123456001 | Guayaquil | Industrial |
| CL-003 | Distribuidora Nacional del Ecuador | 0701987654001 | Machala | Distribuidor |
| CL-004 | Marbelize S.A. | 1391234567001 | Manta | Manufactura |
| CL-005 | Cervecería Nacional CN S.A. | 0990001765001 | Guayaquil | F&B |
| CL-006 | Holcim Ecuador S.A. | 0990017562001 | Guayaquil | Construcción |
| CL-007 | Pronaca C.A. | 1790319857001 | Quito | Agroindustria |
| CL-008 | OCP Ecuador S.A. | 1791418476001 | Quito | Oil & Gas |

---

## 9.7 Formulario de Nuevo Pedido

Para la demo, también se puede crear un pedido manual:

```
┌─ Nuevo Pedido de Venta ──────────────────────────────────────────┐
│                                                                  │
│  # Auto: SO-2026-0049                                           │
│  SAP Ref: [____________] (opcional)                             │
│  Cliente: [🔍 Buscar cliente...]                                │
│  Almacén: [Almacén Central ▼]                                   │
│  Prioridad: [Media ▼]                                           │
│  Entrega solicitada: [DD/MM/AAAA]                               │
│  Dirección envío: [________________________________]            │
│                                                                  │
│  [+ Agregar Ítem]                                                │
│                                                                  │
│  ┌─ Ítems ───────────────────────────────────────────────────┐  │
│  │ #  │ Producto [🔍]        │ Cant. │ Precio │ Total        │  │
│  │ 10 │ Rodamiento SKF 6205  │ [100] │ $18.50 │ $1,850.00   │  │
│  │ 20 │ Motor Eléctrico 5HP  │ [5  ] │ $180   │ $900.00     │  │
│  │    │                      │       │  Sub:   │ $2,750.00   │  │
│  │    │                      │       │  IVA:   │ $412.50     │  │
│  │    │                      │       │  Total: │ $3,162.50   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancelar]                  [Guardar Borrador]  [✓ Confirmar]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
