# GRIXI × Supabase — Guía Completa de Infraestructura

> Documento detallado sobre cómo GRIXI utiliza Supabase como el centro de su backend, incluyendo todas las ventajas, configuraciones, y patrones de uso.

---

## 1. ¿Por Qué Supabase?

### 1.1 La Filosofía: Backend sin Backend

GRIXI es un **monolito moderno** donde Supabase reemplaza completamente la necesidad de un servidor backend tradicional (Express, NestJS, Django, etc.). En lugar de mantener un servicio separado con endpoints REST, GRIXI delega TODA la lógica de datos y autenticación a Supabase.

**¿Qué reemplaza Supabase en un stack tradicional?**

| Componente Tradicional | Equivalente Supabase | Ventaja |
|---|---|---|
| Express/NestJS API endpoints | **PostgREST** (API REST automática) | Cero código para CRUD, generación automática |
| Passport.js / Auth0 | **Supabase Auth** | OAuth, Email, Magic Links integrado |
| Socket.io / Pusher | **Supabase Realtime** | WebSockets nativos sobre PostgreSQL |
| AWS S3 / GCS | **Supabase Storage** | CDN integrado con políticas RLS |
| AWS Lambda / Cloud Functions | **Supabase Edge Functions** | Deno runtime en el edge, TypeScript nativo |
| Redis / Memcached | **PostgreSQL + Materialized Views** | Sin servicio extra |
| Servidor dedicado 24/7 | **Servicio gestionado** | Sin devops, sin Docker, sin servidores |

### 1.2 Ventajas Clave para GRIXI

#### ✅ Velocidad de Desarrollo
- **PostgREST genera APIs automáticamente** desde el schema PostgreSQL. Si creas una tabla, ya tienes GET, POST, PUT, DELETE sin escribir una línea de código de backend.
- **Supabase Client** (JavaScript SDK) permite consultas tipo ORM directamente desde Server Components de Next.js.
- Cambios en la base de datos se reflejan **inmediatamente** en la API — no hay que actualizar controllers, routes, ni services.

#### ✅ Seguridad de Nivel Empresarial
- **Row-Level Security (RLS)** ejecutado a nivel de PostgreSQL, no en la aplicación. Esto significa que es **imposible** acceder a datos de otro tenant incluso si hay un bug en el frontend.
- Las políticas RLS se ejecutan **antes** de que los datos salgan de la base de datos.
- **JWT verification** automático en cada request.

#### ✅ Costos Predecibles
- Modelo pay-as-you-go con bases claras.
- **Sin servidores que mantener** = sin costos ocultos de DevOps.
- Un solo servicio cubre Auth + DB + API + Storage + WebSockets + Functions.

#### ✅ Realtime Nativo
- WebSockets integrados directamente en PostgreSQL.
- Cada INSERT, UPDATE, DELETE puede generar eventos en tiempo real.
- **Filtrado por tenant** en los canales — aislamiento garantizado.

#### ✅ Ecosistema Integrado
- Auth, Storage, Functions, DB, Realtime — todo en un solo dashboard.
- **Branching** para desarrollo de bases de datos como código.
- **PITR** para recuperación de desastres.
- MCP Server para integración con herramientas de AI/development.

---

## 2. PostgreSQL + OrioleDB

### 2.1 ¿Por Qué PostgreSQL?

PostgreSQL es la base de datos relacional más avanzada del mundo open-source. Supabase ejecuta PostgreSQL 17.6 con el motor de almacenamiento **OrioleDB**.

**Ventajas de PostgreSQL para GRIXI:**

| Característica | Beneficio para GRIXI |
|---|---|
| **JSONB** | Almacenar configuraciones flexibles por tenant sin migraciones |
| **Arrays** | Listas de módulos habilitados (`TEXT[]`) sin tablas intermedias |
| **Full-Text Search** | Búsqueda en documentos, productos, empleados sin Elasticsearch |
| **Generated Columns** | Cálculos automáticos (totales, porcentajes) |
| **Materialized Views** | Dashboards pre-calculados para rendimiento |
| **Triggers** | Automatizaciones en INSERT/UPDATE (audit logs, notificaciones) |
| **Functions (PL/pgSQL)** | Lógica de negocio ejecutada en el servidor de BD |
| **Extensions** | pg_cron (cron jobs), pgvector (AI embeddings), pg_trgm (fuzzy search) |
| **Row-Level Security** | Aislamiento multi-tenant nativo |
| **CTEs y Window Functions** | Reportes financieros complejos sin código extra |

### 2.2 OrioleDB — Motor de Almacenamiento Moderno

OrioleDB es un motor de almacenamiento para PostgreSQL que mejora significativamente el rendimiento:

- **Undo log en vez de MVCC tradicional** — menos bloat, menos VACUUM necesario
- **Índices en memoria optimizados** — búsquedas más rápidas
- **Compresión nativa** — menos uso de disco
- **Mejor rendimiento en workloads OLTP** — perfecto para SaaS con muchas escrituras concurrentes

### 2.3 Extensiones Relevantes para GRIXI

```sql
-- Extensiones que habilitaremos en producción
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Fuzzy search (búsqueda aproximada)
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- Encriptación de datos sensibles
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- Análisis de rendimiento de queries
CREATE EXTENSION IF NOT EXISTS pgvector;       -- Embeddings para AI (GRIXI AI)
CREATE EXTENSION IF NOT EXISTS pg_cron;        -- Cron jobs dentro de PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgjwt;          -- Verificación/creación de JWT
```

---

## 3. Supabase Auth

### 3.1 Arquitectura de Auth para GRIXI

```
┌─────────────────────────────────────────────────────┐
│                 FLUJO DE AUTENTICACIÓN                │
│                                                      │
│  1. Usuario abre empresa1.grixi.app                  │
│  2. Middleware detecta slug "empresa1"               │
│  3. Pantalla de login con branding de empresa1       │
│  4. Google OAuth / Email + contraseña                │
│  5. Supabase Auth genera JWT                         │
│  6. Auth Hook inyecta org_ids en JWT claims          │
│  7. JWT viaja en cada request (cookie/header)        │
│  8. RLS verifica org_ids vs organization_members     │
│  9. Datos filtrados por tenant automáticamente       │
└─────────────────────────────────────────────────────┘
```

### 3.2 Providers Soportados

| Provider | Estado | Uso en GRIXI |
|---|---|---|
| **Google OAuth** | ✅ Activo | Login principal para empresas con Google Workspace |
| **Email + Password** | ✅ Activo | Fallback universal |
| **Magic Links** | ✅ Activo | Login sin contraseña (invitaciones) |
| **Microsoft Entra ID** | 🔄 Futuro | Empresas con Microsoft 365 |
| **SAML/SSO** | 🔄 Futuro (Team plan) | Empresas enterprise con IdP propio |
| **Phone (SMS)** | 🔄 Opcional | Si se requiere 2FA vía SMS |

### 3.3 Ventajas del Auth de Supabase

#### ✅ Integración Completa con RLS
- El `auth.uid()` está disponible directamente en las políticas RLS de PostgreSQL.
- No hay que pasar tokens manualmente a cada query — la sesión se resuelve automáticamente.

#### ✅ Auth Hooks
- Permiten ejecutar lógica personalizada durante el flujo de auth.
- GRIXI usa un **Custom Access Token Hook** para inyectar `org_ids` y `platform_role` en el JWT.
- Esto reduce la cantidad de queries necesarias por request (la info del tenant viaja en el token).

#### ✅ Multi-Factor Authentication (MFA)
- Supabase soporta TOTP (Google Authenticator, Authy) de forma nativa.
- Se puede activar por organización o globalmente.
- **Recomendado** para el panel de SuperAdmin.

#### ✅ Email Templates Personalizables
- Emails de confirmación, reset de contraseña, invitación — todos customizables.
- Pueden usar el branding de cada tenant (logo, colores) via Edge Functions.

#### ✅ Rate Limiting de Auth
- Protección automática contra brute force en endpoints de login.
- Configurable por plan.

### 3.4 Sesión y Tokens

```
┌──────────────────────────────────────────────┐
│              JWT de GRIXI                     │
│                                              │
│  {                                           │
│    "sub": "uuid-del-usuario",                │
│    "email": "usuario@empresa.com",           │
│    "role": "authenticated",                  │
│    "org_ids": ["uuid-org-1", "uuid-org-2"],  │
│    "platform_role": "super_admin" | null,    │
│    "iat": 1710408000,                        │
│    "exp": 1710494400                         │
│  }                                           │
└──────────────────────────────────────────────┘
```

- **Access Token**: Corto plazo (1 hora por defecto), viaja en cada request.
- **Refresh Token**: Largo plazo (1 semana), se usa para renovar el access token.
- **Almacenamiento**: En cookies HTTP-only (más seguro que localStorage).

---

## 4. Supabase Realtime

### 4.1 ¿Por Qué es Crítico para GRIXI?

Realtime es **esencial en todos los módulos** de GRIXI porque la plataforma necesita reflejar cambios de forma inmediata:

| Módulo | Eventos Realtime | Importancia |
|---|---|---|
| **Almacenes** | Movimiento de inventario, cambios de ubicación, alertas de stock | ⚡ Crítica |
| **Compras** | Nuevas requisiciones, aprobaciones, cambios de estado de PO | ⚡ Crítica |
| **Finanzas** | Pagos procesados, alertas de vencimiento, actualizaciones de CxC/CxP | ⚡ Crítica |
| **RRHH** | Asistencia en vivo, solicitudes de permiso, notificaciones | ⚡ Crítica |
| **GRIXI AI** | Respuestas de chat en streaming, resultados de análisis | ⚡ Crítica |
| **Notificaciones** | Alertas del sistema, mensajes entre usuarios | ⚡ Crítica |
| **Auditoría** | Eventos de security en vivo, usuarios conectados | ⚡ Crítica |

### 4.2 Tipos de Realtime Disponibles

#### Postgres Changes (CDC)
Captura cambios en tablas PostgreSQL vía la Replication Log:

```typescript
// Escuchar cambios en inventario de MI organización
const channel = supabase
  .channel('inventory-changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'inventory_movements',
    filter: `organization_id=eq.${orgId}`
  }, (payload) => {
    // RLS también filtra — doble protección
    toast.info(`Nuevo movimiento: ${payload.new.product_name}`)
    invalidateCache('inventory')
  })
  .subscribe()
```

#### Broadcast
Mensajes efímeros entre clientes (no se persisten):

```typescript
// Presencia del cursor del usuario (ej. editor colaborativo)
const channel = supabase
  .channel(`org:${orgId}:presence`)
  .on('broadcast', { event: 'cursor' }, (payload) => {
    updateRemoteCursor(payload.user_id, payload.position)
  })
  .subscribe()
```

#### Presence
Tracking de usuarios online:

```typescript
// ¿Quién está conectado en esta organización?
const channel = supabase
  .channel(`org:${orgId}:online`)
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    updateOnlineUsers(state)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        user_name: userName,
        online_at: new Date().toISOString()
      })
    }
  })
```

### 4.3 Ventajas del Realtime de Supabase

| Ventaja | Detalle |
|---|---|
| **Sin servidor WebSocket propio** | Supabase maneja toda la infraestructura de WebSockets (servidores, reconexiones, heartbeats) |
| **RLS aplicado** | Los cambios de PostgreSQL están filtrados por RLS — un tenant NUNCA recibe datos de otro |
| **Escalable** | Hasta 10,000 conexiones concurrentes en Pro, más en Team |
| **Reconexión automática** | El SDK maneja pérdidas de conexión y resubscribe automáticamente |
| **Baja latencia** | Los cambios se propagan en milisegundos gracias a la Replication Log de PostgreSQL |
| **Canales con nombre** | Permite organizar por módulo/tenant: `org:abc:warehouses` |

---

## 5. Supabase Storage

### 5.1 Uso en GRIXI

| Tipo de Archivo | Bucket | Acceso | Ejemplo |
|---|---|---|---|
| **Logos de empresa** | `branding` | Público (CDN) | `empresa1-logo.png` |
| **Documentos internos** | `documents` | Privado (RLS) | Contratos, facturas, reportes |
| **Fotos de empleados** | `avatars` | Privado (RLS) | Fotos de perfil |
| **Attachments de chat** | `chat-files` | Privado (RLS) | Archivos compartidos en el chat AI |
| **Imágenes de productos** | `products` | Privado (RLS) | Fotos de inventario |
| **Exports generados** | `exports` | Privado (RLS + TTL) | PDFs, Excel exportados |

### 5.2 Ventajas

- **CDN integrado** — archivos públicos servidos desde edge global, sin Cloudfront/S3
- **Políticas RLS** — los archivos están protegidos con las mismas reglas que las tablas
- **Transformaciones de imagen** — resize, crop, format conversion al vuelo (plan Pro+)
- **100 GB incluidos** en Pro — suficiente para las primeras 10 empresas
- **Organización por tenant** — path: `/{org_id}/documents/archivo.pdf`

### 5.3 Políticas de Storage

```sql
-- Solo miembros de la org pueden acceder a sus archivos
CREATE POLICY "tenant_files" ON storage.objects FOR ALL USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations 
    WHERE id IN (SELECT get_user_org_ids())
  )
);

-- Logos de branding son públicos
CREATE POLICY "public_branding" ON storage.objects FOR SELECT USING (
  bucket_id = 'branding'
);
```

---

## 6. Branching 2.0

### 6.1 ¿Qué es Database Branching?

Database Branching permite crear **copias aisladas** de tu base de datos para desarrollo, staging y testing — similar a como Git crea ramas del código.

```
Producción (main)
  ├── develop (Persistent Branch — staging)
  │     ├── feature/new-module (Preview Branch — se auto-elimina)
  │     └── feature/schema-change (Preview Branch)
  └── hotfix/critical (Preview Branch — merge rápido)
```

### 6.2 Tipos de Branches

| Tipo | Duración | Uso | Auto-cleanup |
|---|---|---|---|
| **Main** | Permanente | Producción | — |
| **Persistent** | Permanente | Staging, QA | No |
| **Preview** | Efímero | Features, PRs | Sí (configurable) |

### 6.3 ¿Qué incluye cada Branch?

Cada branch es un **proyecto Supabase completo** independiente con:

- ✅ Su propia URL y credenciales
- ✅ Copia del schema de producción
- ✅ Todas las migraciones aplicadas
- ✅ Auth separado
- ✅ Edge Functions separadas
- ✅ Dashboard separado
- ❌ NO copia datos de producción (se pueden usar seeds)

### 6.4 Flujo de Trabajo con Branching

```
1. DEVELOPER crea una feature branch en Git
   → git checkout -b feature/new-warehouse-module

2. Supabase detecta la branch (o se crea manualmente)
   → Preview Branch "feature/new-warehouse-module"

3. DEVELOPER escribe migración SQL
   → supabase/migrations/20260314_add_warehouse_zones.sql

4. La migración se aplica automáticamente a la Preview Branch

5. DEVELOPER testea contra la Preview Branch (URL separada)

6. Cuando está listo → PR a develop

7. La migración se merge a la Persistent Branch (staging)
   → Testing en staging con datos seed

8. Cuando staging está validado → PR a main

9. La migración se aplica a producción

10. La Preview Branch se auto-elimina
```

### 6.5 Ventajas

| Ventaja | Detalle |
|---|---|
| **Sin riesgo de corromper producción** | Cada cambio de schema se testea en una rama aislada |
| **Desarrollo en paralelo** | Múltiples features con cambios de schema diferentes sin conflictos |
| **Flujo Git familiar** | Branch → test → PR → merge → deploy |
| **Staging persistente** | El branch `develop` siempre existe como entorno de staging |
| **Sin Git requerido** | Se pueden crear branches desde el dashboard o CLI (Branching 2.0) |
| **Cost-effective** | Preview branches se auto-eliminan, no cuestan cuando no se usan |

---

## 7. PITR (Point-in-Time Recovery)

### 7.1 ¿Qué es?

PITR permite restaurar la base de datos a **cualquier segundo** dentro de la ventana de retención (7 días).

```
Hoy: Viernes 14 Marzo, 10:00 AM
  ↓
PITR puede restaurar a cualquier momento desde:
  Sábado 8 Marzo, 10:00 AM → hasta → ahora
  
Ejemplo: "Restaurar al jueves a las 3:47:22 PM"
```

### 7.2 ¿Cuándo lo necesitaríamos?

| Escenario | Sin PITR | Con PITR |
|---|---|---|
| DELETE accidental de datos | 😱 Se pierden datos hasta el último backup diario | ✅ Restaurar al segundo anterior |
| Migración defectuosa | 😱 Rollback manual o backup del día anterior | ✅ Restaurar al punto pre-migración |
| Corrupción de datos por bug | 😱 Horas de investigación y recreación | ✅ Restaurar al momento exacto del error |
| Ataque de seguridad | 😱 Backup diario puede estar ya comprometido | ✅ Restaurar al segundo antes del ataque |
| Error de un usuario | 😱 Se perdió la información | ✅ Restaurar selectivamente |

### 7.3 Diferencia vs Backups Diarios

| Característica | Backups Diarios (incluido) | PITR (add-on) |
|---|---|---|
| **Granularidad** | 1 backup/día | Cada ~2 minutos |
| **RPO** | Hasta 24 horas de pérdida | Máximo 2 minutos de pérdida |
| **Restauración** | A la foto del día | A cualquier segundo |
| **Retención** | 7 días | 7 días (configurable) |
| **Para multi-tenant** | Riesgo alto (24h de datos de TODAS las empresas) | Riesgo mínimo |

### 7.4 ¿Por qué es ESENCIAL para GRIXI?

> [!CAUTION]
> En un sistema multi-tenant, un error que afecte datos afecta a **TODAS las empresas simultáneamente**. PITR es la diferencia entre "perdimos los últimos 2 minutos" y "perdimos 24 horas de datos de 20 empresas".

- GRIXI maneja datos **financieros** (Finanzas, Compras) → regulatorios
- GRIXI maneja datos **de personas** (RRHH) → sensibles
- GRIXI es **multi-tenant** → un error afecta a todos
- El costo de PITR ($100/mes) es **insignificante** comparado con el costo de perder datos empresariales

---

## 8. PostgREST — API Automática

### 8.1 ¿Qué es PostgREST?

PostgREST es el componente de Supabase que **genera automáticamente una API REST** desde tu schema de PostgreSQL.

```
CREATE TABLE warehouses (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT
);

→ Automáticamente genera:

GET    /rest/v1/warehouses         → SELECT * FROM warehouses
GET    /rest/v1/warehouses?id=eq.X → SELECT * FROM warehouses WHERE id = 'X'
POST   /rest/v1/warehouses         → INSERT INTO warehouses ...
PATCH  /rest/v1/warehouses?id=eq.X → UPDATE warehouses SET ... WHERE id = 'X'
DELETE /rest/v1/warehouses?id=eq.X → DELETE FROM warehouses WHERE id = 'X'
```

### 8.2 Ventajas

| Ventaja | Detalle |
|---|---|
| **Cero código de API** | No necesitas controllers, routes, ni services |
| **Filtros avanzados** | `?status=eq.active&created_at=gt.2026-01-01` |
| **Selects anidados** | `?select=*,organization_members(*)` — JOINs automáticos |
| **Paginación** | Headers `Range` nativos |
| **RLS integrado** | Cada request pasa por RLS — el caller solo ve sus datos |
| **Tipado automático** | `supabase gen types` genera tipos TypeScript desde el schema |
| **Performance** | PostgREST está optimizado para PostgreSQL nativo — queries eficientes |

### 8.3 Cuándo NO usar PostgREST

- **Queries complejas** con múltiples JOINs y subqueries → usar **SQL Functions (RPCs)**
- **Lógica de negocio** que requiere validaciones multi-paso → usar **Server Actions** o **Edge Functions**
- **Operaciones batch** masivas → usar **SQL Functions** directamente

---

## 9. Plan Evolutivo: Pro → Team

### 9.1 Fase 1: Pro ($25/mes + add-ons)

**Cuándo:** Lanzamiento hasta primeros clientes pagos.

| Incluido | Valor |
|---|---|
| MAUs | 100,000 |
| Database Size | 8 GB |
| Egress | 250 GB |
| Storage | 100 GB |
| Edge Function invocations | 2M/mes |
| Functions por proyecto | 500 |
| Backups | Diarios, 7 días |
| Log retention | 7 días |
| Soporte | Email |
| Compute credits | $10/mes |

**Add-ons necesarios desde día 1:**
- PITR 7 días: $100/mes
- Compute Small: $15/mes (requerido para PITR)

**Costo total Fase 1: ~$140/mes**

### 9.2 Fase 2: Team ($599/mes + add-ons)

**Cuándo:** Al incorporar el primer cliente externo pago.

**Qué agrega Team vs Pro:**

| Característica | Por qué importa |
|---|---|
| **SOC 2** | Cumplimiento de seguridad exigido por empresas |
| **SSO para Dashboard** | Los administradores de GRIXI acceden con SSO corporativo |
| **Audit Logs Avanzados** | Registro completo de quién hizo qué en el dashboard de Supabase |
| **Soporte Prioritario** | Respuestas más rápidas ante incidentes de producción |
| **Centralized Billing** | Una sola factura para toda la infraestructura Supabase |
| **Más MAUs incluidos** | Escalar sin preocupación de overage |
| **Más funciones edge** | Hasta 1,000 Edge Functions por proyecto |

**Add-ons en Team:**
- PITR 7 días: $100/mes
- Compute Medium/Large: $60-110/mes

**Costo total Fase 2: ~$759-$809/mes**

---

## 10. Configuración Óptima para GRIXI

### 10.1 Checklist de Configuración Inicial

```
SUPABASE DASHBOARD:
├── Project Settings
│   ├── [x] Region: us-east-1 (o el más cercano a los clientes)
│   ├── [x] Custom Domain: api.grixi.app
│   └── [x] Compute: Small (mínimo para PITR)
│
├── Auth Settings  
│   ├── [x] Google OAuth configurado
│   ├── [x] Email Auth habilitado
│   ├── [x] Email templates personalizados (GRIXI branding)
│   ├── [x] JWT expiry: 3600 (1 hora)
│   ├── [x] Refresh token rotation: habilitado
│   ├── [x] Custom Access Token Hook: activado
│   └── [x] Rate limiting por defecto
│
├── Database
│   ├── [x] Connection pooling: habilitado (pgBouncer)
│   ├── [x] PITR: activado (7 días)
│   ├── [x] Branching 2.0: activado
│   ├── [x] Extensions: pg_trgm, pgcrypto, pgvector, pg_cron
│   └── [x] SSL enforce: obligatorio
│
├── Storage
│   ├── [x] Buckets: branding (público), documents (privado), avatars (privado)
│   ├── [x] Image transformations: habilitado
│   └── [x] File size limit: 50MB
│
├── Edge Functions
│   ├── [x] Secrets configurados (GEMINI_API_KEY, RESEND_API_KEY, etc.)
│   └── [x] JWT verification: habilitado por defecto
│
└── Realtime
    ├── [x] Postgres CDC habilitado
    └── [x] Broadcast y Presence habilitados
```

### 10.2 Variables de Entorno Requeridas

```env
# Supabase Core
NEXT_PUBLIC_SUPABASE_URL=https://api.grixi.app
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Solo server-side, NUNCA en el client

# Supabase Edge Functions (Secrets)
GEMINI_API_KEY=...
RESEND_API_KEY=...
SAP_SOAP_ENDPOINT=...
SAP_SOAP_USER=...
SAP_SOAP_PASSWORD=...
```

---

## 11. Monitoreo y Observabilidad

### 11.1 Herramientas Incluidas

| Herramienta | Qué monitorea | Acceso |
|---|---|---|
| **Dashboard de Supabase** | Queries, connections, storage, auth events | Dashboard web |
| **Logs** | API requests, auth events, edge function logs, postgres logs | 7 días retención |
| **pg_stat_statements** | Top queries por tiempo de ejecución | SQL directo |
| **Supabase Advisors** | Security vulnerabilities, performance improvements | Dashboard + MCP |
| **Realtime Inspector** | Canales activos, conexiones, mensajes | Dashboard |
| **Storage Analytics** | Uso de storage por bucket | Dashboard |

### 11.2 Queries de Monitoreo Recomendadas

```sql
-- Top 10 queries más lentas
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Conexiones activas por origen
SELECT usename, client_addr, state, count(*)
FROM pg_stat_activity
GROUP BY usename, client_addr, state;

-- Tamaño de tablas
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Uso de índices (detectar índices no usados)
SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```
