# 07 — Traspasos y Transferencias

## 7.1 Concepto

Los traspasos mueven material entre ubicaciones **sin cambiar la propiedad ni el valor**. En SAP:
- **311:** Traspaso entre ubicaciones del mismo almacén (storage location to storage location)
- **301:** Traspaso entre plantas/almacenes diferentes (plant to plant)

Casos de uso:
- **Reslotting:** Reorganizar el almacén por clasificación ABC
- **Consolidación:** Juntar stock parcial del mismo producto
- **Balanceo:** Mover stock entre almacenes por demanda
- **Limpieza:** Liberar posiciones en zonas críticas

---

## 7.2 Flujo de Traspaso Interno (311)

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUJO DE TRASPASO INTERNO                     │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  PASO 1  │──▶│  PASO 2  │──▶│  PASO 3  │──▶│  PASO 4  │    │
│  │ Seleccion│   │ Seleccion│   │ Confirmar│   │ Contab.  │    │
│  │  Origen  │   │ Destino  │   │ Cantidad │   │  (Post)  │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  Posición con    Posición libre  Verificar que   Move inventory │
│  stock activo    en mismo o      qty <= available Update pos.   │
│                  otro almacén                    Create movement│
└──────────────────────────────────────────────────────────────────┘
```

---

## 7.3 UI: Formulario de Traspaso

```
┌─ Nuevo Traspaso ─────────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Header ──────────────────────────────────────────────────┐  │
│  │ Documento: TO-2026-0013 (auto)                            │  │
│  │ Tipo: [Interno (311) ▼]                                   │  │
│  │ Prioridad: [Media ▼]                                      │  │
│  │ Motivo: [Reslotting ▼] → Otros: Consolidación, Balanceo,  │  │
│  │         Limpieza, Mantenimiento rack, Otro                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ ORIGEN ──────────────────────────────────────────────────┐  │
│  │ Almacén: [Almacén Central ▼]                               │  │
│  │ Rack:    [A01 ▼] → Posición: [Fila 3, Col 2 ▼]           │  │
│  │                                                            │  │
│  │ Stock en posición A01-3-2:                                 │  │
│  │ ┌──────────────────────────────────────────────────────┐  │  │
│  │ │ 📦 Rodamiento SKF 6205                               │  │  │
│  │ │ Cantidad: 120 UN | Lote: LOT-20260115-015            │  │  │
│  │ │ Ingreso: 15/01/2026 | Proveedor: MetalTech           │  │  │
│  │ └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ Cantidad a traspasar: [50    ] de 120 disponibles         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│         ▼ ▼ ▼ ▼ ▼                                               │
│                                                                  │
│  ┌─ DESTINO ─────────────────────────────────────────────────┐  │
│  │ Almacén: [Almacén Central ▼]  (mismo para 311)            │  │
│  │ Rack:    [A03 ▼] → Posición: [Fila 1, Col 4 ▼]          │  │
│  │                                                            │  │
│  │ Estado posición A03-1-4: 🟢 Disponible                   │  │
│  │ Capacidad: 1,500 kg | Peso a mover: 6.0 kg ✅            │  │
│  │                                                            │  │
│  │ [📍 Sugerir Posición]                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Notas ───────────────────────────────────────────────────┐  │
│  │ [Reslotting: mover a zona de alta rotación por ABC-A]     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancelar]        [Guardar Borrador]        [✓ Ejecutar]       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7.4 Traspaso entre Almacenes (301)

Para movimientos entre plantas/almacenes distintos:

```
┌─ Traspaso entre Almacenes ───────────────────────────────────────┐
│                                                                  │
│  Documento: TO-2026-CROSS-0005                                  │
│  Tipo: Entre almacenes (301)                                    │
│  Modo: [Un paso ▼] (vs. Dos pasos con tránsito)                │
│                                                                  │
│  ┌─ ORIGEN ──────────────────────┐  ┌─ DESTINO ──────────────┐  │
│  │ 🏭 Almacén Central            │  │ 🏭 Cámara Fría         │  │
│  │ Planta: 1000                  │  │ Planta: 1000           │  │
│  │ Centro: EC01                  │  │ Centro: EC01           │  │
│  │                               │  │                        │  │
│  │ Rack: A02-4-2                 │  │ Rack: CF01-2-3         │  │
│  │ Aceite Vegetal Industrial     │  │ 🟢 Disponible          │  │
│  │ 200 L disponibles            │  │ Temp.: 4°C ✅           │  │
│  │ Mover: [100] L               │  │                        │  │
│  └───────────────────────────────┘  └────────────────────────┘  │
│                                                                  │
│  ⚠️ Nota: El traspaso entre almacenes generará movimientos     │
│     301 (salida) y 302 (entrada) simultáneos                    │
│                                                                  │
│  [Cancelar]                              [✓ Ejecutar]           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7.5 Tabla de Traspasos

Vista de todos los traspasos con filtros:

```
┌─ Traspasos ──────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Toolbar ─────────────────────────────────────────────────┐  │
│  │ [+ Nuevo Traspaso] [Tipo: Todos ▼] [Estado: Todos ▼] [🔍]│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ # Traspaso     │ Tipo     │ Origen→Dest    │ Cant.│ Estado │  │
│  │────────────────┼──────────┼────────────────┼──────┼────────│  │
│  │ TO-2026-0013   │ 311 Int. │ A01→A03 (Cent.)│ 50   │ 🟢 OK  │  │
│  │ TO-2026-0012   │ 311 Int. │ C01→A03 (Cent.)│ 30   │ 🟢 OK  │  │
│  │ TO-2026-CRS-005│ 301 Cross│ Central→Fría   │ 100  │ 🟡 Trán│  │
│  │ TO-2026-0011   │ 311 Int. │ B02→B01 (M.Pr.)│ 25   │ 🔵 Pend│  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7.6 Estados del Transfer Order

```
pending → in_progress → confirmed → posted
                                       │
                                       ▼
                                 (movement created)
```

| Estado | Significado | Color |
|--------|------------|-------|
| `pending` | Creado, esperando ejecución | Blue |
| `in_progress` | Operador moviendo físicamente | Amber |
| `confirmed` | Movimiento físico confirmado | Indigo |
| `posted` | Contabilizado en el sistema | Emerald |
| `cancelled` | Cancelado | Gray |
| `reversed` | Anulado | Red |

---

## 7.7 Transacción RPC: `wms_post_transfer`

```sql
-- Para cada item del Transfer Order:
-- 1. Verificar stock en origen
-- 2. Reducir quantity del inventory en posición origen
-- 3. Si qty = 0 → liberar posición origen (status = 'available')
-- 4. Crear nuevo inventory record en posición destino (o agregar a existente)
-- 5. Actualizar posición destino (status = 'occupied')
-- 6. Crear 2 inventory_movements:
--    a) Salida: from_position_id = origen, sap_movement_type = '311'
--    b) Entrada: to_position_id = destino, sap_movement_type = '312'
-- 7. Para cross-warehouse (301/302): misma lógica pero entre warehouses
```

---

## 7.8 Notificaciones

```
✅ Traspaso TO-2026-0013 completado
50 × Rodamiento SKF 6205
A01-3-2 → A03-1-4 (Almacén Central)
```

**Actualización 3D:** Posición origen cambia de color, posición destino también.
