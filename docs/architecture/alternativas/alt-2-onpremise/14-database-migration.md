# Alternativas 2 y 3 — Migración de Base de Datos

> Cómo migrar las migraciones SQL de Supabase a PostgreSQL standalone: extensiones, triggers, y funciones.

---

## 1. Extensiones Requeridas

```sql
-- Extensiones que Supabase habilita por defecto y necesitamos en standalone
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Búsqueda fuzzy (trigrams)
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector (AI embeddings)
CREATE EXTENSION IF NOT EXISTS "pg_cron";         -- Cron jobs
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query analytics
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN indexes
CREATE EXTENSION IF NOT EXISTS "citext";          -- Case-insensitive text
```

---

## 2. Proceso de Migración

### Paso 1: Exportar migraciones de Supabase

```bash
# Todas las migraciones están en supabase/migrations/
ls supabase/migrations/
# 20240101000000_create_organizations.sql
# 20240102000000_create_warehouses.sql
# ...
```

### Paso 2: Adaptar migraciones

Cambios necesarios en las migraciones SQL:

| Cambiar | De (Supabase) | A (Standalone) |
|---|---|---|
| `auth.uid()` | Función built-in de Supabase | `get_current_user_id()` (nuestra custom) |
| `auth.jwt()` | Acceso a JWT claims | `current_setting('app.jwt_claims', true)::jsonb` |
| `supabase_realtime` | Schema de Realtime | Eliminar (usamos Socket.io) |
| `storage.objects` | Storage policies | Eliminar (usamos MinIO) |
| `supabase_functions` | Edge Functions schema | Eliminar (usamos BullMQ) |

### Script de adaptación

```bash
#!/bin/bash
# scripts/adapt-migrations.sh
MIGRATION_DIR="supabase/migrations"
OUTPUT_DIR="postgres/migrations"

mkdir -p $OUTPUT_DIR

for file in $MIGRATION_DIR/*.sql; do
  filename=$(basename "$file")
  
  # Reemplazar auth.uid() por nuestra función
  sed 's/auth\.uid()/get_current_user_id()/g' "$file" |
  # Reemplazar auth.jwt()
  sed "s/auth\.jwt()/current_setting('app.jwt_claims', true)::jsonb/g" |
  # Eliminar referencias a schemas de Supabase
  grep -v 'supabase_realtime' |
  grep -v 'storage\.objects' |
  grep -v 'supabase_functions' |
  grep -v 'extensions\.' > "$OUTPUT_DIR/$filename"
  
  echo "Adapted: $filename"
done
```

### Paso 3: Crear migration runner

```typescript
// lib/db/migrate.ts
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { db } from './client'
import { sql } from 'drizzle-orm'

export async function runMigrations() {
  // Crear tabla de tracking
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const dir = join(process.cwd(), 'postgres/migrations')
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    // Check if already applied
    const existing = await db.execute(sql`
      SELECT 1 FROM _migrations WHERE name = ${file}
    `)
    if (existing.rows.length > 0) continue

    const content = await readFile(join(dir, file), 'utf-8')
    await db.execute(sql.raw(content))
    await db.execute(sql`INSERT INTO _migrations (name) VALUES (${file})`)
    console.log(`✅ Applied: ${file}`)
  }
}
```

---

## 3. Drizzle Schema (Nuevas Tablas)

```typescript
// lib/db/schema.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  isActive: boolean('is_active').default(true),
  branding: jsonb('branding'),
  enabledModules: jsonb('enabled_modules'),
  configOverrides: jsonb('config_overrides'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull(), // 'owner' | 'admin' | 'member' | 'viewer'
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  location: text('location'),
  config: jsonb('config'),
  createdAt: timestamp('created_at').defaultNow(),
})
```
