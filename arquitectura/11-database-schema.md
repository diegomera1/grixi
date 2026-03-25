# Alternativa 1 — Schema de Base de Datos Multi-Tenant

> PostgreSQL 17 (OrioleDB) en Supabase. Schema completo desde cero.
> **Principio:** `organization_id` en TODAS las tablas + RLS = aislamiento total.

---

## 1. Principios de Diseño

```
REGLAS ABSOLUTAS:
  1. TODA tabla tiene organization_id (excepto organizations y la tabla de plataforma)
  2. RLS HABILITADO en TODAS las tablas sin excepción
  3. INDEX en TODA columna usada en WHERE o JOIN
  4. UUID para todos los IDs
  5. snake_case plural para nombres de tablas
  6. created_at + updated_at en toda tabla
  7. Soft delete con deleted_at (nunca DELETE físico de datos de negocio)
```

---

## 2. Extensiones Requeridas

```sql
-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- Encriptación
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- Búsqueda fuzzy
CREATE EXTENSION IF NOT EXISTS "unaccent";         -- Búsqueda sin acentos
```

---

## 3. Funciones Helper (antes de las tablas)

```sql
-- Obtener el organization_id del JWT del usuario actual
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Obtener todos los org_ids a los que pertenece el usuario
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM memberships
  WHERE user_id = auth.uid() AND status = 'active';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Verificar si el usuario es SuperAdmin de la plataforma
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Verificar si el usuario tiene un permiso específico en su org
CREATE OR REPLACE FUNCTION has_permission(permission_key TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    JOIN roles r ON r.id = m.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE m.user_id = auth.uid()
      AND m.organization_id = get_user_org_id()
      AND m.status = 'active'
      AND p.key = permission_key
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Timestamps automáticos
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Core: Organizaciones y Usuarios

### organizations (multi-tenant root)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,          -- empresa-x → empresa-x.grixi.io
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366F1',
  plan TEXT NOT NULL DEFAULT 'demo',  -- 'demo' | 'starter' | 'professional' | 'enterprise'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'trial'
  settings JSONB DEFAULT '{}',        -- Configuraciones custom
  max_users INTEGER DEFAULT 100,
  modules TEXT[] DEFAULT ARRAY['dashboard', 'almacenes', 'compras', 'finanzas', 'rrhh', 'flota', 'ai'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_orgs_slug ON organizations(slug);
CREATE INDEX idx_orgs_status ON organizations(status);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- RLS: Solo platform admins pueden ver todas las orgs
-- Usuarios normales solo ven su propia org
CREATE POLICY "users_see_own_org" ON organizations FOR SELECT USING (
  id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "platform_admin_manage" ON organizations FOR ALL USING (
  is_platform_admin()
);
```

### profiles (extiende auth.users)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/Guayaquil',
  language TEXT DEFAULT 'es',
  notification_preferences JSONB DEFAULT '{"email": true, "in_app": true}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_profile" ON profiles FOR SELECT USING (
  id = auth.uid() OR is_platform_admin()
);
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid());
```

### memberships (usuario ↔ organización)

```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'invited' | 'suspended'
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_memberships_status ON memberships(status);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON memberships FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
```

### roles y permissions (RBAC granular)

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- 'owner' | 'admin' | 'member' | 'viewer'
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE, -- Roles del sistema no se pueden eliminar
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,      -- 'warehouses.create', 'purchases.approve', etc.
  module TEXT NOT NULL,          -- 'almacenes', 'compras', 'finanzas'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON roles FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "all_can_read" ON permissions FOR SELECT USING (true);
CREATE POLICY "tenant_isolation" ON role_permissions FOR ALL USING (
  role_id IN (SELECT id FROM roles WHERE organization_id IN (SELECT get_user_org_ids()))
  OR is_platform_admin()
);
```

### platform_admins

```sql
CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "only_admins_see" ON platform_admins FOR SELECT USING (is_platform_admin());
```

---

## 5. Módulo: Almacenes

```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  total_capacity INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  settings JSONB DEFAULT '{}',   -- Config 3D, layout
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,             -- 'A1', 'B3', etc.
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  levels INTEGER DEFAULT 4,       -- Niveles del rack
  position_x FLOAT DEFAULT 0,    -- Posición en modelo 3D
  position_z FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rack_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rack_id UUID NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,          -- 1-4
  position INTEGER NOT NULL,       -- Slot dentro del nivel
  product_id UUID REFERENCES products(id),
  quantity INTEGER DEFAULT 0,
  status TEXT DEFAULT 'empty',     -- 'empty' | 'occupied' | 'reserved'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'unidad',
  min_stock INTEGER DEFAULT 0,
  image_url TEXT,
  weight_kg FLOAT,
  dimensions JSONB,               -- {length, width, height}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(organization_id, sku)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  rack_position_id UUID REFERENCES rack_positions(id),
  type TEXT NOT NULL,              -- 'entry' | 'exit' | 'transfer' | 'adjustment'
  quantity INTEGER NOT NULL,
  reference TEXT,                  -- PO number, transfer ID, etc.
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_warehouses_org ON warehouses(organization_id);
CREATE INDEX idx_racks_warehouse ON racks(warehouse_id);
CREATE INDEX idx_rack_positions_rack ON rack_positions(rack_id);
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_sku ON products(organization_id, sku);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_warehouse ON inventory_movements(warehouse_id);

-- RLS (patrón repetido en todos los módulos)
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON warehouses FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON racks FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON rack_positions FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON products FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON inventory_movements FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
```

---

## 6. Módulo: Compras

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,                    -- RUC/NIT
  email TEXT,
  phone TEXT,
  address TEXT,
  category TEXT,
  compliance_score INTEGER DEFAULT 100,  -- 0-100
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft'|'pending'|'approved'|'received'|'cancelled'
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  expected_date DATE,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, po_number)
);

CREATE TABLE po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes + RLS
CREATE INDEX idx_vendors_org ON vendors(organization_id);
CREATE INDEX idx_po_org ON purchase_orders(organization_id);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_items_po ON po_items(purchase_order_id);
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON vendors FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON purchase_orders FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON po_items FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
```

---

## 7. Módulo: Finanzas

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,              -- '1.1.01', '2.1.03'
  name TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'asset'|'liability'|'equity'|'revenue'|'expense'
  parent_id UUID REFERENCES accounts(id),
  balance DECIMAL(14,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'posted',    -- 'draft'|'posted'|'void'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, entry_number)
);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  description TEXT
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'receivable'|'payable'
  vendor_id UUID REFERENCES vendors(id),
  amount DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',   -- 'pending'|'paid'|'overdue'|'cancelled'
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, invoice_number)
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period TEXT NOT NULL,            -- '2026-Q1', '2026-03'
  account_id UUID REFERENCES accounts(id),
  planned DECIMAL(12,2) NOT NULL,
  actual DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes + RLS (todas las tablas)
CREATE INDEX idx_accounts_org ON accounts(organization_id);
CREATE INDEX idx_journal_entries_org ON journal_entries(organization_id);
CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX idx_budgets_org ON budgets(organization_id);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON accounts FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON journal_entries FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON journal_lines FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON invoices FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON budgets FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
```

---

## 8. Módulo: RRHH

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  head_id UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),   -- Vinculado si tiene cuenta en GRIXI
  employee_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id UUID REFERENCES departments(id),
  position TEXT,
  hire_date DATE,
  salary DECIMAL(10,2),
  status TEXT DEFAULT 'active',      -- 'active'|'inactive'|'on_leave'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(organization_id, employee_number)
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours_worked DECIMAL(4,2),
  status TEXT DEFAULT 'present',    -- 'present'|'absent'|'late'|'leave'
  notes TEXT,
  UNIQUE(employee_id, date)
);

-- Indexes + RLS
CREATE INDEX idx_departments_org ON departments(organization_id);
CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(organization_id, date);
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON departments FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON employees FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON attendance FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
```

---

## 9. Módulo: Flota

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plate TEXT,
  type TEXT NOT NULL DEFAULT 'truck',   -- 'truck'|'van'|'vessel'|'forklift'
  model TEXT,
  year INTEGER,
  vin TEXT,
  status TEXT DEFAULT 'active',         -- 'active'|'maintenance'|'inactive'
  fuel_type TEXT DEFAULT 'diesel',
  mileage INTEGER DEFAULT 0,
  image_url TEXT,
  specs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE maintenance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  order_number TEXT NOT NULL,
  type TEXT NOT NULL,                   -- 'preventive'|'corrective'|'inspection'
  status TEXT DEFAULT 'scheduled',      -- 'scheduled'|'in_progress'|'completed'|'cancelled'
  description TEXT,
  cost DECIMAL(10,2),
  scheduled_date DATE,
  completed_at TIMESTAMPTZ,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, order_number)
);

CREATE TABLE crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  vehicle_id UUID REFERENCES vehicles(id),
  role TEXT NOT NULL,                   -- 'driver'|'operator'|'captain'|'mechanic'
  assigned_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active'
);

CREATE TABLE voyages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure TIMESTAMPTZ,
  arrival TIMESTAMPTZ,
  status TEXT DEFAULT 'planned',        -- 'planned'|'in_transit'|'completed'|'cancelled'
  cargo_description TEXT,
  cargo_weight_kg FLOAT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes + RLS
CREATE INDEX idx_vehicles_org ON vehicles(organization_id);
CREATE INDEX idx_maintenance_vehicle ON maintenance_orders(vehicle_id);
CREATE INDEX idx_crew_vehicle ON crew_members(vehicle_id);
CREATE INDEX idx_voyages_vehicle ON voyages(vehicle_id);
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON vehicles FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON maintenance_orders FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON crew_members FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON voyages FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
```

---

## 10. Módulo: AI y Notificaciones

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  module_context TEXT,              -- 'almacenes'|'compras'|'finanzas'|null (global)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                -- 'user'|'assistant'|'system'
  content TEXT NOT NULL,
  rich_content JSONB,               -- Charts, tables, images para rich output
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  model TEXT DEFAULT 'gemini-3.1-flash-lite',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  model TEXT NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost_usd DECIMAL(8,6) NOT NULL,
  module TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,                -- 'info'|'warning'|'error'|'success'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,                         -- Deep link dentro de la app
  read BOOLEAN DEFAULT FALSE,
  channel TEXT DEFAULT 'in_app',     -- 'in_app'|'email'|'both'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,              -- 'create'|'update'|'delete'|'login'|'export'
  entity_type TEXT NOT NULL,         -- 'warehouse'|'purchase_order'|'user'
  entity_id UUID,
  changes JSONB,                     -- {field: {old: x, new: y}}
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes + RLS
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_ai_usage_org ON ai_usage_logs(organization_id, created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_chats" ON chat_sessions FOR ALL USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "own_messages" ON chat_messages FOR ALL USING (
  session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()) OR is_platform_admin()
);
CREATE POLICY "tenant_isolation" ON ai_usage_logs FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY "own_notifications" ON notifications FOR ALL USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "tenant_isolation" ON audit_logs FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
```

---

## 11. Triggers Automáticos

```sql
-- updated_at automático en todas las tablas que lo tengan
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END $$;
```

---

## 12. Seed Data para Demos

```sql
-- Organización demo
INSERT INTO organizations (id, name, slug, plan, modules) VALUES
  ('00000000-0000-0000-0000-000000000001', 'GRIXI Demo', 'demo', 'demo',
   ARRAY['dashboard','almacenes','compras','finanzas','rrhh','flota','ai']);

-- Roles del sistema
INSERT INTO roles (organization_id, name, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner', true),
  ('00000000-0000-0000-0000-000000000001', 'admin', true),
  ('00000000-0000-0000-0000-000000000001', 'member', true),
  ('00000000-0000-0000-0000-000000000001', 'viewer', true);

-- Permisos base (se crean por módulo)
INSERT INTO permissions (key, module, description) VALUES
  ('dashboard.view', 'dashboard', 'Ver dashboard'),
  ('warehouses.view', 'almacenes', 'Ver almacenes'),
  ('warehouses.create', 'almacenes', 'Crear almacenes'),
  ('warehouses.edit', 'almacenes', 'Editar almacenes'),
  ('warehouses.delete', 'almacenes', 'Eliminar almacenes'),
  ('warehouses.3d', 'almacenes', 'Acceso a vista 3D'),
  ('purchases.view', 'compras', 'Ver órdenes de compra'),
  ('purchases.create', 'compras', 'Crear órdenes'),
  ('purchases.approve', 'compras', 'Aprobar órdenes'),
  ('finance.view', 'finanzas', 'Ver finanzas'),
  ('finance.manage', 'finanzas', 'Gestionar asientos'),
  ('hr.view', 'rrhh', 'Ver empleados'),
  ('hr.manage', 'rrhh', 'Gestionar RRHH'),
  ('fleet.view', 'flota', 'Ver flota'),
  ('fleet.manage', 'flota', 'Gestionar flota'),
  ('ai.chat', 'ai', 'Usar GRIXI AI'),
  ('users.view', 'usuarios', 'Ver usuarios'),
  ('users.manage', 'usuarios', 'Gestionar usuarios y roles');
```

---

## 13. Diagrama de Relaciones

```
organizations ──┬── memberships ── auth.users ── profiles
                │                        │
                ├── roles ────── role_permissions ── permissions
                │
                ├── warehouses ── racks ── rack_positions
                │                              │
                ├── products ─────────────────────┘
                │       │
                ├── inventory_movements
                │
                ├── vendors ── purchase_orders ── po_items
                │
                ├── accounts ── journal_entries ── journal_lines
                ├── invoices
                ├── budgets
                │
                ├── departments ── employees ── attendance
                │
                ├── vehicles ── maintenance_orders
                │            ── crew_members
                │            ── voyages
                │
                ├── chat_sessions ── chat_messages
                ├── ai_usage_logs
                ├── notifications
                └── audit_logs
```

**Total: ~30 tablas + RLS en todas + índices en todas las FK y queries comunes.**
