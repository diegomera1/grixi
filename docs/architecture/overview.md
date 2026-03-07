# Grixi — Arquitectura del Sistema

## Visión General

Grixi es una plataforma SaaS enterprise multi-tenant cuyo propósito es ser **la interconexión inteligente de toda la empresa**. Se conecta a distintos sistemas (SAP, ERPs, CRMs, IoT) y trata la data de manera inteligente usando IA.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL (Edge)                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 (App Router + RSC)               │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │ Landing  │  │ Usuarios │  │  Admin   │  │Almacenes│ │   │
│  │  │  Page    │  │  Module  │  │  Audit   │  │Warehouse│ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │            AI Chat (Gemini 3.1 Flash Lite)         │  │   │
│  │  │         Transversal a todos los módulos            │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────────────────────────────────┐
│                     SUPABASE (Backend)                           │
│                                                                 │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │PostgreSQL │  │   Auth   │  │ Realtime │  │    Storage    │  │
│  │+ OrioleDB │  │ (Google) │  │(WebSocket│  │  (Assets)    │  │
│  │           │  │          │  │          │  │              │  │
│  │ 18 tablas │  │  OAuth   │  │ Sesiones │  │ Logos, fotos │  │
│  │ RLS en    │  │  JWT     │  │ Audit    │  │              │  │
│  │ todas     │  │  RLS     │  │ Warehouse│  │              │  │
│  └───────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Edge Functions (Deno)                        │  │
│  │  • Gemini AI proxy      • Webhook handlers               │  │
│  │  • Email notifications  • Cron jobs                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│               INTEGRACIONES FUTURAS                             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌──────┐  ┌──────────┐ │
│  │ SAP │  │ ERP │  │ CRM │  │ IoT │  │ RFID │  │Facturación│ │
│  └─────┘  └─────┘  └─────┘  └─────┘  └──────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy

Cada empresa (tenant) es una `organization`. Los usuarios se vinculan a organizaciones mediante `organization_members`. Toda tabla con datos de negocio tiene `org_id` y RLS filtra automáticamente.

```
Organization A ──> Sus usuarios, roles, almacenes, auditoría
Organization B ──> Sus usuarios, roles, almacenes, auditoría
(completamente aislados)
```

**Demo:** Mínimo 2 tenants:

- **Grixi Industrial S.A.** — Empresa manufacturera con almacenes
- **Grixi Logística S.A.** — Operador logístico con cross-docking

## Módulos del Sistema

| #   | Módulo             | Ruta              | Descripción                            |
| --- | ------------------ | ----------------- | -------------------------------------- |
| 1   | **Landing Page**   | `/`               | Página de marketing + Login con Google |
| 2   | **Dashboard**      | `/dashboard`      | Vista general con KPIs                 |
| 3   | **Usuarios**       | `/usuarios`       | Gestión de personas, roles, permisos   |
| 4   | **Administración** | `/administracion` | Auditoría, tracking, sesiones          |
| 5   | **Almacenes**      | `/almacenes`      | Warehouse 2D/3D, inventario, racks     |
| 6   | **AI Chat**        | Panel lateral     | Gemini AI transversal                  |

## Base de Datos

Ver: [docs/architecture/database-schema.md](./database-schema.md)

## Design System

Ver: [docs/architecture/design-system.md](./design-system.md)

## Seguridad

1. **RLS en todas las tablas** — Ningún dato accesible sin política
2. **Google OAuth** — Autenticación delegada
3. **Audit completa** — Cada acción, cada click registrado
4. **Sesiones controladas** — Cierre remoto en tiempo real
5. **Input validation** — Zod en client Y server
6. **API keys** — Nunca expuestas en el frontend
