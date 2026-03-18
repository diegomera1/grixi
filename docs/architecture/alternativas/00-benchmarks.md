# Alternativas — Performance Benchmarks Estimados

> Comparación de rendimiento esperado entre la arquitectura actual y cada alternativa.

---

## 1. Latencia de First Request (TTFB)

| Métrica | Actual (Vercel) | Alt. 1 (CF Workers) | Alt. 2 (Mac Studio) | Alt. 3 (Hetzner) |
|---|---|---|---|---|
| **Cold start** | 200-500ms | **0ms** (Workers no tienen cold starts) | 0ms (always-on) | 0ms (always-on) |
| **SSR TTFB (Ecuador)** | ~150ms | ~80-120ms (PoP cercano) | ~5-20ms (local) | ~160-200ms (Europa) |
| **SSR TTFB (USA)** | ~50ms | ~20-40ms | ~80ms | ~100-130ms |
| **SSR TTFB (Europa)** | ~100ms | ~20-40ms | ~180ms | **~10-30ms** |
| **Static assets** | ~30ms (CF CDN) | ~30ms (CF CDN) | ~30ms (CF CDN) | ~30ms (CF CDN) |
| **API call (DB query)** | ~80-150ms | ~80-150ms (SB) | **~1-5ms** | ~5-20ms |

---

## 2. Throughput Estimado

| Métrica | Actual | Alt. 1 | Alt. 2 | Alt. 3 |
|---|---|---|---|---|
| **Requests/sec max** | ~10K (Vercel auto-scale) | ~100K+ (Workers global) | ~2-5K (single server) | ~3-8K (single server) |
| **DB connections** | 60 (Supabase pooler) | 60 (Supabase pooler) | 200 (config directa) | 200 (config directa) |
| **WebSocket connections** | ~10K (Supabase RT) | ~10K (Supabase RT) | ~5-10K (Socket.io) | ~5-10K (Socket.io) |
| **Build time** | ~90s (Vercel Turbo) | ~90-120s (Wrangler) | ~60-90s (M4 Max) | ~120-180s (AMD Ryzen) |

---

## 3. Database Performance

| Query Type | Supabase (managed) | Self-hosted (PG 17) |
|---|---|---|
| **Simple SELECT** | ~5-15ms | ~1-5ms (sin red) |
| **Complex JOIN (3 tablas)** | ~20-50ms | ~5-15ms |
| **Full-text search** | ~10-30ms | ~5-15ms |
| **INSERT (single)** | ~10-20ms | ~1-5ms |
| **Bulk INSERT (1000 rows)** | ~100-300ms | ~20-50ms |
| **RLS overhead** | ~1-3ms | ~1-3ms (idéntico) |

> [!NOTE]
> Self-hosted PostgreSQL es **~3-5x más rápido** para queries directas porque elimina la latencia de red entre la aplicación y la DB. Pero Supabase incluye PostgREST, connection pooling, y cero mantenimiento.

---

## 4. Resumen Visual

```
Latencia SSR (Ecuador) — menor es mejor:
  Alt. 2 (local):  ██░░░░░░░░░░░░░░░░░░  ~10ms  ⭐ Mejor
  Alt. 1 (CF):     ████████░░░░░░░░░░░░  ~100ms
  Actual (Vercel): ████████████░░░░░░░░  ~150ms
  Alt. 3 (Hetzner):████████████████░░░░  ~180ms

Throughput — mayor es mejor:
  Alt. 1 (CF):     ████████████████████  ~100K+ req/s  ⭐ Mejor
  Actual (Vercel): ████████░░░░░░░░░░░░  ~10K  req/s
  Alt. 3 (Hetzner):████░░░░░░░░░░░░░░░░  ~5K   req/s
  Alt. 2 (local):  ███░░░░░░░░░░░░░░░░░  ~3K   req/s

DB Query Speed — menor es mejor:
  Alt. 2 (local):  ██░░░░░░░░░░░░░░░░░░  ~3ms   ⭐ Mejor
  Alt. 3 (Hetzner):███░░░░░░░░░░░░░░░░░  ~8ms
  Actual (SB):     ████████░░░░░░░░░░░░  ~20ms
  Alt. 1 (SB):     ████████░░░░░░░░░░░░  ~20ms
```
