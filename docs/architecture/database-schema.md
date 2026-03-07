# Grixi — Esquema de Base de Datos

> PostgreSQL 17.6 + OrioleDB | Supabase | RLS en todas las tablas

## Diagrama de Relaciones

```
organizations ─────┬──── organization_members ──── auth.users ──── profiles
                   │
                   ├──── roles ──── role_permissions ──── permissions
                   │            └── user_roles
                   │
                   ├──── audit_logs
                   ├──── activity_tracking
                   ├──── active_sessions
                   │
                   ├──── warehouses ──── racks ──── rack_positions ──── inventory
                   │                                                     │
                   ├──── products ──────────────────────────────────────┘
                   │                └── inventory_movements
                   │
                   └──── ai_conversations ──── ai_messages
```

## Tablas por Dominio

### 🏢 Multi-Tenancy (2 tablas)

#### `organizations`

| Columna      | Tipo          | Notas                           |
| ------------ | ------------- | ------------------------------- |
| `id`         | UUID PK       |                                 |
| `name`       | TEXT NOT NULL | Nombre de la empresa            |
| `slug`       | TEXT UNIQUE   | URL-friendly identifier         |
| `logo_url`   | TEXT          | Logo del tenant                 |
| `settings`   | JSONB         | Configuración personalizada     |
| `plan`       | TEXT          | 'demo', 'starter', 'enterprise' |
| `created_at` | TIMESTAMPTZ   |                                 |

#### `organization_members`

| Columna     | Tipo                    | Notas |
| ----------- | ----------------------- | ----- |
| `id`        | UUID PK                 |       |
| `org_id`    | UUID FK → organizations |       |
| `user_id`   | UUID FK → auth.users    |       |
| `joined_at` | TIMESTAMPTZ             |       |
| UNIQUE      | (org_id, user_id)       |       |

---

### 👤 Usuarios y Perfiles (1 tabla)

#### `profiles`

| Columna          | Tipo                    | Notas                      |
| ---------------- | ----------------------- | -------------------------- |
| `id`             | UUID PK FK → auth.users |                            |
| `full_name`      | TEXT                    | De Google                  |
| `avatar_url`     | TEXT                    | Foto de Google             |
| `email`          | TEXT                    |                            |
| `phone`          | TEXT                    |                            |
| `department`     | TEXT                    | Departamento en la empresa |
| `position`       | TEXT                    | Cargo/posición             |
| `bio`            | TEXT                    |                            |
| `preferences`    | JSONB                   | Theme, idioma, etc.        |
| `last_active_at` | TIMESTAMPTZ             |                            |
| `created_at`     | TIMESTAMPTZ             |                            |

---

### 🔐 RBAC Dinámico (4 tablas)

#### `roles`

| Columna       | Tipo                    | Notas                             |
| ------------- | ----------------------- | --------------------------------- |
| `id`          | UUID PK                 |                                   |
| `org_id`      | UUID FK → organizations | Cada org tiene sus roles          |
| `name`        | TEXT NOT NULL           | 'Administrador', 'Operario', etc. |
| `description` | TEXT                    |                                   |
| `is_system`   | BOOLEAN                 | Roles del sistema no editables    |
| `color`       | TEXT                    | Para badges                       |
| `created_at`  | TIMESTAMPTZ             |                                   |
| UNIQUE        | (org_id, name)          |                                   |

#### `permissions`

| Columna       | Tipo             | Notas                              |
| ------------- | ---------------- | ---------------------------------- |
| `id`          | UUID PK          |                                    |
| `module`      | TEXT NOT NULL    | 'warehouse', 'users', etc.         |
| `action`      | TEXT NOT NULL    | 'view', 'create', 'edit', 'delete' |
| `description` | TEXT             |                                    |
| UNIQUE        | (module, action) |                                    |

#### `role_permissions`

| Columna         | Tipo                     | Notas |
| --------------- | ------------------------ | ----- |
| `role_id`       | UUID FK → roles          |       |
| `permission_id` | UUID FK → permissions    |       |
| PRIMARY KEY     | (role_id, permission_id) |       |

#### `user_roles`

| Columna       | Tipo                       | Notas |
| ------------- | -------------------------- | ----- |
| `user_id`     | UUID FK → auth.users       |       |
| `role_id`     | UUID FK → roles            |       |
| `org_id`      | UUID FK → organizations    |       |
| `assigned_at` | TIMESTAMPTZ                |       |
| PRIMARY KEY   | (user_id, role_id, org_id) |       |

---

### 📊 Auditoría y Tracking (3 tablas)

#### `audit_logs`

Registro de TODAS las acciones sobre los datos (INSERT, UPDATE, DELETE).

| Columna         | Tipo        | Notas                                  |
| --------------- | ----------- | -------------------------------------- |
| `id`            | UUID PK     |                                        |
| `org_id`        | UUID FK     |                                        |
| `user_id`       | UUID FK     | Quién hizo la acción                   |
| `action`        | TEXT        | 'create', 'update', 'delete'           |
| `resource_type` | TEXT        | 'warehouse', 'user', 'role', etc.      |
| `resource_id`   | UUID        | ID del registro afectado               |
| `old_data`      | JSONB       | Estado anterior (para updates/deletes) |
| `new_data`      | JSONB       | Estado nuevo                           |
| `ip_address`    | INET        |                                        |
| `user_agent`    | TEXT        |                                        |
| `created_at`    | TIMESTAMPTZ | Índice para queries por rango          |

#### `activity_tracking`

Registro de CADA click, navegación, scroll del usuario.

| Columna        | Tipo        | Notas                                   |
| -------------- | ----------- | --------------------------------------- |
| `id`           | UUID PK     |                                         |
| `org_id`       | UUID FK     |                                         |
| `user_id`      | UUID FK     |                                         |
| `session_id`   | UUID        | Agrupa por sesión                       |
| `event_type`   | TEXT        | 'page_view', 'click', 'scroll', 'focus' |
| `page_path`    | TEXT        | Ruta ej: '/almacenes/1'                 |
| `element_id`   | TEXT        | ID del elemento clickeado               |
| `element_text` | TEXT        | Texto del elemento                      |
| `metadata`     | JSONB       | {x, y, viewport, component}             |
| `created_at`   | TIMESTAMPTZ |                                         |

#### `active_sessions`

Sesiones activas para monitoreo en tiempo real y cierre remoto.

| Columna         | Tipo                 | Notas                          |
| --------------- | -------------------- | ------------------------------ |
| `id`            | UUID PK              |                                |
| `user_id`       | UUID FK → auth.users |                                |
| `org_id`        | UUID FK              |                                |
| `device_info`   | JSONB                | {browser, os, device}          |
| `ip_address`    | INET                 |                                |
| `is_active`     | BOOLEAN              | `false` = terminada            |
| `started_at`    | TIMESTAMPTZ          |                                |
| `last_seen_at`  | TIMESTAMPTZ          | Actualizado por heartbeat      |
| `terminated_at` | TIMESTAMPTZ          |                                |
| `terminated_by` | UUID FK              | Quién la cerró (si fue remoto) |

---

### 🏭 Warehouse / Almacenes (5 tablas)

#### `warehouses`

| Columna         | Tipo          | Notas                                       |
| --------------- | ------------- | ------------------------------------------- |
| `id`            | UUID PK       |                                             |
| `org_id`        | UUID FK       |                                             |
| `name`          | TEXT NOT NULL | 'Almacén Central'                           |
| `type`          | TEXT          | 'standard', 'cross_docking', 'cold_storage' |
| `location`      | TEXT          | Dirección / zona                            |
| `dimensions`    | JSONB         | {width, depth, height} en metros            |
| `layout_config` | JSONB         | Configuración para 3D rendering             |
| `is_active`     | BOOLEAN       |                                             |
| `created_at`    | TIMESTAMPTZ   |                                             |

#### `racks`

| Columna        | Tipo                 | Notas                              |
| -------------- | -------------------- | ---------------------------------- |
| `id`           | UUID PK              |                                    |
| `warehouse_id` | UUID FK → warehouses |                                    |
| `code`         | TEXT NOT NULL        | 'A-01', 'B-03'                     |
| `rack_type`    | TEXT                 | 'standard', 'pallet', 'cantilever' |
| `rows`         | INTEGER              | Niveles verticales                 |
| `columns`      | INTEGER              | Divisiones horizontales            |
| `position_x`   | FLOAT                | Para mapa 2D/3D                    |
| `position_y`   | FLOAT                |                                    |
| `position_z`   | FLOAT                |                                    |
| `dimensions`   | JSONB                | {width, depth, height}             |
| `aisle`        | TEXT                 | Pasillo donde está                 |
| `created_at`   | TIMESTAMPTZ          |                                    |
| UNIQUE         | (warehouse_id, code) |                                    |

#### `rack_positions`

Cada celda individual dentro de un rack.

| Columna         | Tipo                                 | Notas                                      |
| --------------- | ------------------------------------ | ------------------------------------------ |
| `id`            | UUID PK                              |                                            |
| `rack_id`       | UUID FK → racks                      |                                            |
| `row_number`    | INTEGER                              | Nivel (1=abajo)                            |
| `column_number` | INTEGER                              | Posición horizontal                        |
| `status`        | TEXT                                 | 'empty', 'occupied', 'reserved', 'blocked' |
| `max_weight`    | FLOAT                                | Capacidad en kg                            |
| UNIQUE          | (rack_id, row_number, column_number) |                                            |

#### `products`

| Columna           | Tipo          | Notas                   |
| ----------------- | ------------- | ----------------------- |
| `id`              | UUID PK       |                         |
| `org_id`          | UUID FK       |                         |
| `sku`             | TEXT NOT NULL | Código SAP              |
| `name`            | TEXT NOT NULL |                         |
| `description`     | TEXT          |                         |
| `category`        | TEXT          |                         |
| `unit_of_measure` | TEXT          | 'kg', 'units', 'liters' |
| `weight`          | FLOAT         | Peso unitario           |
| `dimensions`      | JSONB         | {length, width, height} |
| `image_url`       | TEXT          |                         |
| `min_stock`       | INTEGER       | Stock mínimo alerta     |
| `created_at`      | TIMESTAMPTZ   |                         |
| UNIQUE            | (org_id, sku) |                         |

#### `inventory`

Qué hay en cada posición del rack.

| Columna          | Tipo                     | Notas                                         |
| ---------------- | ------------------------ | --------------------------------------------- |
| `id`             | UUID PK                  |                                               |
| `position_id`    | UUID FK → rack_positions |                                               |
| `product_id`     | UUID FK → products       |                                               |
| `lot_number`     | TEXT                     | Número de lote                                |
| `batch_code`     | TEXT                     | Código de batch                               |
| `quantity`       | FLOAT NOT NULL           |                                               |
| `entry_date`     | TIMESTAMPTZ              | Cuándo entró                                  |
| `expiry_date`    | TIMESTAMPTZ              | Fecha de vencimiento                          |
| `supplier`       | TEXT                     | Proveedor                                     |
| `purchase_order` | TEXT                     | Orden de compra                               |
| `sap_reference`  | TEXT                     | Referencia SAP                                |
| `status`         | TEXT                     | 'active', 'expired', 'quarantine', 'reserved' |

#### `inventory_movements`

Registro de entradas, salidas, transferencias.

| Columna            | Tipo                 | Notas                       |
| ------------------ | -------------------- | --------------------------- |
| `id`               | UUID PK              |                             |
| `org_id`           | UUID FK              |                             |
| `product_id`       | UUID FK → products   |                             |
| `from_position_id` | UUID FK nullable     | NULL en entradas            |
| `to_position_id`   | UUID FK nullable     | NULL en salidas             |
| `quantity`         | FLOAT NOT NULL       |                             |
| `movement_type`    | TEXT                 | 'entry', 'exit', 'transfer' |
| `reference`        | TEXT                 | Guía, orden, etc.           |
| `performed_by`     | UUID FK → auth.users |                             |
| `created_at`       | TIMESTAMPTZ          |                             |

---

### 🤖 Inteligencia Artificial (2 tablas)

#### `ai_conversations`

| Columna      | Tipo        | Notas                           |
| ------------ | ----------- | ------------------------------- |
| `id`         | UUID PK     |                                 |
| `org_id`     | UUID FK     |                                 |
| `user_id`    | UUID FK     |                                 |
| `module`     | TEXT        | 'warehouse', 'audit', 'general' |
| `title`      | TEXT        | Auto-generado por IA            |
| `created_at` | TIMESTAMPTZ |                                 |

#### `ai_messages`

| Columna           | Tipo                       | Notas                                |
| ----------------- | -------------------------- | ------------------------------------ |
| `id`              | UUID PK                    |                                      |
| `conversation_id` | UUID FK → ai_conversations |                                      |
| `role`            | TEXT                       | 'user', 'assistant'                  |
| `content`         | TEXT NOT NULL              |                                      |
| `metadata`        | JSONB                      | Acciones ejecutadas, racks mostrados |
| `tokens_used`     | INTEGER                    | Para tracking de costos              |
| `created_at`      | TIMESTAMPTZ                |                                      |

---

## Indexes Requeridos

```sql
-- Audit performance
CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_tracking_user_session ON activity_tracking(user_id, session_id);
CREATE INDEX idx_activity_tracking_created ON activity_tracking(created_at DESC);

-- Sessions
CREATE INDEX idx_active_sessions_user ON active_sessions(user_id, is_active);

-- Warehouse
CREATE INDEX idx_racks_warehouse ON racks(warehouse_id);
CREATE INDEX idx_rack_positions_rack ON rack_positions(rack_id);
CREATE INDEX idx_inventory_position ON inventory(position_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_expiry ON inventory(expiry_date) WHERE status = 'active';
CREATE INDEX idx_inventory_movements_org ON inventory_movements(org_id, created_at DESC);

-- Products
CREATE INDEX idx_products_org_sku ON products(org_id, sku);
CREATE INDEX idx_products_category ON products(org_id, category);
```

## RLS Base Pattern

```sql
-- Cada tabla con org_id usa este patrón:
CREATE POLICY "tenant_isolation" ON [table_name]
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
```
