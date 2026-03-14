# GRIXI — Arquitectura de Producción

> Documento definitivo de infraestructura de producción para GRIXI como plataforma SaaS enterprise multi-tenant.
> Última actualización: 14 de marzo, 2026.

---

## 1. Visión General

GRIXI es un monolito moderno **sin backend separado** que centraliza toda su lógica en:

- **Next.js 16 (App Router)** — Server Components, Server Actions, RSC
- **Supabase** — PostgreSQL (OrioleDB) + Auth + Edge Functions + Realtime + Storage
- **Vercel** — Hosting, builds, preview deployments
- **Cloudflare** — CDN, WAF, DDoS protection
- **GitHub Teams** — Repositorio, CI/CD, code review

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USUARIOS FINALES                            │
│           empresa1.grixi.app  │  empresa2.grixi.app                │
└─────────────────────┬─────────┴──────────┬──────────────────────────┘
                      ↓                    ↓
            ┌──────────────────────────────────────┐
            │        CLOUDFLARE (Pro → Business)    │
            │  • WAF (reglas custom)                │
            │  • DDoS Unmetered                     │
            │  • CDN Global                         │
            │  • SSL/TLS                            │
            │  • Bot Protection                     │
            └─────────────────┬────────────────────┘
                              ↓
         ┌────────────────────┼────────────────────┐
         ↓                    ↓                    ↓
┌──────────────┐   ┌───────────────┐   ┌───────────────────┐
│   VERCEL     │   │  SUPABASE     │   │  SUPABASE          │
│   Pro        │   │  Auth         │   │  Edge Functions    │
│              │   │               │   │                    │
│  Next.js 16  │   │ Google OAuth  │   │ • AI (Gemini)      │
│  App Router  │   │ Email/Pass    │   │ • Webhooks         │
│  RSC + SSR   │   │ Magic Links   │   │ • API Connections  │
│  Server      │   │ Multi-tenant  │   │ • Emails (Resend)  │
│  Actions     │   │ JWT + RLS     │   │ • Cron Jobs        │
│              │   │               │   │ • SAP Integration  │
│  Turbo Build │   │               │   │ • External APIs    │
└──────┬───────┘   └───────┬───────┘   └────────┬──────────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           ↓
              ┌────────────────────────┐
              │   SUPABASE PostgreSQL  │
              │   (OrioleDB)           │
              │                       │
              │ • RLS Multi-Tenant    │
              │ • Branching 2.0       │
              │ • PITR (7 días)       │
              │ • Realtime (all)      │
              │ • Storage (files)     │
              │ • PostgREST API       │
              │ • SQL Functions/RPCs  │
              └────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │   GITHUB Teams         │
              │                       │
              │ • Monorepo Turborepo  │
              │ • Protected Branches  │
              │ • Code Owners         │
              │ • GitHub Actions CI   │
              │ • PR Reviews          │
              │ • Environment Secrets │
              └────────────────────────┘
```

---

## 2. Stack de Servicios y Planes

### 2.1 Supabase — Centro del Backend

#### Plan Evolutivo: Pro → Team

| Fase | Plan | Cuándo | Costo Base |
|---|---|---|---|
| **Fase 1 (Lanzamiento)** | **Pro** ($25/mes) | 1-5 empresas, ~50 usuarios | $25/mes |
| **Fase 2 (Primeros clientes)** | **Team** ($599/mes) | Cuando entren los primeros clientes pagos | $599/mes |

> [!IMPORTANT]
> **Criterio de migración Pro → Team:** Cuando se incorpore el primer cliente externo pago, se migra a Team para obtener SOC 2, audit logs avanzados, SSO dashboard, y soporte prioritario. Esto es fundamental para la confianza empresarial.

#### Compute: Roadmap de Escalado

| Fase | Usuarios | Compute | RAM | CPU | Conexiones | Costo |
|---|---|---|---|---|---|---|
| **Mes 1-3** | ~50 | Small | 2 GB | 2-core shared | ~60 direct / 200 pooler | $15/mes* |
| **Mes 3-6** | ~100-200 | Medium | 4 GB | 2-core shared | ~90 direct / 400 pooler | $60/mes* |
| **Mes 6-12** | 200+ | Large | 8 GB | 2-core dedicated | ~120 direct / 600 pooler | $110/mes* |
| **Año 2+** | 500+ | XL | 16 GB | 4-core dedicated | ~200 direct / 800 pooler | $210/mes* |

*\*Precios después de aplicar $10 de crédito de compute incluido en el plan.*

#### Add-ons Requeridos

| Add-on | Costo | Desde cuándo | Justificación |
|---|---|---|---|
| **PITR 7 días** | ~$100/mes | **Día 1** | RPO de 2 minutos. Esencial para datos empresariales multi-tenant |
| **Compute Small** | $15/mes | Día 1 | Requerido para PITR + mejora sobre Micro |
| **Custom Domain** | Incluido en Pro | Cuando se configure | Para `api.grixi.app` |

#### Servicios Supabase Utilizados

| Servicio | Uso en GRIXI | Crítico |
|---|---|---|
| **PostgreSQL (OrioleDB)** | Base de datos principal, RLS multi-tenant | ✅ |
| **Auth** | Google OAuth, Email/Pass, Magic Links, JWT con custom claims para tenant | ✅ |
| **Realtime** | Notificaciones, chat, actualizaciones en vivo de todos los módulos | ✅ |
| **Edge Functions** | AI (Gemini), conexiones API externas, SAP, webhooks, emails, crons | ✅ |
| **Storage** | Archivos de tenants (logos, documentos, imágenes) | ✅ |
| **PostgREST** | API REST automática con RLS | ✅ |
| **Branching 2.0** | Desarrollo y staging de cambios de schema | ✅ |
| **PITR** | Recuperación de desastres con RPO 2 minutos | ✅ |

#### Edge Functions — Casos de Uso

| Función | Descripción | Frecuencia Estimada |
|---|---|---|
| `ai-chat` | Proxy a Gemini para GRIXI AI | Alta (~10K/mes) |
| `ai-voice` | Procesamiento de comandos de voz | Media (~5K/mes) |
| `send-email` | Envío de correos vía Resend/SMTP | Media |
| `sap-sync` | Sincronización con SAP ECC vía SOAP/HTTP | Media |
| `webhook-handler` | Receptor de webhooks de terceros | Variable |
| `cron-daily-reports` | Reportes diarios programados | ~30/mes |
| `external-api-proxy` | Conexiones a APIs externas (sensibles, con secrets) | Alta |
| `tenant-onboarding` | Provisioning automático de nuevo tenant | Baja |

> [!WARNING]
> **Limitación Edge Functions:** Max 2s CPU time, 400s wall clock, 256MB RAM. Para procesamiento pesado (reportes masivos, ETL), considerar Vercel Cron Functions o GitHub Actions como complemento.

---

### 2.2 Vercel Pro — Frontend Hosting

#### Plan: Pro ($20/deployer/mes)

| Recurso | Incluido | Suficiente? |
|---|---|---|
| **Deployers** | 1 ($20/mes) | ✅ Solo 1 aprueba deploys |
| **Viewers** | Ilimitados GRATIS | ✅ Resto del equipo |
| **Bandwidth** | 1 TB/mes | ✅ Para 1-20 empresas |
| **Edge Requests** | 10M/mes | ✅ |
| **Builds concurrentes** | 12 | ✅ |
| **Deployments/día** | 6,000 | ✅ |
| **Build Machines** | Turbo (30 vCPU, 60GB) | ✅ |
| **Serverless Invocations** | 1M/mes | ✅ |
| **Crédito incluido** | $20/mes | ✅ |

#### Configuración de Dominio

| Tipo | Dominio | Uso |
|---|---|---|
| **App principal** | `app.grixi.com` | Dashboard SuperAdmin |
| **Tenant wildcard** | `*.grixi.app` | Cada empresa: `empresa1.grixi.app` |
| **API Supabase** | `api.grixi.app` | Custom domain de Supabase |

#### Add-ons (No necesarios al inicio, evaluar en Fase 2)

| Add-on | Costo | Cuándo activar |
|---|---|---|
| Web Analytics Plus | $10/mes | Cuando hayan clientes en producción |
| Speed Insights | $10/mes/proyecto | Cuando se optimice CWV |
| Observability Plus | $10/mes | Si se necesitan métricas avanzadas |

---

### 2.3 Cloudflare — Seguridad y CDN

#### Plan Evolutivo: Pro → Business

| Fase | Plan | Cuándo | Costo |
|---|---|---|---|
| **Fase 1** | **Pro** ($20/mes) | Lanzamiento | $20/mes |
| **Fase 2** | **Business** ($200/mes) | Primeros clientes / SLA requerido | $200/mes |

#### Qué aporta Cloudflare en cada fase

| Característica | Pro ($20/mes) | Business ($200/mes) |
|---|---|---|
| **WAF Rules** | 20 custom | 100 custom |
| **DDoS** | ✅ Unmetered | ✅ Unmetered |
| **CDN** | ✅ Global | ✅ Global |
| **SSL** | Compartido | ✅ Custom Upload |
| **Bot Management** | Básico | ✅ Avanzado |
| **Uptime SLA** | ❌ | ✅ 100% |
| **PCI Compliance** | Parcial | ✅ Completo |
| **ML Protection** | ❌ | ✅ |
| **Soporte** | Email | 24/7/365 |

#### Configuración DNS y Proxy

```
grixi.com          → Cloudflare (landing page)
app.grixi.com      → Cloudflare → Vercel (dashboard admin)  
*.grixi.app        → Cloudflare → Vercel (tenant apps)
api.grixi.app      → Cloudflare → Supabase (API)
```

> [!NOTE]
> Cloudflare actúa como proxy inverso frente a Vercel, cachea assets estáticos y reduce egress. Las WAF rules protegen contra SQL injection, XSS, y bots maliciosos.

---

### 2.4 GitHub Teams — Repositorio y CI/CD

#### Plan: Team ($4/usuario/mes)

| Recurso | Incluido | Uso |
|---|---|---|
| **Repos privados** | ✅ Ilimitados | Monorepo Turborepo |
| **GitHub Actions** | 3,000 min/mes | CI/CD, tests, linting |
| **Protected Branches** | ✅ | `main` protegida |
| **Required Reviewers** | ✅ | PR reviews obligatorios |
| **Code Owners** | ✅ | Dueños de módulos |
| **Draft PRs** | ✅ | WIP features |
| **Environment Secrets** | ✅ | Claves de prod/staging |
| **Packages Storage** | 2 GB | npm packages privados |

#### Branching Strategy

```
main (producción) ← PR required, 1 reviewer
  ├── develop (staging)
  │     ├── feature/almacenes-3d
  │     ├── feature/compras-dashboard  
  │     └── feature/rrhh-calendar
  └── hotfix/critical-fix
```

#### CI/CD Pipeline con GitHub Actions

```yaml
# .github/workflows/ci.yml
on:
  push: [main, develop]
  pull_request: [main]

jobs:
  lint-test:     # ESLint + TypeScript check
  build:         # Next.js build verification
  deploy-preview: # Vercel preview (PRs)
  deploy-prod:   # Vercel production (main)
```

#### Integración con Supabase Branching

| Git Branch | Supabase Branch | Tipo |
|---|---|---|
| `main` | Production (main) | Producción |
| `develop` | `develop` | Persistent Branch (staging) |
| `feature/*` | Preview Branch | Efímero (auto-cleanup) |

---

## 3. Arquitectura Multi-Tenant

### 3.1 Estrategia: Shared DB + RLS con `organization_id`

```
┌───────────────────────────────────────────────────┐
│              Supabase PostgreSQL                   │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │           Schema: public                     │  │
│  │                                             │  │
│  │  organizations ← source of truth            │  │
│  │  organization_members ← user ↔ org          │  │
│  │  organization_configs ← por tenant          │  │
│  │                                             │  │
│  │  warehouses ┐                               │  │
│  │  products   │ organization_id FK + RLS      │  │
│  │  purchases  │ en TODAS las tablas           │  │
│  │  invoices   │ de negocio                    │  │
│  │  employees  ┘                               │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  RLS Policy = auth.uid() ∈ org_members → filter   │
└───────────────────────────────────────────────────┘
```

### 3.2 Sistema de Configuración en 3 Niveles

```
┌─────────────────────────────────────────┐
│  Nivel 1: CONFIGURACIÓN GLOBAL          │
│  (platform_config)                      │
│                                         │
│  • Módulos disponibles                  │
│  • Límites globales de la plataforma    │
│  • Feature flags globales               │
│  • Versión mínima requerida             │
│  • Configuraciones inmutables           │
│                                         │
│  ⚠️ NO se puede sobreescribir           │
│     por tenants                         │
└─────────────────┬───────────────────────┘
                  ↓ hereda
┌─────────────────────────────────────────┐
│  Nivel 2: CONFIGURACIÓN EMPRESA         │
│  (organization_config)                  │
│                                         │
│  • Módulos habilitados para la empresa  │
│  • Plan/suscripción                     │
│  • Branding (logo, colores, nombre)     │
│  • Dominio personalizado                │
│  • Límites contratados                  │
│  • Integraciones activas (SAP, etc.)    │
│                                         │
│  ✅ Sobreescribe defaults de Nivel 1     │
│     (solo los campos permitidos)        │
└─────────────────┬───────────────────────┘
                  ↓ hereda
┌─────────────────────────────────────────┐
│  Nivel 3: CONFIGURACIÓN TENANT-USER     │
│  (user_preferences)                     │
│                                         │
│  • Preferencias UI (tema, idioma)       │
│  • Layout de dashboards                 │
│  • Notificaciones                       │
│  • Shortcuts personalizados             │
│                                         │
│  ✅ Sobreescribe Nivel 2 donde           │
│     está permitido                      │
└─────────────────────────────────────────┘
```

### 3.3 Modelo de Datos Core

```sql
-- ═══════════════════════════════════════════════════
-- NIVEL 1: PLATAFORMA
-- ═══════════════════════════════════════════════════

-- Configuración global de la plataforma (solo SuperAdmin)
CREATE TABLE platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  is_overridable BOOLEAN DEFAULT false,  -- ¿puede un tenant sobreescribirlo?
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ═══════════════════════════════════════════════════
-- NIVEL 2: ORGANIZACIONES (TENANTS)
-- ═══════════════════════════════════════════════════

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,               -- URL: empresa1.grixi.app  
  custom_domain TEXT UNIQUE,               -- dominio.com (opcional)
  plan TEXT NOT NULL DEFAULT 'starter',     -- 'starter' | 'professional' | 'enterprise'
  
  -- Branding personalizado
  branding JSONB DEFAULT '{
    "logo_url": null,
    "primary_color": "#7C3AED",
    "secondary_color": "#4F46E5",
    "company_name": null
  }',
  
  -- Módulos habilitados
  enabled_modules TEXT[] DEFAULT ARRAY['dashboard'],
  
  -- Configuraciones que sobreescriben la global
  config_overrides JSONB DEFAULT '{}',
  
  -- Integraciones
  integrations JSONB DEFAULT '{
    "sap": { "enabled": false },
    "google_workspace": { "enabled": false }
  }',
  
  is_active BOOLEAN DEFAULT true,
  max_users INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Membresía de usuarios
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',     -- 'owner' | 'admin' | 'member' | 'viewer'
  permissions JSONB DEFAULT '{}',          -- permisos granulares
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(organization_id, user_id)
);

-- Configuración por tenant (sobreescribe platform_config donde is_overridable = true)
CREATE TABLE organization_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, key),
  -- Solo permite keys que sean overridable
  CONSTRAINT valid_override CHECK (
    EXISTS (
      SELECT 1 FROM platform_config pc 
      WHERE pc.key = organization_configs.key 
      AND pc.is_overridable = true
    )
  )
);

-- ═══════════════════════════════════════════════════
-- NIVEL 3: PREFERENCIAS DE USUARIO
-- ═══════════════════════════════════════════════════

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{
    "theme": "system",
    "language": "es",
    "sidebar_collapsed": false,
    "notifications_enabled": true
  }',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- ═══════════════════════════════════════════════════
-- SuperAdmin de la plataforma GRIXI
-- ═══════════════════════════════════════════════════

CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'super_admin',  -- 'super_admin' | 'support'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- ÍNDICES CRÍTICOS para rendimiento RLS
-- ═══════════════════════════════════════════════════

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_org ON organization_members(user_id, organization_id);
CREATE INDEX idx_org_configs_org ON organization_configs(organization_id);
CREATE INDEX idx_user_prefs_user_org ON user_preferences(user_id, organization_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(custom_domain) WHERE custom_domain IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- FUNCIÓN HELPER para RLS
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  AND is_active = true
$$;

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

-- ═══════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Organizations: usuarios ven sus orgs, SuperAdmin ve todo
CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "org_manage" ON organizations FOR ALL USING (is_platform_admin());

-- Members: usuarios ven miembros de sus orgs
CREATE POLICY "members_select" ON organization_members FOR SELECT USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);

-- Configs: usuarios ven config de su org
CREATE POLICY "configs_select" ON organization_configs FOR SELECT USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
CREATE POLICY "configs_manage" ON organization_configs FOR ALL USING (is_platform_admin());

-- Platform config: todos pueden leer, solo SuperAdmin escribe
CREATE POLICY "platform_config_read" ON platform_config FOR SELECT USING (true);
CREATE POLICY "platform_config_write" ON platform_config FOR ALL USING (is_platform_admin());

-- User preferences: solo el propio usuario
CREATE POLICY "prefs_own" ON user_preferences FOR ALL USING (user_id = auth.uid());

-- Platform admins: solo SuperAdmin
CREATE POLICY "admins_manage" ON platform_admins FOR ALL USING (is_platform_admin());
```

### 3.4 Patrón para Tablas de Negocio

Todas las tablas de negocio DEBEN seguir este patrón:

```sql
-- Ejemplo: tabla de almacenes
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- SIEMPRE: índice en organization_id como primer campo
CREATE INDEX idx_warehouses_org ON warehouses(organization_id);

-- SIEMPRE: RLS habilitado
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- SIEMPRE: política usando helper function
CREATE POLICY "tenant_isolation" ON warehouses FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
```

### 3.5 Resolución de Configuración (merge de 3 niveles)

```sql
-- Función para resolver config efectiva de un tenant
CREATE OR REPLACE FUNCTION get_effective_config(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB := '{}';
  platform_row RECORD;
  override_val JSONB;
BEGIN
  -- Nivel 1: Cargar todas las configs globales
  FOR platform_row IN SELECT key, value, is_overridable FROM platform_config LOOP
    result := result || jsonb_build_object(platform_row.key, platform_row.value);
    
    -- Nivel 2: Si es overridable, buscar override del tenant
    IF platform_row.is_overridable THEN
      SELECT oc.value INTO override_val
      FROM organization_configs oc
      WHERE oc.organization_id = p_org_id AND oc.key = platform_row.key;
      
      IF override_val IS NOT NULL THEN
        result := result || jsonb_build_object(platform_row.key, override_val);
      END IF;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;
```

---

## 4. Dominios y Routing Multi-Tenant

### 4.1 Estrategia de Dominios

| Dominio | Tipo | Uso |
|---|---|---|
| `grixi.com` | Landing | Página de marketing |
| `app.grixi.com` | App principal | Panel SuperAdmin + acceso general |
| `{slug}.grixi.app` | Wildcard | Acceso por tenant: `empresa1.grixi.app` |
| `custom-domain.com` | Custom | Dominio propio de la empresa (opcional) |
| `api.grixi.app` | API | Custom domain de Supabase |

### 4.2 Resolución de Tenant en Next.js

```typescript
// middleware.ts — Resolución de tenant por subdomain
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  
  // Extraer slug del subdomain
  // empresa1.grixi.app → slug = "empresa1"
  const slug = hostname.split('.')[0]
  
  // Verificar si es un tenant válido o un dominio del sistema
  const systemDomains = ['app', 'www', 'api']
  
  if (!systemDomains.includes(slug)) {
    // Inyectar slug como header para Server Components
    const response = NextResponse.next()
    response.headers.set('x-tenant-slug', slug)
    return response
  }
  
  return NextResponse.next()
}
```

### 4.3 Configuración en Vercel

```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Dominios a configurar en Vercel Pro:
- `app.grixi.com` — dominio principal
- `*.grixi.app` — wildcard para tenants
- Dominios custom de cada empresa (se agregan al crecer)

---

## 5. Auth Multi-Tenant con Supabase

### 5.1 Flujo de Autenticación

```
Usuario → Login (Google OAuth / Email)
  ↓
Supabase Auth → JWT con user_id
  ↓
Server Component → Consulta organization_members
  ↓
¿Usuario pertenece a 1 org?  → Redirige directo
¿Usuario pertenece a +1 org? → Selector de organización
¿No pertenece a ninguna?     → Pantalla de "Sin acceso"
  ↓
RLS filtra datos automáticamente por organization_id
```

### 5.2 Custom Claims (JWT)

```sql
-- Hook de auth para inyectar org_id en el JWT
-- Supabase Auth Hook: custom_access_token
CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  claims JSONB;
  user_org_ids UUID[];
  user_role TEXT;
BEGIN
  claims := event->'claims';
  
  -- Obtener organizaciones del usuario
  SELECT array_agg(organization_id), 
         (SELECT role FROM platform_admins WHERE user_id = (event->>'user_id')::uuid)
  INTO user_org_ids, user_role
  FROM organization_members 
  WHERE user_id = (event->>'user_id')::uuid AND is_active = true;
  
  -- Inyectar en el JWT
  claims := jsonb_set(claims, '{org_ids}', to_jsonb(user_org_ids));
  
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{platform_role}', to_jsonb(user_role));
  END IF;
  
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
```

---

## 6. Realtime Multi-Tenant

> [!IMPORTANT]
> Realtime es **crítico para todos los módulos**. Cada canal de Realtime DEBE filtrarse por `organization_id` para mantener el aislamiento.

### 6.1 Patrón de Suscripción

```typescript
// Hook: useRealtimeSubscription
// SIEMPRE filtrar por org_id en el canal
const channel = supabase
  .channel(`org:${orgId}:warehouses`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'warehouses',
    filter: `organization_id=eq.${orgId}`
  }, (payload) => {
    // RLS también aplica aquí — doble protección
    handleChange(payload)
  })
  .subscribe()
```

---

## 7. Costos y Roadmap Financiero

### 7.1 Fase 1: Lanzamiento (1-5 empresas, ~50 usuarios)

| Servicio | Plan | Detalle | Costo/mes |
|---|---|---|---|
| **Supabase** | Pro | Base | $25 |
| | | Compute Small | $15 |
| | | PITR 7 días | $100 |
| **Vercel** | Pro | 1 deployer | $20 |
| **Cloudflare** | Pro | 1 dominio | $20 |
| **GitHub** | Teams | ~3 usuarios ($4/u) | $12 |
| **Dominio** | grixi.com + grixi.app | | ~$3 |
| | | **TOTAL FASE 1** | **~$195/mes** |

### 7.2 Fase 2: Primeros Clientes (5-10 empresas, ~200 usuarios)

| Servicio | Plan | Detalle | Costo/mes |
|---|---|---|---|
| **Supabase** | **Team** | Base | $599 |
| | | Compute Medium | $60 |
| | | PITR 7 días | $100 |
| **Vercel** | Pro | 1 deployer + add-ons | $40 |
| **Cloudflare** | **Business** | WAF avanzado + SLA | $200 |
| **GitHub** | Teams | ~5 usuarios | $20 |
| | | **TOTAL FASE 2** | **~$1,019/mes** |

### 7.3 Fase 3: Escala (10-20 empresas, 500+ usuarios)

| Servicio | Plan | Detalle | Costo/mes |
|---|---|---|---|
| **Supabase** | Team | Base | $599 |
| | | Compute Large | $110 |
| | | PITR 7 días | $100 |
| | | Storage extra | ~$20 |
| **Vercel** | Pro | + observability | $50 |
| **Cloudflare** | Business | | $200 |
| **GitHub** | Teams | ~8 usuarios | $32 |
| | | **TOTAL FASE 3** | **~$1,111/mes** |

---

## 8. Seguridad — Capas de Protección

```
Capa 1: CLOUDFLARE
├── WAF (SQL injection, XSS, CSRF)
├── DDoS protection (unmetered)
├── Bot management
├── Rate limiting
└── SSL/TLS enforcement

Capa 2: VERCEL
├── Preview deployment isolation
├── Environment secrets (per-environment)
├── Edge middleware (auth check)
└── Headers de seguridad (CSP, HSTS)

Capa 3: SUPABASE AUTH
├── JWT verification en cada request
├── Custom claims con org_ids
├── Google OAuth / Email auth
├── Rate limiting de auth endpoints
└── Session management

Capa 4: SUPABASE RLS
├── TODA tabla con RLS habilitado
├── organization_id filter en cada query
├── Helper functions (SECURITY DEFINER)
├── Service role NUNCA en el cliente
└── Validación Zod (client + server)

Capa 5: POSTGRESQL
├── Conexiones vía pooler (pgBouncer)
├── Índices en todas las columnas de filtro
├── PITR para recuperación de desastres
└── Backups diarios (7 días)
```

---

## 9. Checklist de Implementación

### Fase 0: Setup Inicial
- [ ] Crear proyecto Supabase (Pro)
- [ ] Configurar PITR
- [ ] Activar Branching 2.0
- [ ] Configurar GitHub Teams organization
- [ ] Configurar Vercel Pro con monorepo
- [ ] Setup Cloudflare Pro con DNS
- [ ] Configurar dominios wildcard (`*.grixi.app`)

### Fase 1: Core Multi-Tenant
- [ ] Implementar tablas core (organizations, members, configs)
- [ ] Crear RLS policies y helper functions
- [ ] Implementar middleware de resolución de tenant
- [ ] Auth con custom claims JWT
- [ ] Onboarding flow (SuperAdmin crea empresa)
- [ ] Sistema de configuración 3 niveles

### Fase 2: Módulos de Negocio
- [ ] Migrar/crear módulo Almacenes (con `organization_id`)
- [ ] Migrar/crear módulo Compras
- [ ] Migrar/crear módulo Finanzas
- [ ] Migrar/crear módulo RRHH
- [ ] GRIXI AI con contexto multi-tenant

### Fase 3: Integraciones
- [ ] Edge Functions para SAP
- [ ] Edge Functions para APIs externas
- [ ] Realtime en todos los módulos
- [ ] Sistema de notificaciones multi-tenant

### Fase 4: Escalado (migración Pro → Team)
- [ ] Migrar Supabase a plan Team
- [ ] Migrar Cloudflare a Business
- [ ] Activar add-ons de Vercel
- [ ] Audit logs avanzados
- [ ] SOC 2 compliance

---

## 10. Convenciones de Nombre

| Entidad | Convención | Ejemplo |
|---|---|---|
| **Tablas** | `snake_case` plural con prefijo de módulo | `wh_warehouses`, `pr_purchase_orders` |
| **Columnas FK tenant** | `organization_id` (SIEMPRE) | `organization_id UUID NOT NULL` |
| **RLS policies** | `{tabla}_{acción}` | `warehouses_select`, `warehouses_manage` |
| **Índices** | `idx_{tabla}_{columnas}` | `idx_warehouses_org` |
| **SQL Functions** | `{módulo}_{verbo}_{sustantivo}` | `wh_get_occupancy()` |
| **Edge Functions** | `kebab-case` | `sap-sync`, `ai-chat` |
| **Supabase Branches** | Match git branch | `develop`, `feature/almacenes-3d` |
| **Environment vars** | `UPPER_SNAKE` | `SUPABASE_URL`, `GEMINI_API_KEY` |
