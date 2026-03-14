# GRIXI — Arquitectura Multi-Tenant

> Documentación detallada del patrón de aislamiento de datos, configuración en 3 niveles, y prácticas de multi-tenancy para GRIXI.

---

## 1. ¿Qué es Multi-Tenancy?

### 1.1 Definición

Multi-tenancy es una arquitectura donde **una sola instancia** de software sirve a **múltiples organizaciones (tenants)**, manteniendo sus datos completamente aislados entre sí.

```
SIN multi-tenancy:
  Empresa A → App A → DB A  ($$$)
  Empresa B → App B → DB B  ($$$)
  Empresa C → App C → DB C  ($$$)
  = 3 apps, 3 bases de datos, 3x el costo

CON multi-tenancy (GRIXI):
  Empresa A ─┐
  Empresa B ──┼──→ 1 App → 1 DB (con aislamiento RLS)
  Empresa C ─┘
  = 1 app, 1 base de datos, 1x el costo
```

### 1.2 ¿Por Qué Multi-Tenancy para GRIXI?

| Beneficio | Detalle |
|---|---|
| **Costo** | 1 instancia de Supabase ($140/mes) sirve 1-20 empresas |
| **Mantenimiento** | Una sola app para mantener, actualizar, deployar |
| **Velocidad de onboarding** | Agregar una empresa nueva = crear 1 registro en `organizations` |
| **Consistencia** | Todas las empresas usan la misma versión de GRIXI |
| **Economías de escala** | Los costos se diluyen entre más clientes haya |

---

## 2. Patrón Implementado: Shared DB + RLS

### 2.1 Arquitectura de Datos

```
┌───────────────────────────────────────────────────────────┐
│                    PostgreSQL (OrioleDB)                    │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 Schema: public                       │  │
│  │                                                     │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │         CORE TABLES (sin tenant)            │    │  │
│  │  │                                             │    │  │
│  │  │  platform_config      → Config global       │    │  │
│  │  │  platform_admins      → SuperAdmins         │    │  │
│  │  │  organizations        → Lista de tenants    │    │  │
│  │  │  organization_members → User ↔ Org mapping  │    │  │
│  │  │  organization_configs → Overrides por tenant│    │  │
│  │  │  user_preferences     → Prefs por user/org  │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  │                                                     │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │     BUSINESS TABLES (con organization_id)   │    │  │
│  │  │                                             │    │  │
│  │  │  warehouses           → Almacenes           │    │  │
│  │  │  products             → Productos           │    │  │
│  │  │  purchase_orders      → Órdenes de compra   │    │  │
│  │  │  invoices             → Facturas            │    │  │
│  │  │  employees            → Empleados           │    │  │
│  │  │  attendance           → Asistencia          │    │  │
│  │  │  ...                  → Todas llevan org_id │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  │                       ↕                             │  │
│  │              RLS POLICIES                           │  │
│  │           (filtran por org_id)                       │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 2.2 ¿Por Qué Este Patrón?

| Patrón | Costo | Complejidad | Aislamiento | Escalabilidad | GRIXI |
|---|---|---|---|---|---|
| **Shared DB + RLS** | 💚 Bajo | 💚 Baja | 💛 Lógico | 💚 Alta | ✅ **Elegido** |
| Schema-per-Tenant | 💛 Medio | 💛 Media | 💛 Lógico+ | 🔴 Baja | ❌ |
| DB-per-Tenant | 🔴 Alto | 🔴 Alta | 💚 Físico | 💛 Media | ❌ |
| Project-per-Tenant | 🔴 Muy Alto | 🔴 Muy Alta | 💚 Total | 🔴 Baja | ❌ |

**Justificación:**
- 1-20 empresas = el aislamiento RLS es **más que suficiente**
- Un solo proyecto de Supabase = costos mínimos
- Las migraciones se aplican una vez para todos los tenants
- Branching funciona con un solo schema

---

## 3. Sistema de Configuración en 3 Niveles

### 3.1 Modelo Conceptual

```
Nivel 1: PLATAFORMA (platform_config)
│   Definido por: SuperAdmin de GRIXI
│   Alcance: Toda la plataforma
│   Sobreescribible: Solo campos marcados como is_overridable
│
│   Ejemplos:
│   ├── max_file_upload_size: 50MB          (is_overridable: false)
│   ├── available_modules: [almacenes, ...]  (is_overridable: false)
│   ├── default_language: "es"               (is_overridable: true)
│   ├── default_theme: "system"              (is_overridable: true)
│   ├── enable_ai_assistant: true            (is_overridable: true)
│   └── max_users_per_org: 500              (is_overridable: false)
│
├── Si is_overridable = false:
│   → Ningún tenant puede cambiar este valor
│   → Aplica universalmente
│
└── Si is_overridable = true:
    → Un tenant PUEDE tener su propio valor
    → Si no tiene override, usa el valor global
    │
    ↓
Nivel 2: ORGANIZACIÓN (organization_configs)
│   Definido por: Admin de la organización (o SuperAdmin)
│   Alcance: Toda la organización
│   
│   Ejemplos:
│   ├── default_language: "en"        (override del global "es")
│   ├── enable_ai_assistant: false     (override del global true)
│   ├── enabled_modules: ["almacenes", "compras"]
│   ├── branding: { logo, colors }
│   ├── custom_domain: "erp.empresa.com"
│   └── sap_integration: { endpoint, credentials }
│
└── ↓
Nivel 3: USUARIO (user_preferences)
    Definido por: El propio usuario
    Alcance: Solo ese usuario en esa organización
    
    Ejemplos:
    ├── theme: "dark"               (override personal)
    ├── language: "pt"              (override personal)
    ├── sidebar_collapsed: true
    ├── notifications_enabled: false
    └── dashboard_layout: { ... }
```

### 3.2 Resolución de Config (Merge)

```typescript
// Pseudocódigo de resolución
function getEffectiveConfig(userId: string, orgId: string): Config {
  const platform = getPlatformConfig()           // Nivel 1
  const orgOverrides = getOrgOverrides(orgId)    // Nivel 2
  const userPrefs = getUserPreferences(userId, orgId) // Nivel 3
  
  const effective = { ...platform }
  
  // Nivel 2 sobreescribe Nivel 1 (solo campos overridable)
  for (const [key, value] of Object.entries(orgOverrides)) {
    if (platform[key]?.is_overridable) {
      effective[key] = value
    }
    // Si no es overridable, se ignora silenciosamente
  }
  
  // Nivel 3 sobreescribe Nivel 2 (solo preferencias de UI)
  effective.ui = { ...effective.ui, ...userPrefs }
  
  return effective
}
```

### 3.3 Ejemplos Prácticos

#### Ejemplo 1: Idioma

```
Platform:    default_language = "es" (is_overridable: true)
Org "Acme":  default_language = "en" (override)
User "Juan": language = "pt" (preferencia personal)

→ Juan en Acme ve la app en portugués
→ María en Acme (sin preferencia) ve en inglés
→ Pedro en "OtraCorp" (sin override) ve en español
```

#### Ejemplo 2: AI Assistant

```
Platform:    enable_ai_assistant = true (is_overridable: true)
Org "Acme":  enable_ai_assistant = false (override — no quieren AI)

→ Usuarios de Acme NO ven el asistente AI
→ Usuarios de otras empresas SÍ lo ven (usan el global)
```

#### Ejemplo 3: Tamaño máximo de archivo (NO overridable)

```
Platform:    max_file_upload_size = 50MB (is_overridable: false)
Org "Acme":  (intenta setear 200MB → RECHAZADO por constraint)

→ Todas las empresas tienen el mismo límite de 50MB
→ Solo el SuperAdmin puede cambiar este valor globalmente
```

---

## 4. Onboarding de un Nuevo Tenant

### 4.1 Flujo de Onboarding

```
SuperAdmin de GRIXI decide crear nueva empresa
  │
  ↓
1. Crear registro en `organizations`
   ├── name: "Acme Corp"
   ├── slug: "acme"  → acme.grixi.app
   ├── plan: "professional"
   ├── enabled_modules: ["almacenes", "compras", "finanzas"]
   ├── branding: { logo_url, colors }
   └── max_users: 100
  │
  ↓
2. Crear usuario Owner
   ├── auth.users: Crear usuario en Supabase Auth
   └── organization_members: role = "owner"
  │
  ↓  
3. Seed data opcional
   ├── Categorías de productos por defecto
   ├── Unidades de medida
   └── Configuraciones iniciales
  │
  ↓
4. Configurar dominio (si tiene custom domain)
   ├── DNS: CNAME empresa.com → cname.vercel-dns.com
   ├── Vercel: Agregar dominio al proyecto
   └── Cloudflare: Certificado SSL
  │
  ↓
5. Enviar invitación al Owner
   ├── Email con Magic Link
   ├── URL: acme.grixi.app/login
   └── Primer login → setup wizard
  │
  ↓
6. Owner invita a su equipo
   ├── Invitaciones por email
   ├── Roles asignados (admin, member, viewer)
   └── Módulos visibles según configuración
```

### 4.2 Tiempo de Onboarding

| Paso | Método | Tiempo |
|---|---|---|
| Crear organización | Edge Function automatizada | ~5 segundos |
| Configurar branding | Dashboard SuperAdmin | ~5 minutos |
| Seed data | SQL automático | ~10 segundos |
| Custom domain | Manual (DNS) | ~30 minutos (propagación) |
| Invitación al Owner | Email automático | ~1 minuto |
| **Total** | | **~30-40 minutos** |

---

## 5. Aislamiento de Datos — RLS en Profundidad

### 5.1 ¿Cómo Funciona RLS?

Row-Level Security es una feature de **PostgreSQL nativo** que agrega condiciones automáticas a TODAS las queries:

```sql
-- Sin RLS (PELIGROSO):
SELECT * FROM warehouses;
→ Retorna TODOS los warehouses de TODAS las empresas 😱

-- Con RLS:
SELECT * FROM warehouses;
→ PostgreSQL agrega automáticamente:
   SELECT * FROM warehouses
   WHERE organization_id IN (SELECT get_user_org_ids())
→ Solo retorna warehouses de TU empresa ✅
```

**RLS se ejecuta a nivel de PostgreSQL, NO en el código de la aplicación.** Esto significa:

- ✅ Es imposible "olvidar" agregar un filtro en un query
- ✅ Funciona en PostgREST, Realtime, Edge Functions, y SQL directo
- ✅ Incluso si hay un bug en el frontend, los datos están protegidos
- ✅ El `service_role` key bypasa RLS — solo usar server-side

### 5.2 Capas de Protección

```
Capa 1: Middleware (Next.js)
  → Verifica auth cookie
  → Resuelve tenant por subdomain
  → Redirige si no autenticado

Capa 2: Supabase Auth
  → Verifica JWT
  → Extrae user_id y org_ids del token
  → Rechaza tokens inválidos/expirados

Capa 3: RLS Policies
  → PostgreSQL aplica automáticamente
  → Filtra rows por organization_id
  → IMPOSIBLE acceder a datos de otro tenant

Capa 4: Índices
  → organization_id indexado = queries rápidas
  → Sin index = RLS sería lento en tablas grandes
```

### 5.3 Helper Functions

```sql
-- ┌─────────────────────────────────────────────────┐
-- │ get_user_org_ids()                               │
-- │ Retorna los IDs de organizaciones del usuario   │
-- └─────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER      -- Ejecuta con permisos del creador (bypasa RLS)
STABLE                -- No modifica datos (PostgreSQL puede optimizar)
SET search_path = public
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  AND is_active = true
$$;

-- ┌─────────────────────────────────────────────────┐
-- │ is_platform_admin()                              │
-- │ ¿Es el usuario un SuperAdmin de GRIXI?          │
-- └─────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = auth.uid()
  )
$$;

-- ┌─────────────────────────────────────────────────┐
-- │ get_user_role_in_org()                           │
-- │ Retorna el rol del usuario en la org actual     │
-- └─────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION get_user_role_in_org(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  AND organization_id = p_org_id
  AND is_active = true
$$;
```

### 5.4 Patrones de Policies RLS

#### Patrón 1: Lectura por Tenant + SuperAdmin

```sql
-- Usuarios ven datos de sus organizaciones. SuperAdmin ve todo.
CREATE POLICY "tenant_read" ON warehouses FOR SELECT USING (
  organization_id IN (SELECT get_user_org_ids()) 
  OR is_platform_admin()
);
```

#### Patrón 2: Escritura por Rol (Admin de la org)

```sql
-- Solo admin u owner de la org pueden crear/editar
CREATE POLICY "tenant_write" ON warehouses FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);
```

#### Patrón 3: Datos propios del usuario

```sql
-- Cada usuario solo ve sus propias preferencias
CREATE POLICY "own_prefs" ON user_preferences FOR ALL USING (
  user_id = auth.uid()
);
```

#### Patrón 4: Datos públicos (solo lectura)

```sql
-- Todos pueden leer la configuración global
CREATE POLICY "public_read" ON platform_config FOR SELECT USING (true);
```

### 5.5 Anti-patterns a Evitar

| ❌ Anti-pattern | ✅ Correcto |
|---|---|
| Filtrar por org_id en el código JS | Usar RLS policies en PostgreSQL |
| Usar `service_role` key en el frontend | Solo en Server Actions, Edge Functions |
| Olvidar RLS en una tabla nueva | CI verifica que toda tabla tiene `ENABLE ROW LEVEL SECURITY` |
| RLS policy con subquery compleja | Usar helper functions (`get_user_org_ids()`) |
| WHERE de N niveles de join | Materializar datos en la tabla o usar function |
| Olvidar índice en `organization_id` | Crear `idx_[tabla]_org` siempre |

---

## 6. Rendimiento Multi-Tenant

### 6.1 Índices Críticos

Todas las tablas de negocio DEBEN tener:

```sql
-- Índice primario en organization_id (SIEMPRE)
CREATE INDEX idx_[tabla]_org ON [tabla](organization_id);

-- Índice compuesto si hay filtros frecuentes
CREATE INDEX idx_[tabla]_org_status ON [tabla](organization_id, status);
CREATE INDEX idx_[tabla]_org_created ON [tabla](organization_id, created_at DESC);
```

### 6.2 ¿Por qué es necesario para RLS?

Sin índice en `organization_id`:

```
Query: SELECT * FROM warehouses (con RLS)
→ PostgreSQL debe hacer SEQUENTIAL SCAN de toda la tabla
→ Revisar cada row si organization_id coincide
→ En tabla de 100K rows = LENTO 🐢
```

Con índice en `organization_id`:

```
Query: SELECT * FROM warehouses (con RLS)
→ PostgreSQL usa INDEX SCAN en organization_id
→ Solo lee las rows del tenant correcto
→ En tabla de 100K rows = RÁPIDO 🚀
```

### 6.3 Connection Pooling

Con múltiples tenants, las conexiones a la base de datos son un recurso limitado:

```
Sin pooler (conexión directa):
  Empresa A: 20 conexiones
  Empresa B: 15 conexiones
  Empresa C: 25 conexiones
  Total: 60 conexiones → Small compute (60 max) → SATURADO

Con pooler (pgBouncer):
  Todas las empresas comparten un pool de conexiones
  Total: pool de 200 conexiones → reutilizables
  → Puede servir 500+ usuarios concurrentes fácilmente
```

**Supabase incluye pgBouncer** (connection pooler) automáticamente. En GRIXI:
- Frontend usa el **Pooler URL** (no la conexión directa)
- Server Actions usan **Pooler en transaction mode**
- Edge Functions usan **Pooler en session mode**

### 6.4 Noisy Neighbor Prevention

El riesgo de "noisy neighbor" (un tenant consumiendo demasiados recursos):

| Problema | Solución |
|---|---|
| Un tenant hace queries pesados | `statement_timeout` configurado (30s max) |
| Un tenant sube archivos enormes | `max_file_upload_size` en platform_config (50MB) |
| Un tenant tiene millones de rows | Monitoreo de pg_stat_statements + alertas |
| Un tenant hace DDL (ALTER TABLE) | Imposible — solo SuperAdmin tiene acceso admin |
| Edge Function de un tenant loop infinito | 400s wall clock timeout + 2s CPU limit |

---

## 7. Usuarios Multi-Org

### 7.1 ¿Un usuario puede pertenecer a varias empresas?

**Sí.** Un usuario de Supabase Auth puede ser miembro de múltiples organizaciones:

```sql
-- María está en 2 empresas
INSERT INTO organization_members (organization_id, user_id, role) VALUES
  ('org-acme', 'user-maria', 'admin'),
  ('org-beta', 'user-maria', 'member');
```

### 7.2 Flujo de Selección de Organización

```
María inicia sesión
  ↓
JWT contiene: org_ids = ['org-acme', 'org-beta']
  ↓
¿Cuántas orgs tiene?
  ↓
  1 org → Redirigir directamente a esa org
  2+ orgs → Mostrar selector de organización
  0 orgs → Pantalla de "Sin acceso"
  ↓
María selecciona "Acme Corp"
  ↓
Frontend setea org_id activo en cookie/state
  ↓
Todas las queries desde ahora filtran por "org-acme"
```

### 7.3 Consideración de Seguridad

Cuando un usuario pertenece a múltiples orgs, las RLS policies evalúan **TODAS** las org_ids del usuario. Pero el frontend solo muestra datos de la org **activa**:

```typescript
// Client-side: solo query la org activa
const { data } = await supabase
  .from('warehouses')
  .select('*')
  .eq('organization_id', activeOrgId) // Filtro explícito por org activa
  
// RLS por debajo filtra automáticamente, pero el .eq() es best practice
// para evitar mostrar datos de la otra org
```

---

## 8. Escalabilidad

### 8.1 Métricas de Escalado

| Métrica | 5 tenants | 10 tenants | 20 tenants |
|---|---|---|---|
| **Users** | ~50 | ~200 | ~500+ |
| **DB Size** | ~2 GB | ~5 GB | ~15 GB |
| **Concurrent connections** | ~20 | ~60 | ~150 |
| **Realtime channels** | ~50 | ~200 | ~500 |
| **Edge Function calls/mes** | ~100K | ~500K | ~1.5M |
| **Storage** | ~5 GB | ~20 GB | ~60 GB |
| **Compute recomendado** | Small | Medium | Large |

### 8.2 Indicadores para Escalar Compute

| Señal | Acción |
|---|---|
| CPU > 80% sostenido | Subir compute tier |
| Connections near max | Subir compute tier (más pooler connections) |
| Query p95 > 500ms | Revisar índices o subir compute |
| Disk usage > 80% | Subir disk capacity |
| Edge Function timeouts frecuentes | Optimizar función o subir tier |

### 8.3 Cuando Considerar Schema-per-Tenant o Project-per-Tenant

Solo si:
- Un cliente requiere **aislamiento físico** por contrato/regulación (ej. bancario, gobierno)
- Un tenant tiene **volumen 100x mayor** que los demás
- Se requiere **HIPAA compliance** estricto (plan Enterprise de Supabase)

Para GRIXI con 1-20 tenants B2B mid-market, **Shared DB + RLS es más que suficiente**.
