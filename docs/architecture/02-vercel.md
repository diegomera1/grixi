# GRIXI × Vercel Pro — Hosting y Deployment

> Documento detallado sobre cómo GRIXI utiliza Vercel Pro como plataforma de hosting y deployment para su aplicación Next.js 16.

---

## 1. ¿Por Qué Vercel?

### 1.1 La Sinergia Next.js + Vercel

Vercel es el **creador de Next.js**. Esto significa que GRIXI obtiene la mejor compatibilidad y rendimiento posible:

| Característica | Beneficio |
|---|---|
| **Optimización nativa** | Vercel optimiza automáticamente para Next.js (prefetch, streaming, ISR) |
| **Zero-config deployment** | Push a Git → deploy automático, sin Dockerfiles ni CI manual |
| **Edge Runtime** | Middleware de Next.js se ejecuta en el edge — latencia mínima globalmente |
| **Turbo Build Machines** | 30 vCPU, 60GB RAM para builds — monorepo de GRIXI compila rápido |
| **Preview Deployments** | Cada PR genera una URL de preview para testing |
| **Serverless Functions** | Server Components y Server Actions se ejecutan como serverless functions |

### 1.2 Alternativas Descartadas

| Alternativa | Por qué NO |
|---|---|
| **AWS Amplify** | Menos optimizado para Next.js, config más compleja |
| **Netlify** | Soporte de Next.js inferior, sin Turbo builds |
| **Self-hosted (Docker)** | Requiere DevOps dedicado, no justifica el costo |
| **Railway/Render** | No tiene edge network ni la profundidad de Vercel con Next.js |
| **Cloudflare Pages** | Next.js support experimental, no production-ready |

---

## 2. Plan Pro — Detalle Completo

### 2.1 Lo que incluye el Pro ($20/deployer/mes)

| Categoría | Recurso | Incluido | Overage |
|---|---|---|---|
| **Bandwidth** | Fast Data Transfer | 1 TB/mes | $0.15/GB |
| **Edge Requests** | Requests al Edge | 10M/mes | $2/100K |
| **Builds** | Concurrent Builds | 12 simultáneos | — |
| **Deployments** | Por día | 6,000/día | — |
| **Build Time** | Máximo por build | 45 min | — |
| **Functions** | Serverless Invocations | 1M/mes | $0.60/1M |
| **Compute** | Function GB-Hours | 1,000 GB-hrs | $0.18/GB-hr |
| **Crédito** | Mensual | $20 | — |
| **Seats** | Deployers pagos | $20/deployer | — |
| **Seats** | Viewers | **Gratis ilimitados** | — |

### 2.2 ¿Por Qué es Suficiente para GRIXI?

**1 TB de bandwidth** para un SaaS B2B con 5-20 empresas es **más que suficiente**:

```
Cálculo estimado:
  - Página promedio GRIXI: ~500KB (comprimida)
  - 200 usuarios activos × 50 pageviews/día = 10,000 pageviews/día
  - 10,000 × 500KB = 5GB/día = ~150GB/mes
  
  → 1 TB incluido cubre ~6x el uso estimado
```

**10M Edge Requests** también sobran:

```
Cálculo estimado:
  - 200 usuarios × 100 requests/día = 20,000 requests/día
  - 20,000 × 30 días = 600,000 requests/mes
  
  → 10M incluidos cubre ~16x el uso estimado
```

### 2.3 Modelo de Seats

| Tipo de Seat | Costo | Permisos | Quién en GRIXI |
|---|---|---|---|
| **Owner** | $20/mes | Todo + billing | Fundador/CTO |
| **Deployer (Member)** | $20/mes | Deploy, manage settings | DevOps lead |
| **Viewer Pro** | **Gratis** | Ver deployments, analytics, preview links | Todo el equipo dev |

**Para GRIXI:** 1 deployer ($20/mes) + viewers gratis para el resto del equipo. Los developers ven las preview deployments y analytics, pero solo 1 persona aprueba deploys a producción.

---

## 3. Ventajas Clave de Vercel para GRIXI

### 3.1 Preview Deployments

Cada Pull Request genera automáticamente una URL de preview:

```
PR #42: feature/new-warehouse-module
→ https://grixi-git-feature-new-warehouse-module.vercel.app

PR #43: fix/inventory-calculation
→ https://grixi-git-fix-inventory-calculation.vercel.app
```

**Ventajas:**
- Test visual de cada cambio antes de merge
- QA puede revisar sin configurar entorno local
- Integrado con GitHub — comment automático en el PR con la URL
- Combinado con Supabase Preview Branches = entorno completo aislado

### 3.2 Turbo Build Machines

El plan Pro incluye **Turbo Build Machines** por defecto:

| Especificación | Turbo Build |
|---|---|
| **vCPU** | 30 |
| **RAM** | 60 GB |
| **Concurrent builds** | 12 |
| **Build cache** | Persistente (Turborepo remote cache) |

**Para GRIXI esto significa:**
- Build de Next.js 16 + Turborepo monorepo en **~60-90 segundos** en vez de 5-10 minutos
- 12 builds simultáneos si todo el equipo pushea al mismo tiempo
- Remote Cache de Turborepo acelera builds incrementales dramáticamente

### 3.3 Edge Middleware

El middleware de Next.js se ejecuta en Vercel Edge Runtime:

```typescript
// middleware.ts — Se ejecuta en 200+ locations globales
export function middleware(request: NextRequest) {
  // Resolución de tenant por subdomain
  const slug = request.headers.get('host')?.split('.')[0]
  
  // Verificación de auth (rápida, en el edge)
  const token = request.cookies.get('sb-access-token')
  if (!token && !isPublicPath(request.url)) {
    return NextResponse.redirect('/login')
  }
  
  // Inyectar tenant slug como header
  const response = NextResponse.next()
  response.headers.set('x-tenant-slug', slug || 'app')
  return response
}
```

**Ventajas del Edge Middleware:**
- Ejecuta en **<50ms** en cualquier parte del mundo
- Resolución de tenant y auth check **antes** de que el request llegue a la función serverless
- Redireccionamientos instantáneos sin tocar el servidor

### 3.4 Server Components y Server Actions

Next.js 16 App Router con Vercel ejecuta:

| Tipo | Dónde ejecuta | Uso en GRIXI |
|---|---|---|
| **Server Components** | Vercel Serverless (Node.js) | Fetch de datos, renderizado con Supabase |
| **Server Actions** | Vercel Serverless (Node.js) | Mutations, formularios, operaciones de escritura |
| **Client Components** | Browser del usuario | Interactividad, estados, animaciones |
| **Edge Middleware** | Vercel Edge (250+ locations) | Auth check, tenant resolution, redirects |

```typescript
// Server Component — Runs on Vercel serverless
export default async function WarehousesPage() {
  const supabase = await createServerClient()
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*') // RLS filtra por organization_id automáticamente
  
  return <WarehouseList warehouses={warehouses} />
}

// Server Action — Runs on Vercel serverless
'use server'
export async function createWarehouse(formData: FormData) {
  const supabase = await createServerClient()
  const validated = warehouseSchema.parse({
    name: formData.get('name'),
    location: formData.get('location'),
  })
  
  const { data, error } = await supabase
    .from('warehouses')
    .insert(validated) // organization_id se inyecta vía RLS trigger
    .select()
    .single()
  
  revalidatePath('/warehouses')
  return { data, error }
}
```

### 3.5 Spend Management

Vercel Pro incluye alertas de gasto para evitar sorpresas:

- **Alerta al 75%** del crédito mensual ($20)
- **Notificaciones diarias/semanales** de uso on-demand
- **Límites configurables** para pausar deploys si se excede un threshold
- **Dashboard de uso** con breakdown por recurso

### 3.6 ISR (Incremental Static Regeneration)

Para páginas que no cambian frecuentemente (landing pages, docs, configuraciones):

```typescript
// Página estática con revalidación cada hora
export const revalidate = 3600 // 1 hora

export default async function PricingPage() {
  const plans = await getPlans() // Se cachea y revalida cada hora
  return <PricingTable plans={plans} />
}
```

---

## 4. Configuración de Dominios

### 4.1 Dominios en Vercel

| Dominio | Tipo | Configuración |
|---|---|---|
| `app.grixi.com` | Principal | A record → Vercel |
| `*.grixi.app` | Wildcard | CNAME → Vercel (para tenants) |
| `empresa1.com` | Custom tenant | CNAME → Vercel (agregado por SuperAdmin) |

### 4.2 Wildcard DNS con Cloudflare

```
DNS en Cloudflare:
  *.grixi.app → CNAME → cname.vercel-dns.com (proxied)
  
Vercel Project Domains:
  *.grixi.app → Wildcard domain configured
```

**Flujo de un request tenant:**

```
empresa1.grixi.app
  → Cloudflare (WAF + CDN)
    → Vercel Edge (middleware resolve tenant)
      → Vercel Serverless (render con datos de org "empresa1")
        → Supabase (query filtered by org_id)
```

---

## 5. Integración con CI/CD

### 5.1 Vercel + GitHub Integration

```
Developer pushes to GitHub
  ↓
GitHub triggers Vercel webhook
  ↓
Vercel pulls code from GitHub
  ↓
Turbo Build Machine builds the project
  ↓
If PR → Preview Deployment (unique URL)
If main → Production Deployment
  ↓
Vercel comments on PR with preview URL
  ↓
QA tests on preview URL
  ↓
Merge PR → Auto-deploy to production
```

### 5.2 Environment Variables per Environment

| Environment | Variables | Uso |
|---|---|---|
| **Production** | URLs y keys de prod | `main` branch deploys |
| **Preview** | URLs y keys de staging | PR preview deploys |
| **Development** | URLs y keys de dev local | `vercel dev` |

```
# Production
NEXT_PUBLIC_SUPABASE_URL=https://api.grixi.app

# Preview (staging Supabase branch)
NEXT_PUBLIC_SUPABASE_URL=https://staging.api.grixi.app

# Development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
```

---

## 6. Performance y Optimización

### 6.1 Ventajas de Rendimiento

| Optimización | Cómo funciona | Impacto |
|---|---|---|
| **Edge Network** | 250+ PoPs globales (Anycast) | <50ms TTFB desde cualquier país |
| **Smart Routing** | Requests van al serverless region más cercano | Menor latencia backend |
| **Compression** | Brotli automático para todos los assets | ~30% menos bytes transferidos |
| **Image Optimization** | `next/image` se optimiza automáticamente en Vercel (formato, tamaño) | Imágenes 60-80% más ligeras |
| **Code Splitting** | Automático por ruta — solo carga el JS necesario | First Load JS mínimo |
| **Prefetching** | `<Link>` de Next.js pre-carga rutas en viewport | Navegación instantánea |
| **Streaming** | Server Components pueden streamear HTML al browser | TTFB ultra-rápido |
| **Turborepo Cache** | Remote cache en Vercel — builds incrementales | Builds 80% más rápidos |

### 6.2 Core Web Vitals Target

| Métrica | Target GRIXI | Vercel ayuda con |
|---|---|---|
| **LCP** | < 2.5s | Edge network, streaming SSR, image optimization |
| **FID/INP** | < 100ms | Code splitting, prefetching, minimal JS |
| **CLS** | < 0.1 | SSR (no layout shift), font optimization |
| **TTFB** | < 200ms | Edge middleware, smart routing, compression |

---

## 7. Add-ons Opcionales (Fase 2+)

| Add-on | Costo | Qué aporta | Cuándo activar |
|---|---|---|---|
| **Web Analytics Plus** | $10/mes | Pageviews, referrers, geography — sin scripts de terceros | Primeros clientes |
| **Speed Insights** | $10/mes/proyecto | Core Web Vitals tracking por ruta y dispositivo | Optimización CWV |
| **Observability Plus** | $10/mes | Logs de funciones, traces, error tracking | Debugging producción |
| **Firewall** | Incluido | Rate limiting y reglas IP por ruta | Desde el inicio |

---

## 8. Monitoreo y Analytics

### 8.1 Dashboard Incluido (Gratis en Pro)

- **Deployments**: Historial completo, logs de build, rollback con 1 click
- **Usage**: Bandwidth, requests, function invocations — desglose por día
- **Domains**: Health check de certificados SSL, DNS records
- **Logs** (Runtime): Logs de Server Components, Server Actions, API Routes
- **Functions**: Execution time, cold starts, errors por función

### 8.2 Rollback Instantáneo

Si un deploy introduce un bug:

```
1. Ir al dashboard de Vercel → Deployments
2. Click en el deployment anterior que funcionaba
3. "Promote to Production"
4. En <30 segundos el deploy anterior está live
```

**Sin downtime, sin rebuild.** Vercel mantiene cada deployment indefinidamente.
