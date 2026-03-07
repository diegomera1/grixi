# Grixi — Warehouse Module: Ideas y Especificaciones

## Tipos de Almacén

### 1. Almacén Central (Standard)

- **Tipo:** Estantería alta con pasillos
- **Layout:** Racks en filas paralelas con pasillos de 3m
- **Racks:** 20 racks, organizados en 4 pasillos (A, B, C, D)
- **Dimensiones rack:** 5 columnas x 8 niveles (40 posiciones/rack)
- **Total posiciones:** 800
- **Productos:** Materias primas, componentes, repuestos
- **Temperatura:** Ambiente (15-25°C)

### 2. Centro Logístico (Cross-Docking)

- **Tipo:** Zona de recepción → Zona de despacho directa
- **Layout:** Racks perimetrales + zonas de staging central
- **Racks:** 12 racks en L + 4 zonas de staging
- **Dimensiones rack:** 4 columnas x 6 niveles (24 posiciones/rack)
- **Total posiciones:** 288
- **Productos:** Productos terminados, pedidos en tránsito
- **Flujo:** Recepción → Clasificación → Despacho (alto volumen)

### 3. Cámara Fría (Cold Storage)

- **Tipo:** Almacenamiento refrigerado
- **Layout:** Racks compactos con pasillos estrechos
- **Racks:** 8 racks doble profundidad
- **Dimensiones rack:** 4 columnas x 6 niveles (24 posiciones/rack)
- **Total posiciones:** 192
- **Productos:** Perecibles, químicos, farmacéuticos
- **Temperatura:** -18°C a 4°C
- **Indicadores extra:** temperatura, humedad

## Vista 3D — Especificaciones Técnicas

### Rendering Engine

- **React Three Fiber** (@react-three/fiber)
- **@react-three/drei** (OrbitControls, Text, Html, Environment)
- **Dynamic import** para no afectar el bundle principal

### Controles

- **Orbit:** Rotación libre, zoom con scroll
- **Click:** Raycast selection → muestra tooltip
- **Doble click:** Zoom automático al rack seleccionado
- **Keyboard:** WASD / flechas para rotar

### Modelo 3D

```
Almacén:
├── Piso (plano con grid)
├── Paredes (transparentes, wireframe)
├── Racks[]
│   ├── Estructura metálica (BoxGeometry, color gris)
│   └── Posiciones[]
│       └── Cada posición = cubo con color por estado
├── Pasillos (marcas en el piso)
├── Zonas de staging (marcas en el piso)
└── Iluminación
    ├── AmbientLight (0.6)
    ├── DirectionalLight (sombras)
    └── PointLight (highlight selección)
```

### Performance 3D

- Instanced meshes para posiciones repetidas
- LOD (Level of Detail) para zoom lejano
- Frustum culling automático
- Máximo 2000 objetos visibles simultáneamente
- Target: 60fps en desktop, 30fps en tablet

## Simulación en Tiempo Real

### Botón "Simular Cambios"

Al presionar, ejecuta una secuencia de cambios:

1. Entrada de 5 productos a posiciones vacías
2. Salida de 3 productos de posiciones ocupadas
3. Un producto cambia a estado "vencido"
4. Una transferencia entre racks

### Tecnología

- Supabase Realtime `postgres_changes` en tabla `inventory`
- React state update instantáneo (optimistic)
- Animación en 3D: cubo cambia de color con transición

## Datos Dummy (tipo SAP)

### Categorías de Productos

- Materias primas (MP-xxxx)
- Componentes electrónicos (CE-xxxx)
- Repuestos mecánicos (RM-xxxx)
- Productos químicos (PQ-xxxx)
- Material de empaque (ME-xxxx)
- Productos terminados (PT-xxxx)

### Campos por producto (SAP-like):

- `sku`: Código de material SAP (ej: "MP-0001")
- `name`: Descripción corta
- `category`: Tipo de material
- `unit_of_measure`: UOM (KG, UN, LT, M)
- `weight`: Peso por unidad
- `min_stock`: Punto de reorden
- `lot_number`: Lote de fabricación
- `batch_code`: Código de batch
- `supplier`: Proveedor
- `purchase_order`: Número de OC
- `sap_reference`: Referencia en SAP MM
- `entry_date`: Fecha GR (Goods Receipt)
- `expiry_date`: Fecha de vencimiento
