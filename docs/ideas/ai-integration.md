# Grixi — AI Integration (Gemini)

## Configuración

| Parámetro          | Valor                                            |
| ------------------ | ------------------------------------------------ |
| **Modelo**         | `gemini-2.0-flash-lite` (3.1 Flash Lite Preview) |
| **Proveedor**      | Google AI Studio                                 |
| **Llamadas desde** | Server Actions / Edge Functions (NUNCA client)   |
| **Rate limit**     | 10 requests/min por usuario                      |
| **Context window** | Últimos 10 mensajes + datos del módulo actual    |

## Módulos de IA

### 1. Chat General

Un panel lateral flotante accesible desde cualquier módulo.

- Texto conversacional con streaming
- Historial de conversaciones guardado
- Markdown rendering en respuestas

### 2. Warehouse AI

Contexto: datos de inventario, racks, productos del almacén actual.

**Ejemplos de interacción:**

```
Usuario: "¿Dónde está el lote #45821?"
IA: "El lote #45821 está en el Almacén Central, Rack A-03,
     posición fila 2, columna 4. Es una caja de componentes
     electrónicos CE-0034 con 250 unidades.
     Vence el 15/06/2026."
     [Botón: Ver en mapa →]
```

```
Usuario: "¿Qué productos están por vencer?"
IA: "Hay 23 productos que vencen en los próximos 30 días:
     • 8 en Almacén Central (rack A-02, A-05, B-01)
     • 12 en Cámara Fría (rack F-01, F-03)
     • 3 en Centro Logístico (rack L-02)
     [Botón: Ver productos →]"
```

```
Usuario: "Optimiza la distribución del pasillo B"
IA: "Análisis del pasillo B:
     • Ocupación actual: 67%
     • Productos de alta rotación en niveles altos (ineficiente)
     Sugerencia: Mover SKU CE-0012 (280 picks/mes)
     del nivel 7 al nivel 2 para reducir tiempo de picking.
     [Botón: Aplicar sugerencia →]"
```

### 3. Audit AI

Contexto: logs de auditoría y actividad del último período.

**Ejemplos:**

```
Usuario: "Dame un resumen de hoy"
IA: "📊 Resumen del día (7 Mar 2026):
     • 12 usuarios activos
     • 847 acciones registradas
     • 23 entradas de inventario, 15 salidas
     • ⚠️ Anomalía: Usuario Juan Pérez accedió a /admin
       47 veces entre 2:00-3:00 AM (patrón inusual)
     • Top páginas: Dashboard (234), Almacenes (189), Usuarios (98)"
```

### 4. Function Calling (UI Navigation)

El chat puede ejecutar funciones que controlan la interfaz:

```typescript
// Functions disponibles para Gemini
const functions = [
  {
    name: "navigate_to_rack",
    description: "Navega al rack especificado en el mapa",
    parameters: {
      rack_code: "string", // ej: "A-03"
      warehouse_id: "string",
    },
  },
  {
    name: "filter_inventory",
    description: "Aplica filtros al inventario",
    parameters: {
      status: "string",
      category: "string",
      expiry_before: "date",
    },
  },
  {
    name: "show_user_activity",
    description: "Muestra la actividad de un usuario",
    parameters: {
      user_id: "string",
      date_range: "string",
    },
  },
  {
    name: "show_warehouse_stats",
    description: "Muestra estadísticas del almacén",
    parameters: {
      warehouse_id: "string",
    },
  },
];
```

## Arquitectura del Chat

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────▶│ Server Action│────▶│  Gemini API  │
│  (Chat)  │◀────│  (stream)    │◀────│  (streaming) │
└─────────┘     └──────┬───────┘     └──────────────┘
                       │
                ┌──────▼───────┐
                │   Supabase   │
                │ ai_messages  │
                │ ai_convos    │
                └──────────────┘
```

## Seguridad

- API key SOLO en variables de entorno del servidor
- Rate limiting por usuario (10 req/min)
- Prompt injection protection (sanitización)
- No pasar datos sensibles al modelo
- Logs de uso para control de costos
