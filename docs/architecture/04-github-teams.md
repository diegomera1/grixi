# GRIXI × GitHub Teams — Repositorio, CI/CD y Colaboración

> Documento detallado sobre cómo GRIXI utiliza GitHub Teams para gestión de código, automatización, y flujos de trabajo de equipo.

---

## 1. ¿Por Qué GitHub Teams?

### 1.1 El Rol de GitHub en la Arquitectura

GitHub es el **sistema nervioso central** del desarrollo de GRIXI:

```
┌─────────────────────────────────────────────┐
│               GITHUB TEAMS                   │
│                                             │
│  Código                                     │
│  ├── Monorepo Turborepo                     │
│  ├── Protected Branches                     │
│  └── Code Owners                            │
│                                             │
│  CI/CD                                      │
│  ├── GitHub Actions                         │
│  ├── → Vercel Deploy (auto)                │
│  └── → Supabase Branch (auto)              │
│                                             │
│  Colaboración                               │
│  ├── Pull Requests con Reviews              │
│  ├── Issues + Project Boards                │
│  └── Discussions                             │
│                                             │
│  Seguridad                                  │
│  ├── Environment Secrets                    │
│  ├── Dependabot Alerts                      │
│  └── Code Scanning (CodeQL)                 │
└─────────────────────────────────────────────┘
```

### 1.2 ¿Por Qué Teams y No el Plan Free?

| Característica | Free | **Teams ($4/user/mes)** |
|---|---|---|
| Repos privados | ✅ | ✅ |
| Colaboradores | Ilimitados | Ilimitados |
| **GitHub Actions** | 2,000 min/mes | **3,000 min/mes** |
| **Protected Branches** | En repos públicos | ✅ **En repos privados** |
| **Required Reviewers** | En repos públicos | ✅ **En repos privados** |
| **Code Owners** | ❌ | ✅ |
| **Draft PRs** | ✅ | ✅ |
| **Environment Secrets** | Limitado | ✅ **Por environment** |
| **Repository Rules** | Básico | ✅ **Avanzado** |
| **Pages** | Público | ✅ Privado |
| **Wikis** | ✅ | ✅ |
| **Soporte** | Community | **Web-based** |
| **Packages** | 500 MB | **2 GB** |
| **Security Overview** | ❌ | ✅ |
| **Codespaces** | 60 hrs/mes | ✅ 90 hrs/mes |

**Lo crítico para GRIXI:**
- **Protected Branches en repos privados** — `main` debe estar protegida en un repo privado
- **Required Reviewers** — Todo PR a `main` requiere aprobación
- **Code Owners** — Asignar responsables por módulo
- **Environment Secrets** — Separar secrets de prod, staging, y dev
- **3,000 min de Actions** — CI/CD robusto sin preocuparse por límites

---

## 2. Plan Teams — Detalle Completo

### 2.1 Costos

| Concepto | Costo |
|---|---|
| **Por usuario** | $4/mes (facturación anual) |
| **3 usuarios** | $12/mes |
| **5 usuarios** | $20/mes |
| **8 usuarios (Fase 3)** | $32/mes |

### 2.2 GitHub Actions — 3,000 minutos/mes

| Runner | Multiplicador | Minutos efectivos |
|---|---|---|
| **Linux** | 1x | 3,000 min |
| **Windows** | 2x | 1,500 min |
| **macOS** | 10x | 300 min |

**Para GRIXI solo usamos Linux** → 3,000 minutos completos.

Estimación de uso:

```
Workflow promedio de CI: ~3 minutos (lint + typecheck + build)
  
  Pull Requests:  ~20 PRs/mes × 3 min = 60 min
  Pushes a main:  ~20 merges/mes × 3 min = 60 min
  Pushes a develop: ~40/mes × 3 min = 120 min
  
  Total estimado: ~240 min/mes (de 3,000 disponibles)
  Uso: ~8% — margen enorme
```

### 2.3 Add-ons Opcionales

| Add-on | Costo | Necesario? |
|---|---|---|
| **GitHub Copilot Business** | $19/user/mes | Opcional — usa Gemini en GRIXI en su lugar |
| **Actions Storage** | $0.25/GB | Solo si se exceden los 2 GB incluidos |
| **Large File Storage** | $5/50GB | Solo si se necesita almacenar archivos binarios grandes |

---

## 3. Estructura del Monorepo

### 3.1 Organización con Turborepo

```
grixi/                          ← Raíz del monorepo
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              ← CI principal (lint, test, build)
│   │   ├── deploy-preview.yml  ← Deploy de preview a Vercel
│   │   └── deploy-prod.yml     ← Deploy de producción
│   ├── CODEOWNERS              ← Asignación de reviewers por path
│   └── pull_request_template.md
│
├── apps/
│   └── web/                    ← Next.js 16 App Router
│       ├── src/
│       │   ├── app/            ← Pages y layouts
│       │   ├── components/     ← Componentes UI
│       │   ├── features/       ← Lógica de negocio por módulo
│       │   ├── lib/            ← Utilidades core
│       │   └── types/          ← Types globales
│       ├── public/
│       ├── next.config.ts
│       └── package.json
│
├── packages/                   ← Shared packages (futuro)
│   ├── ui/                     ← Component library compartida
│   ├── config/                 ← ESLint, TypeScript configs
│   └── utils/                  ← Utilidades compartidas
│
├── supabase/
│   ├── migrations/             ← Migraciones SQL versionadas
│   ├── functions/              ← Edge Functions source code
│   └── seed.sql                ← Datos de seed para desarrollo
│
├── docs/
│   └── architecture/           ← Documentación de arquitectura
│
├── turbo.json                  ← Turborepo config
├── pnpm-workspace.yaml         ← Workspace config
├── package.json                ← Root package.json
└── gemini.md                   ← Reglas del proyecto
```

### 3.2 Ventajas del Monorepo

| Ventaja | Detalle |
|---|---|
| **Código único** | Una sola fuente de verdad para todo el proyecto |
| **Dependencias compartidas** | Packages comunes entre apps sin duplicar |
| **Turborepo caching** | Builds incrementales — solo compila lo que cambió |
| **Remote Cache** | Vercel almacena el cache de builds — equipos no recompilan lo mismo |
| **Atomic commits** | Un cambio que afecta frontend + migrations + functions = 1 commit |
| **Versionado unificado** | Todo tiene la misma versión, sin dependency hell |

---

## 4. Branching Strategy

### 4.1 Modelo de Branches

```
main (producción) ←── PR required + 1 reviewer
  │
  ├── develop (staging) ←── PR required
  │     │
  │     ├── feature/almacenes-zones
  │     │     └── (PR → develop → tests → merge)
  │     │
  │     ├── feature/compras-dashboard
  │     │     └── (PR → develop → tests → merge)
  │     │
  │     └── feature/rrhh-attendance
  │           └── (PR → develop → tests → merge)
  │
  └── hotfix/critical-security-fix
        └── (PR → main directly → fast merge)
```

### 4.2 Reglas de Branches

| Branch | Protección | Reviewers | CI Required | Deploy Target |
|---|---|---|---|---|
| `main` | ✅ Protected | 1 mínimo | ✅ Must pass | Vercel Production |
| `develop` | ✅ Protected | Recomendado | ✅ Must pass | Vercel Preview (staging) |
| `feature/*` | ❌ | — | ✅ On PR | Vercel Preview |
| `hotfix/*` | ❌ | 1 mínimo | ✅ Must pass | Vercel Production (via main) |

### 4.3 Branch Naming Convention

```
feature/[módulo]-[descripción]    → feature/almacenes-3d-zones
fix/[módulo]-[descripción]        → fix/compras-total-calculation
hotfix/[descripción]              → hotfix/auth-session-leak
refactor/[área]-[descripción]     → refactor/api-error-handling
docs/[tema]                       → docs/architecture-update
```

### 4.4 Sincronización con Supabase Branching

| Git Branch | Supabase Branch | Tipo |
|---|---|---|
| `main` | Production | Permanente |
| `develop` | `develop` | Persistent Branch |
| `feature/*` | Preview Branch (auto) | Efímero |

```
1. git checkout -b feature/new-module
2. Supabase CLI: supabase branches create feature/new-module
3. Escribir migración en supabase/migrations/
4. Migración se aplica al Preview Branch
5. Testear contra Preview Branch URL
6. git push + PR → develop
7. Merge → migración aplica al branch develop de Supabase
8. PR develop → main
9. Merge → migración aplica a producción
```

---

## 5. CODEOWNERS

### 5.1 ¿Qué es CODEOWNERS?

CODEOWNERS asigna **automáticamente reviewers** cuando un PR modifica archivos de ciertas rutas. Esto garantiza que el experto en cada área revise los cambios.

### 5.2 Configuración para GRIXI

```ini
# .github/CODEOWNERS

# Default: el lead revisa todo
*                                   @grixi/lead

# Infraestructura y base de datos
supabase/migrations/                @grixi/lead @grixi/backend
supabase/functions/                 @grixi/lead @grixi/backend

# Módulos específicos
src/features/almacenes/             @grixi/almacenes-team
src/features/compras/               @grixi/compras-team
src/features/finanzas/              @grixi/finanzas-team
src/features/rrhh/                  @grixi/rrhh-team
src/features/ai/                    @grixi/lead

# Componentes compartidos
src/components/ui/                  @grixi/lead
src/components/shared/              @grixi/lead

# Configuración crítica
next.config.ts                      @grixi/lead
turbo.json                          @grixi/lead
package.json                        @grixi/lead
gemini.md                           @grixi/lead

# Seguridad
src/lib/supabase/                   @grixi/lead
middleware.ts                       @grixi/lead

# Documentación
docs/                               @grixi/lead
```

### 5.3 Ventaja para GRIXI

- **Revisión automática por expertos**: Si alguien modifica migraciones SQL, el lead de backend se asigna automáticamente
- **No se olvidan reviews**: GitHub bloquea el merge hasta que el CODEOWNER aprueba
- **Escala con el equipo**: A medida que crece el equipo, cada módulo tiene su responsable

---

## 6. GitHub Actions — CI/CD

### 6.1 Pipeline Principal

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      
      # TypeScript type checking (strict mode)
      - name: TypeScript Check
        run: pnpm turbo typecheck
      
      # ESLint
      - name: Lint
        run: pnpm turbo lint
      
      # Build verification
      - name: Build
        run: pnpm turbo build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  # Solo en PRs: dejar comentario con preview URL
  preview-comment:
    if: github.event_name == 'pull_request'
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - name: Comment Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.payload.pull_request.number;
            const previewUrl = `https://grixi-git-${context.payload.pull_request.head.ref}.vercel.app`;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: prNumber,
              body: `🚀 Preview deployment: ${previewUrl}`
            });
```

### 6.2 Pipeline de Migraciones Supabase

```yaml
# .github/workflows/supabase-migration.yml
name: Supabase Migration Check

on:
  pull_request:
    paths:
      - 'supabase/migrations/**'

jobs:
  migration-check:
    name: Validate Migrations
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      
      # Verificar que las migraciones son válidas
      - name: Check Migration Syntax
        run: |
          for file in supabase/migrations/*.sql; do
            echo "Checking: $file"
            # Validar sintaxis SQL
            supabase db lint --file "$file"
          done
      
      # Verificar que RLS está habilitado en nuevas tablas
      - name: Check RLS Compliance
        run: |
          for file in supabase/migrations/*.sql; do
            if grep -q "CREATE TABLE" "$file"; then
              if ! grep -q "ENABLE ROW LEVEL SECURITY" "$file"; then
                echo "❌ ERROR: $file creates a table without RLS!"
                exit 1
              fi
            fi
          done
          echo "✅ All tables have RLS enabled"
```

### 6.3 Ventajas del CI/CD Integrado

| Ventaja | Detalle |
|---|---|
| **Catch bugs early** | TypeScript + ESLint detectan errores antes del merge |
| **Build verification** | Si el build falla, el PR no se puede mergear |
| **RLS compliance** | Scripts automáticos verifican que toda tabla tiene RLS |
| **Zero manual deploy** | Push → CI → Vercel deploy automático |
| **Rollback fácil** | Revert un commit en Git = rollback del deploy |
| **Audit trail** | Historial completo de quién mergeó qué y cuándo |

---

## 7. Environment Secrets

### 7.1 Separación por Environment

```
GitHub Repository Settings → Secrets and Variables

Production (main):
  ├── NEXT_PUBLIC_SUPABASE_URL=https://api.grixi.app
  ├── NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...production
  ├── SUPABASE_SERVICE_ROLE_KEY=eyJ...production
  └── GEMINI_API_KEY=...production

Staging (develop):
  ├── NEXT_PUBLIC_SUPABASE_URL=https://staging.api.grixi.app
  ├── NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...staging
  ├── SUPABASE_SERVICE_ROLE_KEY=eyJ...staging
  └── GEMINI_API_KEY=...staging

Development (feature/*):
  ├── NEXT_PUBLIC_SUPABASE_URL=[preview-branch-url]
  └── ... (keys del preview branch)
```

### 7.2 ¿Por qué es importante?

- **Producción nunca se contamina** con datos de staging
- **Keys sensibles** están encriptadas y solo accesibles durante el CI
- **Rotación de secrets** se hace en un solo lugar
- **Cada ambiente tiene sus propias credenciales** de Supabase

---

## 8. Pull Request Template

### 8.1 Template Estándar

```markdown
<!-- .github/pull_request_template.md -->

## 📝 Descripción
<!-- ¿Qué cambió y por qué? -->

## 📸 Screenshots / Videos
<!-- Si aplica, agrega capturas del cambio visual -->

## 🔗 Módulo(s) Afectado(s)
- [ ] Almacenes
- [ ] Compras
- [ ] Finanzas
- [ ] RRHH
- [ ] GRIXI AI
- [ ] Core / Shared
- [ ] Infraestructura / DB

## ✅ Checklist
- [ ] TypeScript strict — sin `any`
- [ ] RLS policies si hay tablas nuevas
- [ ] Índices en columnas de filtro (`organization_id`)
- [ ] `organization_id` en toda tabla de negocio
- [ ] Server Components por defecto (`"use client"` solo si necesario)
- [ ] Zod validation en formularios
- [ ] Responsive (mobile-first)
- [ ] Dark mode funcional

## 🗄️ Migraciones SQL
- [ ] No hay migraciones en este PR
- [ ] Hay migraciones — verificar en Supabase Preview Branch

## 🧪 Testing
<!-- ¿Cómo se puede verificar este cambio? -->
```

---

## 9. Security Features

### 9.1 Dependabot

GitHub incluye **Dependabot** para alertar sobre dependencias vulnerables:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

- **Alertas automáticas** cuando una dependencia tiene un CVE
- **PRs automáticos** para actualizar dependencias vulnerables
- **Agrupamiento** de actualizaciones menores — un solo PR en vez de 20

### 9.2 Code Scanning (CodeQL)

```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1' # Cada lunes

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

- **Análisis estático de seguridad** del código TypeScript
- **Detecta** SQL injection, XSS, hardcoded credentials, y más
- **Se ejecuta semanalmente** + en cada push a main

### 9.3 Secret Scanning

GitHub automáticamente escanea el repositorio buscando:
- API keys expuestas
- Tokens de acceso
- Credenciales de base de datos
- JWT secrets

Si detecta un secret, **bloquea el push** y notifica al contributor.

---

## 10. Ventajas Completas para GRIXI

| Área | Ventaja | Impacto |
|---|---|---|
| **Código** | Protected branches + reviewers | Cero cambios sin revisión a producción |
| **CI/CD** | GitHub Actions + Vercel auto-deploy | Deploy automático, zero manual steps |
| **Seguridad** | Dependabot + CodeQL + Secret Scanning | Vulnerabilidades detectadas automáticamente |
| **Colaboración** | PRs + CODEOWNERS + templates | Proceso estandarizado para todo cambio |
| **Costo** | $4/user/mes | ~$12-32/mes para 3-8 developers |
| **Integración** | Native con Vercel + Supabase CLI | Flujo end-to-end sin herramientas extra |
| **Historial** | Git history + PR discussions | Audit trail completo de decisiones |
| **Migraciones** | SQL en código + CI validation | Base de datos versionada como código |
