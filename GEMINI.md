# GRIXI-APP — Agent Rules

> Reglas e instrucciones para agentes AI que trabajan en el proyecto GRIXI-APP.

---

## Proyecto

GRIXI es una plataforma SaaS enterprise multi-tenant construida con:
- **Frontend:** React Router v7 (Vite 8 + Rolldown) en Cloudflare Workers
- **Backend:** Supabase (PostgreSQL + RLS + Auth + Realtime + Storage)
- **Edge:** Cloudflare Workers + KV + R2 + Hyperdrive
- **AI:** Google Gemini 2.5 Pro

La arquitectura completa está documentada en `./arquitectura/` (15 documentos).

---

## Estructura del Proyecto

```
GRIXI-APP/
├── arquitectura/          # Documentación de arquitectura (15 archivos MD)
│   ├── 01-overview.md     # Visión general de la arquitectura
│   ├── 02-stack.md        # Stack tecnológico
│   ├── 03-react-router.md # React Router v7 (migración desde Next.js)
│   ├── 04-supabase.md     # Configuración de Supabase
│   ├── 05-cloudflare-workers.md  # Cloudflare Workers
│   ├── 06-seguridad.md    # Capas de seguridad
│   ├── 07-costos.md       # Desglose de costos
│   ├── 08-avanzado.md     # KV cache, R2, environments
│   ├── 09-workflows.md    # Workflows de desarrollo
│   ├── 10-setup-guide.md  # Guía de setup desde cero
│   ├── 11-database-schema.md  # Schema PostgreSQL multi-tenant
│   ├── 12-modules.md      # Especificación de 11 módulos
│   ├── 13-ui-design-system.md  # Design system
│   ├── 14-ai-integration.md    # Integración con Gemini
│   └── 15-roadmap.md      # Roadmap de 12 semanas
├── instrucciones/         # Guías operativas
│   └── google-workspace-cli.md  # Configuración y uso del GWS CLI
└── .agents/               # Skills y configuración de agentes
```

---

## Google Workspace CLI

El proyecto tiene acceso completo a Google Workspace via el CLI `gws`:

- **Cuenta:** `dmera@grixi.ai`
- **Proyecto GCP:** `grixi-workspace` (organización `grixi.ai`)
- **Servicios:** Drive, Gmail, Calendar, Chat, Docs, Sheets, Slides, Tasks, Admin Directory
- **Guía completa:** Ver `./instrucciones/google-workspace-cli.md`

### Uso rápido:

```bash
# Listar espacios de Chat
gws chat spaces list --format table

# Listar archivos en Drive
gws drive files list --params '{"pageSize": 10}' --format table

# Listar correos
gws gmail users messages list --params '{"userId": "me", "maxResults": 5}' --format table
```

> **IMPORTANTE:** Siempre usar `--format table` para salida legible o `--format json` para procesamiento. El CLI **NO** depende del proyecto personal `trukolabs` — todo opera bajo `grixi-workspace`.

---

## Convenciones

1. **Idioma:** Documentación y commits en español
2. **Naming:** GRIXI siempre en mayúsculas
3. **Supabase:** Usar RLS y políticas de seguridad en todas las tablas
4. **Cloud:** Todo bajo la organización `grixi.ai` — no usar cuentas personales
