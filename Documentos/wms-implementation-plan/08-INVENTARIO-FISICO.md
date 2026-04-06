# 08 — Inventario Físico (Conteo Cíclico)

## 8.1 Concepto

El inventario físico permite verificar que las cantidades registradas en el sistema coincidan con lo que realmente hay en el almacén. En SAP equivale a las transacciones **MI01** (crear documento) y **MI04** (ingresar conteo).

Tipos de conteo:
- **Cíclico:** Conteo rotativo de un grupo de posiciones
- **Anual:** Conteo completo del almacén
- **Spot:** Conteo aleatorio de verificación
- **ABC:** Conteo basado en clasificación ABC (A = más frecuente)

---

## 8.2 Flujo

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUJO DE CONTEO CÍCLICO                       │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  PASO 1  │──▶│  PASO 2  │──▶│  PASO 3  │──▶│  PASO 4  │    │
│  │ Planificar│   │ Ejecutar │   │ Analizar │   │ Ajustar  │    │
│  │ Conteo   │   │ Conteo   │   │ Varianzas│   │ Stock    │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  Seleccionar    Operador recorre  Dashboard de   Generar movs. │
│  pasillo/zona   posición por pos  diferencias    501/502       │
│  y posiciones   e ingresa cant.   con detalle    para ajuste   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8.3 Paso 1: Planificar Conteo

```
┌─ Crear Conteo Cíclico ──────────────────────────────────────────┐
│                                                                  │
│  Documento: PC-2026-0006 (auto)                                 │
│  Almacén: [Almacén Central ▼]                                   │
│  Tipo: [Cíclico ▼]                                              │
│  Contador: [Carlos Mendoza ▼]                                   │
│  Supervisor: [Diego Mera ▼]                                     │
│                                                                  │
│  ┌─ Selección de Posiciones ─────────────────────────────────┐  │
│  │ Método: [Por Pasillo ▼]                                    │  │
│  │                                                            │  │
│  │ ☑ Pasillo A (64 posiciones)                               │  │
│  │ ☐ Pasillo B (48 posiciones)                               │  │
│  │ ☐ Pasillo C (56 posiciones)                               │  │
│  │ ☐ Pasillo D (40 posiciones)                               │  │
│  │                                                            │  │
│  │ Total posiciones seleccionadas: 64                        │  │
│  │ Tiempo estimado: ~45 minutos                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancelar]                              [✓ Crear Conteo]       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8.4 Paso 2: Ejecución del Conteo

Vista tipo checklist para el operador:

```
┌─ Conteo Cíclico PC-2026-0006 — En Progreso ────────────────────┐
│                                                                  │
│  Progreso: ████████████░░░░░░░░ 32/64 posiciones (50%)         │
│  Tiempo: 00:22:15 | Estimado restante: ~23 min                  │
│                                                                  │
│  ┌─ Posiciones (Pasillo A, Rack A01) ────────────────────────┐  │
│  │                                                            │  │
│  │  A01-1-1 │ Rodamiento SKF 6205                            │  │
│  │  Sistema: 45 UN │ Conteo: [45    ] │ ✅ OK                │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  A01-1-2 │ Motor Eléctrico 5HP                            │  │
│  │  Sistema: 12 UN │ Conteo: [10    ] │ ⚠️ Varianza: -2     │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  A01-1-3 │ Aceite Hidráulico SAE 68                       │  │
│  │  Sistema: 30 L  │ Conteo: [30    ] │ ✅ OK                │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  A01-1-4 │ Casco Seguridad 3M                             │  │
│  │  Sistema: 25 UN │ Conteo: [27    ] │ ⚠️ Varianza: +2     │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  A01-2-1 │ (Vacante)                                      │  │
│  │  Sistema: 0     │ Conteo: [0     ] │ ✅ OK                │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  A01-2-2 │ Cable Eléctrico 12AWG                          │  │
│  │  Sistema: 80 m  │ Conteo: [___   ] │ ⏳ Pendiente         │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [← Anterior rack]  [Siguiente rack →]                          │
│                                                                  │
│  [Pausar]                    [Guardar Progreso]  [Finalizar]    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8.5 Paso 3: Análisis de Varianzas

```
┌─ Resultado del Conteo PC-2026-0006 ─────────────────────────────┐
│                                                                  │
│  ┌─ Resumen ─────────────────────────────────────────────────┐  │
│  │ Total posiciones: 64                                       │  │
│  │ Contadas: 64                                               │  │
│  │ Sin varianza: 58 (90.6%)                                  │  │
│  │ Con varianza: 6 (9.4%)                                    │  │
│  │ Precisión: 90.6%                                           │  │
│  │ Valor total varianza: -$234.50                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Detalle de Varianzas ─────────────────────────────────────┐ │
│  │ Posición  │ Producto          │ Sistema│ Conteo │ Var│Valor│ │
│  │───────────┼───────────────────┼────────┼────────┼────┼─────│ │
│  │ A01-1-2   │ Motor Eléctr.5HP  │  12    │  10    │ -2 │-$360│ │
│  │ A01-1-4   │ Casco Seg. 3M     │  25    │  27    │ +2 │ +$24│ │
│  │ A02-3-1   │ Guantes Nitrilo   │  40    │  38    │ -2 │ -$12│ │
│  │ A03-2-2   │ Bomba Rexroth     │   3    │   3    │  0 │  $0 │ │
│  │ A04-1-3   │ Válvula Solenoide │   8    │   7    │ -1 │ -$45│ │
│  │ A04-4-2   │ Rodamiento SKF    │  85    │  86    │ +1 │+$18 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Acciones ────────────────────────────────────────────────┐  │
│  │ ☑ A01-1-2: Aprobar ajuste -2 Motor Eléctrico             │  │
│  │ ☑ A01-1-4: Aprobar ajuste +2 Casco Seguridad             │  │
│  │ ☑ A02-3-1: Aprobar ajuste -2 Guantes                     │  │
│  │ ☐ A04-1-3: Solicitar reconcteo                           │  │
│  │ ☑ A04-4-2: Aprobar ajuste +1 Rodamiento                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Solicitar Reconteo (1)]     [✓ Contabilizar Ajustes (4)]     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8.6 Paso 4: Ajuste de Stock

Al contabilizar los ajustes, se generan movimientos:
- **Varianza positiva (+):** Movimiento 501 (entrada sin OC)
- **Varianza negativa (-):** Movimiento 502 (salida por ajuste)

Cada ajuste actualiza la tabla `inventory` y genera el registro en `inventory_movements`.

---

## 8.7 Estados del Conteo

| Estado | Significado | Color |
|--------|------------|-------|
| `planned` | Programado, no iniciado | Blue |
| `in_progress` | Operador contando | Amber |
| `completed` | Conteo terminado, pendiente de revisión | Indigo |
| `posted` | Ajustes contabilizados | Emerald |
| `cancelled` | Cancelado | Gray |
