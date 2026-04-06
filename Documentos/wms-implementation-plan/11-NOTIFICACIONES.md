# 11 — Notificaciones y Alertas

## 11.1 Concepto

El sistema de notificaciones del WMS es el "sistema nervioso" que mantiene al equipo informado de cada operación y alerta. Implementado como **toasts animados**, **badges en tabs**, y un **panel de actividad reciente**.

---

## 11.2 Tipos de Notificación

| Tipo | Trigger | Severidad | Duración Toast |
|------|---------|-----------|----------------|
| Entrada contabilizada | `wms_post_goods_receipt` | Success | 5s |
| Salida contabilizada | `wms_post_goods_issue` | Success | 5s |
| Traspaso completado | `wms_post_transfer` | Success | 5s |
| Conteo finalizado | Count completion | Info | 5s |
| Stock bajo mínimo | Post goods issue check | Warning | 8s, persistent |
| Ocupación crítica | Warehouse occupancy > 90% | Critical | Persistent |
| Lote próximo a vencer | Daily check | Warning | 8s |
| OC retrasada | Expected delivery < today | Warning | 8s |
| Varianza en conteo | Count variance found | Warning | 5s |
| Error de operación | Any operation failure | Error | Persistent |

---

## 11.3 Toast Premium

Diseño del toast animado (Framer Motion):

```
┌──────────────────────────────────────────────────┐
│ ✅                                                │
│ Entrada de Mercancía Contabilizada               │
│                                                   │
│ GR-2026-0052 | 108 unidades                      │
│ Almacén Central | Doc. SAP: MAT-20260401-0052    │
│                                                   │
│ ████████████████████████░░░░ (auto-dismiss 5s)   │
│                                          [Ver →] │
└──────────────────────────────────────────────────┘
```

**Variante Warning:**
```
┌──────────────────────────────────────────────────┐
│ ⚠️                                               │
│ Stock Bajo Mínimo                                │
│                                                   │
│ Motor Eléctrico 5HP: 5 UN restantes             │
│ Mínimo requerido: 10 UN                          │
│ Almacén: Materia Prima                           │
│                                                   │
│ [Crear Sol. Compra]              [Descartar]     │
└──────────────────────────────────────────────────┘
```

---

## 11.4 Implementación

```typescript
// lib/hooks/use-wms-toast.ts

import { toast } from 'sonner'; // o custom toast

type WMSToastType = 'success' | 'warning' | 'error' | 'info';

export function useWMSToast() {
  const showOperationToast = (
    type: WMSToastType,
    title: string,
    details: {
      documentNumber: string;
      quantity?: number;
      warehouse?: string;
      sapDocument?: string;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    toast[type](title, {
      description: `${details.documentNumber} | ${details.quantity} unidades
${details.warehouse} | Doc. SAP: ${details.sapDocument}`,
      duration: type === 'error' ? Infinity : 5000,
      action: details.action,
    });
  };

  return { showOperationToast };
}
```

---

## 11.5 Badges en Tabs

Los tabs de operaciones muestran badges con contadores:

```
Operaciones [7]  →  Sub-tabs:
  Entradas [3]  |  Salidas [2]  |  Traspasos [1]  |  Conteos [1]
```

Badge = documentos en estado pendiente/en progreso.

---

## 11.6 Panel de Actividad (Dashboard)

Feed de las últimas 20 operaciones con iconos, timestamps y links:

```typescript
// Estructura de un item de actividad
type ActivityItem = {
  id: string;
  type: 'goods_receipt' | 'goods_issue' | 'transfer' | 'count' | 'alert';
  icon: '📥' | '📤' | '🔄' | '📋' | '⚠️';
  title: string;
  description: string;
  timestamp: Date;
  user: string;
  documentNumber: string;
  warehouseName: string;
  link?: string;  // URL to the detail view
};
```
