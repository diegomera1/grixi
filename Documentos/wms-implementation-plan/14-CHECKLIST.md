# 14 — Checklist de Verificación Pre-Demo

## 14.1 Criterios de Aceptación

### Dashboard WMS
- [ ] Hero KPIs muestran datos reales con animación de entrada
- [ ] Pipeline de operaciones con barras por tipo
- [ ] Gráfica de movimientos (7 días) con Recharts AreaChart
- [ ] Cards de ocupación por almacén con anillos SVG + health status
- [ ] Top productos por movimiento (BarChart horizontal)
- [ ] Feed de actividad reciente con timestamps relativos
- [ ] Alertas activas con severidad y acciones
- [ ] **Widget de AI Insights integrado (ver 16-IA-WMS.md)**
- [ ] KPIs secundarios (dock-to-stock, rotación, precisión)
- [ ] Selector de almacén filtra toda la data
- [ ] Responsive en tablet

### Entrada de Mercancía (Goods Receipt)
- [ ] Lista de GRs con filtros y búsqueda
- [ ] Selección de OC pendiente (filtro por almacén y status)
- [ ] Formulario de verificación con qty ordenada vs recibida
- [ ] Campo de nota de entrega, transportista, placa
- [ ] Selector de posición (rack/fila/columna) con estado visual
- [ ] **Botón de sugerencia automática de posición (según estrategia activa)**
- [ ] **Panel de Putaway muestra score y razón por posición**
- [ ] Lote y fecha de vencimiento por item
- [ ] Checkbox de inspección de calidad
- [ ] Motivo de rechazo cuando qty_rejected > 0
- [ ] Contabilización exitosa genera:
  - [ ] Registro en `goods_receipts` con sap_document_id
  - [ ] Registro(s) en `inventory` con position correcto
  - [ ] `rack_positions.status` → 'occupied'
  - [ ] Registro en `inventory_movements` (tipo 101)
  - [ ] `purchase_order_items.received_quantity` actualizado
  - [ ] `purchase_orders.status` → 'partially_received' o 'received'
- [ ] Toast de éxito con número de documento
- [ ] Drawer de detalle del GR completo

### Salida de Mercancía (Goods Issue)
- [ ] Lista de GIs con filtros
- [ ] Vista de Pedidos de Venta pendientes
- [ ] **Auto-localización del stock según estrategia activa (FIFO default)**
- [ ] **Indicador de estrategia con explicación (ej: "FIFO: Lote más antiguo primero")**
- [ ] **Alternativas visibles (FEFO, Consolidación, Mín. Movimiento)**
- [ ] Picking list visual con ruta optimizada
- [ ] Confirmación de picking por item
- [ ] Contabilización exitosa genera:
  - [ ] Registro en `goods_issues` con sap_document_id
  - [ ] Reducción de `inventory.quantity`
  - [ ] Liberación de `rack_positions.status` si qty = 0
  - [ ] Registro en `inventory_movements` (tipo 261)
  - [ ] `sales_order_items.quantity_shipped` actualizado
  - [ ] `sales_orders.status` actualizado
- [ ] Alerta de stock bajo si aplica
- [ ] Toast de éxito

### Traspasos
- [ ] Formulario con origen (posición con stock) y destino (posición libre)
- [ ] Selector visual de posiciones
- [ ] Verificación de capacidad de peso
- [ ] Contabilización mueve inventory y actualiza posiciones
- [ ] Movimientos registrados (311 o 301)
- [ ] Toast de éxito

### Conteo Cíclico
- [ ] Planificación por pasillo/zona
- [ ] Vista de ejecución tipo checklist
- [ ] Indicador de varianza en tiempo real
- [ ] Análisis de varianzas con tabla de diferencias
- [ ] Contabilización genera ajustes (501/502)
- [ ] Precisión de inventario calculada

### Inventario
- [ ] Vista de stock actual por producto/ubicación
- [ ] Filtros por producto, categoría, almacén, estado
- [ ] Expandir fila muestra lotes y detalle
- [ ] Totales por producto consolidados

### Movimientos
- [ ] Historial tipo timeline con iconos
- [ ] Filtros por tipo, producto, usuario, fecha
- [ ] Badge con tipo de movimiento SAP (101, 201, 311...)
- [ ] Link al documento de referencia

### 3D Digital Twin
- [ ] Colores de posiciones reflejan estado real
- [ ] Actualización cuando se ejecuta una operación
- [ ] Click en posición muestra detalle con acciones
- [ ] Overlay de operaciones activas (si hay tiempo)
- [ ] Fly-through funcional
- [ ] HUD de diagnóstico funcional

### Notificaciones
- [ ] Toast premium con animación de entrada/salida
- [ ] Variant success/warning/error/info
- [ ] Badges en tabs con contadores
- [ ] Link "Ver" en toast lleva al detalle

### Data Demo
- [ ] 5 almacenes con códigos SAP
- [ ] 8+ pedidos de venta en distintos estados
- [ ] OCs pendientes de recepción (min 2)
- [ ] Goods receipts históricos (min 50)
- [ ] Goods issues históricos (min 20)
- [ ] Transfer orders históricos (min 10)
- [ ] Physical counts con varianzas (min 1 completo)
- [ ] Movimientos suficientes para gráficas (min 300)
- [ ] **Estrategias configuradas por almacén (putaway + picking)**
- [ ] **Lotes con fechas de vencimiento y características (min 20)**

### Estrategias de Almacén
- [ ] Tabla `warehouse_strategies` con data para cada almacén
- [ ] Putaway sugiere posición según estrategia activa
- [ ] Picking usa FIFO por defecto
- [ ] FEFO override para productos con vencimiento
- [ ] UI muestra estrategia activa y alternativas
- [ ] Configuración editable (si hay tiempo)

### Control de Lotes
- [ ] Tabla `lot_tracking` con data realista
- [ ] Tab Lotes muestra lista con alertas de vencimiento
- [ ] Ficha de lote con características especiales
- [ ] Alertas por vencimiento (colores por urgencia)
- [ ] Acciones: cuarentena, trazabilidad, priorizar despacho
- [ ] Características JSONB: temperatura, peligrosidad, certificación

### Inteligencia Artificial
- [ ] Context enrichment WMS: `buildWMSContext()` inyecta KPIs, ocupación, alertas, tendencias
- [ ] Widget de AI Insights en Dashboard con 3+ insights
- [ ] Tab Análisis IA con:
  - [ ] Insights proactivos (stock-out, desbalance, dead stock)
  - [ ] Botones de reportes rápidos (ABC, tendencias, KPI semanal)
  - [ ] Chat contextual GRIXI AI con contexto WMS
- [ ] IA genera gráficas interactivas (via `<!--CHART:-->` trigger)
- [ ] IA sugiere acciones concretas con links a operaciones
- [ ] Tabla `wms_ai_insights` almacena insights generados

---

## 14.2 Guión de Demo (Script)

### Escenario 1: "Recepción de Mercancía" (5 min)

1. **Dashboard:** Mostrar KPIs y pipeline — "Aquí vemos que tenemos 23 entregas pendientes"
2. **Tab Operaciones → Entradas:** Mostrar lista de GRs existentes
3. **[+ Nueva Entrada]:** Seleccionar OC PO-2026-0095 (urgente)
4. **Verificar cantidades:** Aceptar 100/100 del item 1, Rechazar 1/5 del item 2
5. **Seleccionar ubicación:** Mostrar el selector visual, usar [Auto]
6. **Contabilizar:** Ver toast de éxito con número SAP
7. **Ir al 3D:** Mostrar la posición que acaba de cambiar a ocupada

### Escenario 2: "Despacho por Pedido de Venta" (5 min)

1. **Tab Operaciones → Salidas:** Mostrar lista, destacar SO-2026-0048 (PETROECUADOR, urgente)
2. **Crear Salida:** Sistema auto-localiza stock FIFO
3. **Picking List:** Mostrar la ruta optimizada con checkboxes
4. **Confirmar picks:** Ir marcando items
5. **Contabilizar:** Toast + actualización de SO a "shipped"
6. **Dashboard:** KPIs se actualizan — "Vean, los movimientos del día suben"

### Escenario 3: "Traspaso interno" (3 min)

1. **Tab Operaciones → Traspasos:** [+ Nuevo Traspaso]
2. **Seleccionar origen:** A01-3-2 (Rodamiento SKF, 120 UN)
3. **Mover 50 a:** A03-1-4 (libre) — "Reslotting por ABC"
4. **Ejecutar:** Toast de confirmación
5. **3D:** Mostrar cambio de colores en ambas posiciones

### Escenario 4: "Inteligencia Artificial en Acción" (5 min)

1. **Dashboard:** Mostrar widget de AI Insights — "Miren, la IA detectó riesgo de desabasto y desbalance"
2. **Click en insight:** Mostrar acción sugerida (crear traspaso de balanceo)
3. **Tab Análisis IA:** Hacer click en [ABC] — ver reporte generado con gráfica pie
4. **Preguntar a GRIXI AI:** "¿Cuándo se nos va a acabar el stock de rodamientos SKF?"
5. **Ver respuesta:** Gráfica de proyección + recomendación de reorden
6. **Remate:** "¿Quieres que genere la solicitud de compra?" — "GRIXI no solo muestra datos, piensa por ti"

### Escenario 5: "Dashboard, Lotes y Visibilidad" (3 min)

1. **Dashboard:** Recorrer todas las secciones
2. **Cambiar selector de almacén:** Mostrar cómo filtra todo
3. **Tab Lotes:** Mostrar alertas de vencimiento, ficha de lote con características
4. **Tab Inventario:** Buscar un producto, ver stock por ubicación
5. **Tab Movimientos:** Mostrar historial con nombres de proceso (no solo códigos)
6. **3D:** Navegación fly-through, overlays de heatmap

---

## 14.3 Checklist Pre-Deploy

- [ ] `npm run build` sin errores
- [ ] No console.log's visibles en producción
- [ ] TypeScript strict: 0 errores
- [ ] Data demo verificada en producción
- [ ] URL de demo funcional
- [ ] Performance: Loading < 3s
- [ ] Mobile/Tablet: UI legible
- [ ] Navegación entre tabs fluida (sin flash)
