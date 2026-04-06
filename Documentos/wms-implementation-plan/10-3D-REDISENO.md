# 10 — 3D Digital Twin — Rediseño

## 10.1 Estado Actual

El visor 3D actual tiene:
- ✅ Escena Three.js con almacenes open-top
- ✅ Racks con posiciones coloreadas por estado
- ✅ HUD con 10+ paneles de diagnóstico
- ✅ 13+ overlays de visualización
- ✅ Fly-through camera (WASD)
- ✅ Product Locator y Box Detail Drawer
- ✅ Worker tracking

**Problemas a resolver:**
- La data 3D no se actualiza cuando se hacen operaciones
- No hay integración con el flujo operativo
- La escena puede ser pesada (84KB de código)
- Falta animación de operaciones en vivo

---

## 10.2 Mejoras Propuestas

### A) Integración Operativa en Tiempo Real

Cuando se ejecuta una operación WMS, el 3D debe reflejarlo:

| Operación | Efecto 3D |
|-----------|----------|
| Goods Receipt (101) | Posición destino → parpadeo emerald → occupied |
| Goods Issue (201/261) | Posición origen → parpadeo rose → available |
| Transfer (311) | Animación de flujo: origen → destino |
| Count start | Posiciones del conteo resaltadas en indigo |

### Implementación:
```typescript
// use-wms-realtime.ts
// Suscribirse a cambios en rack_positions via Supabase Realtime
// Cuando cambia status → actualizar geometría en la escena

const channel = supabase
  .channel('wms-3d-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'rack_positions',
    filter: `rack_id=in.(${warehouseRackIds})`
  }, (payload) => {
    // Trigger animation on the changed position
    updatePositionVisual(payload.new.id, payload.new.status);
  })
  .subscribe();
```

---

### B) Overlay de Operaciones Activas

Un nuevo overlay que muestra operaciones en curso:

```
┌─ 3D Scene ──────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Overlay: Operaciones Activas ──────┐                        │
│  │                                     │                        │
│  │ 📥 GR-2026-0052                    │    ┌─────────────┐     │
│  │ Destino: A01-3-2                   │    │ ╔═══╗ ╔═══╗│     │
│  │ Proveedor: MetalTech               │    │ ║   ║ ║   ║│     │
│  │ Estado: ⏳ En inspección            │    │ ║ ★ ║ ║   ║│  ← ★│
│  │                                     │    │ ╚═══╝ ╚═══╝│     │
│  │ 📤 GI-2026-0024                    │    │             │     │
│  │ Fuente: B02-1-4                    │    └─────────────┘     │
│  │ Picking en progreso                │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  [HUD] [Overlays ▼] [Operaciones ☑] [Fly Mode]                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### C) Animaciones de Movimiento

Cuando ocurre un traspaso (311), animar visualmente:

1. **Flash en posición origen** (rose pulse 500ms)
2. **Partícula/línea** viajando de origen a destino (1s)
3. **Flash en posición destino** (emerald pulse 500ms)
4. **Actualización de colores** a nuevo estado

```typescript
// Pseudo-implementation
function animateTransfer(fromPos: Vector3, toPos: Vector3) {
  // 1. Pulse origin (rose)
  pulsePosition(fromPos, '#F43F5E', 500);
  
  // 2. Animated particle trail
  const trail = createParticleTrail(fromPos, toPos, {
    color: '#3B82F6',
    duration: 1000,
    particleCount: 20
  });
  
  // 3. Pulse destination (emerald)
  setTimeout(() => {
    pulsePosition(toPos, '#10B981', 500);
  }, 1000);
}
```

---

### D) Mini-mapa Mejorado

Un mini-mapa 2D en la esquina que muestra la planta del almacén con posiciones coloreadas y la ubicación actual de la cámara:

```
┌─ Mini Mapa ─────────┐
│                      │
│  ▪▪▪▪  ▪▪▪▪  ▪▪▪▪  │  ← filas de racks (colores = status)
│  ▪▪▪▪  ▪▪▪▪  ▪▪▪▪  │
│                      │
│  ▪▪▪▪  ▪▪★▪  ▪▪▪▪  │  ← ★ = posición de la cámara
│  ▪▪▪▪  ▪▪▪▪  ▪▪▪▪  │
│                      │
│  ▪▪▪▪  ▪▪▪▪  ▪▪▪▪  │
│  ▪▪▪▪  ▪▪▪▪  ▪▪▪▪  │
│                      │
└──────────────────────┘
```

---

### E) Panel de Operación Rápida desde 3D

Click en una posición del 3D → Drawer con acciones rápidas:

```
┌─ Posición A01-3-2 ──────────────────────┐
│                                          │
│ Estado: 🟢 Ocupada                      │
│ Producto: Rodamiento SKF 6205           │
│ Cantidad: 120 UN                        │
│ Lote: LOT-20260115-015                  │
│ Ingreso: 15/01/2026                     │
│ Proveedor: MetalTech Ecuador            │
│ Valor: $2,220.00                        │
│                                          │
│ ┌─ Acciones Rápidas ─────────────────┐  │
│ │ [🔄 Crear Traspaso]               │  │
│ │ [📤 Crear Salida]                 │  │
│ │ [📋 Agregar a Conteo]            │  │
│ │ [📊 Ver Historial]               │  │
│ └─────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

---

### F) Modo de Calor: Frecuencia de Movimientos

Un nuevo heatmap overlay que muestra qué posiciones tienen más movimientos (alta rotación = rojo caliente, baja = azul frío):

```
Colores del Heatmap:
- 🔴 Rojo: > 20 movimientos/mes (alta rotación)
- 🟠 Naranja: 10-20 movimientos/mes
- 🟡 Amarillo: 5-10 movimientos/mes
- 🔵 Azul: < 5 movimientos/mes (baja rotación)
- ⚪ Blanco: Sin movimientos
```

---

## 10.3 Performance Optimizations

1. **LOD (Level of Detail):** Racks lejanos renderizan como bloques simples
2. **Instanced Mesh:** Usar instanceado para las cajas repetidas
3. **Frustum Culling:** Solo renderizar lo que la cámara ve
4. **Dynamic Import:** Cargar el módulo 3D solo cuando el tab 3D está activo
5. **Suspense / Skeleton:** Mostrar esqueleto mientras carga la escena

---

## 10.4 Controles Mejorados

```
┌─ Barra de Controles 3D ─────────────────────────────────────────┐
│                                                                  │
│ [🏠 Reset] [🎮 Fly] [👁 Orbit] [📌 Top] [🔍 Buscar] [⚙️ HUD] │
│                                                                  │
│ Overlays: [Heatmap] [IoT] [Workers] [Ops★] [ABC] [Expired]     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

★ = Nuevo overlay de operaciones activas
