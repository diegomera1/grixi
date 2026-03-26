# Sistema de Registro y Documentación — GRIXI-APP

> Guía para mantener el proyecto auditado y documentado.

---

## ¿Por qué existe esto?

Todo cambio en GRIXI-APP debe quedar registrado. Este sistema asegura que:
- ✅ Se puede rastrear qué se hizo cualquier día
- ✅ Se conoce el estado actual del proyecto en segundos
- ✅ Cada módulo tiene documentación técnica actualizada
- ✅ Cualquier nuevo desarrollador puede entender el proyecto

---

## Estructura

| Carpeta | Propósito | Frecuencia |
|---------|-----------|------------|
| `registro/bitacora/` | Log diario de toda actividad de código | Cada sesión |
| `registro/estado-actual.md` | Progreso general del proyecto | Al cambiar estado |
| `docs/modulos/` | Documentación técnica por módulo | Incremental |
| `arquitectura/` | Specs de diseño (pre-desarrollo) | Si cambia diseño |

---

## 1. Bitácora Diaria

**Ubicación:** `registro/bitacora/YYYY-MM-DD.md`

### ¿Cuándo se crea?

Al iniciar sesión de trabajo. Si no existe el archivo del día, se crea automáticamente.

### ¿Qué se registra?

TODA acción de código, usando estos tags:

| Tag | Cuándo usar | Ejemplo |
|-----|-------------|---------|
| `[FEAT]` | Nueva funcionalidad | Nuevo componente, ruta, hook |
| `[FIX]` | Corrección de bug | Incluir causa raíz y solución |
| `[REFACTOR]` | Reestructuración | Sin cambio de funcionalidad |
| `[DB]` | Base de datos | Migraciones, RLS, índices |
| `[CONFIG]` | Configuración | Servicios, env vars, CI/CD |
| `[DEPS]` | Dependencias | Agregadas, actualizadas, eliminadas |
| `[DOCS]` | Documentación | README, docs de módulo |
| `[UI]` | Visual/estilístico | Cambios de diseño |
| `[SECURITY]` | Seguridad | RLS, auth, permisos |
| `[PERF]` | Performance | Optimizaciones |
| `[TEST]` | Testing | Tests nuevos o modificados |

### Formato de cada entrada

```
#### [TAG] Módulo — Descripción breve
- **Archivos:** `ruta/archivo.tsx`, `ruta/otro.ts`
- **Detalle:** Qué se hizo y por qué
- **Decisión:** (solo si hubo una decisión técnica importante)
```

---

## 2. Estado Actual

**Ubicación:** `registro/estado-actual.md`

Un snapshot que se **sobreescribe** (no acumula). Siempre refleja la realidad actual.
Se actualiza cuando cambia el estado de un módulo o componente de infraestructura.

---

## 3. Documentación por Módulo

**Ubicación:** `docs/modulos/nombre-del-modulo.md`

### Ciclo de vida

1. Al **iniciar** un módulo → crear doc con estado `🚧 En construcción`
2. **Durante** el desarrollo → actualizar con cada implementación relevante
3. Al **completar** → marcar `✅ Completo` + revisión final

### Diferencia con `arquitectura/`

- `arquitectura/` = **diseño** (cómo debería funcionar — pre-desarrollo)
- `docs/modulos/` = **implementación** (cómo funciona realmente — post-desarrollo)

### Template

```markdown
# Módulo: [Nombre]

**Estado:** 🚧 En construcción | ✅ Completo
**Última actualización:** YYYY-MM-DD

## Descripción
Qué hace este módulo y su propósito en la plataforma.

## Arquitectura
- Rutas: `app/routes/modulo.*`
- Componentes: `src/features/modulo/`
- Hooks: `src/features/modulo/hooks/`
- Server actions: `src/features/modulo/actions/`

## Base de Datos
| Tabla | Propósito | RLS |
|-------|-----------|-----|
| `tabla_x` | ... | ✅ |

## Endpoints / Loaders / Actions
| Ruta | Tipo | Descripción |
|------|------|-------------|
| `/modulo` | Loader | Lista principal |

## Flujos Principales
1. **Flujo X:** Usuario hace A → sistema hace B → resultado C

## Dependencias
- `paquete-x` — para qué se usa

## Notas Técnicas
Gotchas, decisiones no obvias, workarounds.
```

---

## 4. Commits

Formato: Conventional Commits en español.

```
feat(auth): implementar login con Google OAuth
fix(almacenes): corregir cálculo de ocupación de racks
docs(compras): actualizar documentación del módulo
refactor(dashboard): extraer KPI cards a componentes separados
chore(deps): actualizar supabase-js a 2.50
```

---

## Resumen Rápido

```
¿Qué se hizo hoy?            → registro/bitacora/YYYY-MM-DD.md
¿Cómo va el proyecto?         → registro/estado-actual.md
¿Cómo funciona X módulo?      → docs/modulos/x.md
¿Cómo está diseñado?          → arquitectura/
¿Qué cambió en el código?     → git log
¿Cómo funciona este sistema?  → registro/README.md (este archivo)
```
