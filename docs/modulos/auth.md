# Módulo: Autenticación y Sesiones

> Estado: ✅ Implementado
> Última actualización: 2026-04-01

## Descripción

Sistema de autenticación basado en **Supabase Auth** con Google OAuth PKCE.
Flujo completo: Login → Callback → Session → Redirect multi-tenant.

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `app/routes/login.tsx` | Página de login con fondo animado, branding per-tenant, Google OAuth |
| `app/routes/auth.callback.tsx` | Callback OAuth: session exchange, login history, audit log, notificación a admins |
| `app/routes/auth.signout.tsx` | Cierre de sesión con limpieza de cookies |
| `app/routes/authenticated.tsx` | Layout guard: valida sesión, resuelve org, carga permisos RBAC |
| `app/routes/select-org.tsx` | Selector de organización cuando el usuario pertenece a varias |
| `app/lib/supabase/client.server.ts` | Creación de clientes Supabase (server + admin) |

## Flujo de Autenticación

```
Login Page → Google OAuth → Supabase PKCEAuth Callback
    ↓
auth.callback.tsx:
  1. Exchange code for session
  2. Parse User-Agent (browser/OS/device)
  3. Insert into login_history
  4. Log audit event (user.login)
  5. Notify platform admins
  6. Redirect to /dashboard
```

## Seguridad

- **Cookie isolation**: cookies `SameSite=Lax`, `Secure`, `HttpOnly` por subdomain
- **Stale cookie cleanup**: worker intercepta y expira cookies con dominio `.grixi.ai`
- **Session timeout**: componente `SessionTimeout` muestra warning 5 minutos antes de expiración
- **Rate limiting**: 30 req/min en admin portal

## Tablas DB

- `auth.users` — usuarios Supabase
- `login_history` — historial de inicios de sesión (IP, browser, OS, device, geoloc)
- `audit_logs` — todas las acciones del usuario
