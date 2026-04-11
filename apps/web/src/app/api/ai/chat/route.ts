import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type HistoryMsg = {
  role: "user" | "assistant";
  content: string;
};

/** Build the system prompt with real data from the current module context */
async function buildSystemPrompt(modules: string[]): Promise<string> {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: warehouseCount },
    { count: productCount },
    {}, // warehouses list — unused; warehouseDetails used inside almacenes block
    { count: transactionCount },
    { count: vendorCount },
    { count: poCount },
    { count: prCount },
    { count: fleetEquipmentCount },
    { count: fleetWOCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("name, type, location"),
    supabase
      .from("finance_transactions")
      .select("*", { count: "exact", head: true }),
    supabase.from("vendors").select("*", { count: "exact", head: true }),
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
    supabase.from("purchase_requisitions").select("*", { count: "exact", head: true }),
    supabase.from("fleet_equipment").select("*", { count: "exact", head: true }),
    supabase.from("fleet_work_orders").select("*", { count: "exact", head: true }),
  ]);

  let moduleContext = "";

  const isGeneral = modules.includes("general");

  if (modules.includes("almacenes") || isGeneral) {
    const { data: products } = await supabase
      .from("products")
      .select("name, category, sku, min_stock")
      .limit(10);

    const { data: lowStock } = await supabase
      .from("products")
      .select("name, min_stock")
      .gt("min_stock", 0)
      .limit(5);

    // WMS-specific enriched data
    const { data: warehouseDetails } = await supabase
      .from("warehouses")
      .select("id, name, type, location, sap_plant_code")
      .limit(10);

    const { data: allPositions } = await supabase
      .from("rack_positions")
      .select("rack_id, status")
      .limit(5000);

    const { data: allRacks } = await supabase
      .from("racks")
      .select("id, warehouse_id, code, rows, columns")
      .limit(500);

    // Build occupancy map per warehouse
    const rackToWarehouse = new Map<string, string>();
    for (const r of allRacks || []) rackToWarehouse.set(r.id, r.warehouse_id);

    const warehouseOccupancy = new Map<string, { total: number; occupied: number; reserved: number; expired: number; quarantine: number }>();
    for (const p of allPositions || []) {
      const whId = rackToWarehouse.get(p.rack_id);
      if (!whId) continue;
      if (!warehouseOccupancy.has(whId)) warehouseOccupancy.set(whId, { total: 0, occupied: 0, reserved: 0, expired: 0, quarantine: 0 });
      const s = warehouseOccupancy.get(whId)!;
      s.total++;
      if (p.status === "occupied" || p.status === "active") s.occupied++;
      if (p.status === "reserved") s.reserved++;
      if (p.status === "expired") s.expired++;
      if (p.status === "quarantine") s.quarantine++;
    }

    // Build per-warehouse detail for chart data and navigation
    const warehouseChartData = (warehouseDetails || []).map(w => {
      const occ = warehouseOccupancy.get(w.id) || { total: 0, occupied: 0, reserved: 0, expired: 0, quarantine: 0 };
      const pct = occ.total > 0 ? Math.round((occ.occupied / occ.total) * 100) : 0;
      const rackCodes = (allRacks || []).filter(r => r.warehouse_id === w.id).map(r => r.code);
      return { id: w.id, name: w.name, type: w.type, pct, occupied: occ.occupied, total: occ.total, reserved: occ.reserved, expired: occ.expired, quarantine: occ.quarantine, rackCodes };
    });

    const occupancySummary = warehouseChartData.map(w =>
      `${w.name} (id:${w.id}, tipo:${w.type}): ${w.pct}% ocupado (${w.occupied}/${w.total} posiciones, ${w.reserved} reservadas, ${w.expired} vencidas, ${w.quarantine} cuarentena) — Racks: ${w.rackCodes.join(", ") || "N/A"}`
    ).join("\n  ");

    // Pre-built chart data for the AI to use directly
    const chartDataJson = JSON.stringify(warehouseChartData.map(w => ({
      name: w.name.length > 18 ? w.name.slice(0, 18) + "…" : w.name,
      ocupacion: w.pct,
      ocupadas: w.occupied,
      vacias: w.total - w.occupied,
    })));

    // Top storage units with location detail
    const whMap = new Map((warehouseDetails || []).map(w => [w.id, w]));
    let suSummary = "Sin datos";
    try {
      const { data: topSUs } = await supabase
        .from("storage_units")
        .select("su_code, su_type, quantity, product_id, position_id, warehouse_id, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(15);

      // Map SU rack positions to rack codes
      const suPositionIds = (topSUs || []).map(su => su.position_id).filter(Boolean);
      const { data: suPositions } = suPositionIds.length > 0
        ? await supabase.from("rack_positions").select("id, rack_id, row_number, column_number, status").in("id", suPositionIds)
        : { data: [] };
      const posMap = new Map((suPositions || []).map(p => [p.id, p]));
      const rackMap = new Map((allRacks || []).map(r => [r.id, r]));

      suSummary = (topSUs || []).slice(0, 10).map(su => {
        const prod = (su as unknown as { products: { name: string; sku: string } | null }).products;
        const pos = posMap.get(su.position_id);
        const rack = pos ? rackMap.get(pos.rack_id) : null;
        const wh = whMap.get(su.warehouse_id);
        return `${su.su_code} (${prod?.name || "?"} [${prod?.sku || "?"}], qty:${su.quantity}, tipo:${su.su_type}) → ${wh?.name || "?"} / ${rack?.code || "?"} F${pos?.row_number || "?"}C${pos?.column_number || "?"}`;
      }).join("; ") || "Sin datos";
    } catch {
      // Non-critical — continue without SU data
    }

    // Expiring lots
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    const { data: expiringLots } = await supabase
      .from("lot_tracking")
      .select("lot_number, expiry_date, remaining_quantity, products(name, sku)")
      .eq("status", "active")
      .lte("expiry_date", expiryDate.toISOString().split("T")[0])
      .order("expiry_date", { ascending: true })
      .limit(10);

    // Pending operations
    const { count: pendingGR } = await supabase.from("goods_receipts").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: pendingGI } = await supabase.from("goods_issues").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: pendingTO } = await supabase.from("transfer_orders").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: pendingSO } = await supabase.from("sales_orders").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed"]);

    // Recent movements
    const { data: recentMov } = await supabase.rpc("wms_get_movements", { p_org_id: "a0000000-0000-0000-0000-000000000001", p_limit: 10 });

    // Active AI insights
    const { data: activeInsights } = await supabase
      .from("wms_ai_insights")
      .select("title, severity, message")
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(5);

    moduleContext += `
## Datos de Almacenes (WMS) — Contexto en Tiempo Real
- Almacenes con detalle:
  ${occupancySummary || "N/A"}
- DATOS PARA GRAFICO (usa estos valores EXACTOS para generar charts de ocupación):
  ${chartDataJson}
- Productos catalogados: ${productCount || 0}
- Productos ejemplo: ${products?.map((p) => `${p.name} [${p.sku}] (cat: ${p.category || "—"}, min_stock: ${p.min_stock || "N/A"})`).join(", ") || "N/A"}
- Productos con stock mínimo configurado: ${lowStock?.length || 0}
- Top Unidades de Almacén (SUs): ${suSummary || "Sin datos"}
- Lotes próximos a vencer (30d): ${expiringLots?.map(l => {
      const prod = (l as unknown as { products: { name: string; sku: string } | null }).products;
      return `${l.lot_number} (${prod?.name || "?"} [${prod?.sku || "?"}], qty: ${l.remaining_quantity}, vence: ${l.expiry_date})`;
    }).join("; ") || "Ninguno"}
- Operaciones pendientes: ${pendingGR || 0} entradas, ${pendingGI || 0} salidas, ${pendingTO || 0} traspasos, ${pendingSO || 0} pedidos
- Últimos movimientos: ${(recentMov as Array<{ product_name: string; movement_type: string; quantity: number; warehouse_name: string }> || []).slice(0, 5).map(m => `${m.movement_type}: ${m.quantity} UN ${m.product_name} → ${m.warehouse_name}`).join("; ") || "N/A"}
- Alertas IA activas: ${activeInsights?.map(i => `[${i.severity}] ${i.title}: ${i.message}`).join("; ") || "Sin alertas"}
`;
  }

  if (modules.includes("finanzas") || isGeneral) {
    const { data: recentTx } = await supabase
      .from("finance_transactions")
      .select("transaction_type, category, amount_usd, currency, counterparty")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: costCenters } = await supabase
      .from("finance_cost_centers")
      .select("name, code, department, budget_annual");

    moduleContext += `
## Datos de Finanzas
- Total transacciones: ${transactionCount || 0}
- Centros de costo: ${costCenters?.map((c) => `${c.name} (${c.code})`).join(", ") || "N/A"}
- Últimas transacciones: ${recentTx?.map((t) => `${t.transaction_type} ${t.amount_usd} USD - ${t.counterparty}`).join("; ") || "N/A"}
`;
  }

  if (modules.includes("usuarios") || isGeneral) {
    const { data: roles } = await supabase
      .from("roles")
      .select("name, description");

    moduleContext += `
## Datos de Usuarios
- Total usuarios: ${userCount || 0}
- Roles del sistema: ${roles?.map((r) => r.name).join(", ") || "N/A"}
`;
  }

  if (modules.includes("compras") || isGeneral) {
    const { data: topVendors } = await supabase
      .from("vendors")
      .select("name, code, category, compliance_score, quality_score")
      .eq("is_active", true)
      .order("compliance_score", { ascending: false })
      .limit(5);

    const { data: recentPOs } = await supabase
      .from("purchase_orders")
      .select("po_number, status, total")
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: openPOCount } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "pending_approval", "approved", "sent"]);

    moduleContext += `
## Datos de Compras & Aprovisionamiento
- Total proveedores activos: ${vendorCount || 0}
- Total órdenes de compra: ${poCount || 0}
- OC abiertas: ${openPOCount || 0}
- Solicitudes de pedido: ${prCount || 0}
- Top proveedores: ${topVendors?.map((v) => `${v.name} (${v.category}, cumplimiento: ${v.compliance_score}%)`).join("; ") || "N/A"}
- Últimas OC: ${recentPOs?.map((p) => `${p.po_number} [${p.status}] $${p.total}`).join("; ") || "N/A"}
`;
  }

  if (modules.includes("flota") || isGeneral) {
    const { data: vessels } = await supabase
      .from("fleet_vessels")
      .select("name, imo_number, vessel_type, status, flag, port_of_registry, class_society")
      .limit(5);

    const { data: equipmentByStatus } = await supabase
      .from("fleet_equipment")
      .select("name, code, equipment_type, criticality, status")
      .order("criticality", { ascending: true })
      .limit(15);

    const criticalEquip = equipmentByStatus?.filter((e) => e.criticality === "critical" || e.criticality === "high") || [];

    const { data: recentWOs } = await supabase
      .from("fleet_work_orders")
      .select("wo_number, title, priority, status")
      .order("created_at", { ascending: false })
      .limit(8);

    const { count: openWOCount } = await supabase
      .from("fleet_work_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "on_hold"]);

    const { data: activeAlerts } = await supabase
      .from("fleet_alerts")
      .select("title, severity, alert_type, equipment_name, message")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: recentFuel } = await supabase
      .from("fleet_fuel_logs")
      .select("log_date, fuel_type, quantity_mt, consumption_rate_mt_day, rob_after")
      .order("log_date", { ascending: false })
      .limit(7);

    const { data: expiringCerts } = await supabase
      .from("fleet_certificates")
      .select("cert_type, cert_number, status, expiry_date, issued_by")
      .in("status", ["expiring_soon", "expired"])
      .limit(10);

    const { data: latestKPIs } = await supabase
      .from("fleet_kpi_snapshots")
      .select("snapshot_date, mtbf_hours, mttr_hours, availability_pct, reliability_pct, maintenance_cost, fuel_consumption")
      .order("snapshot_date", { ascending: false })
      .limit(3);

    const { data: crewMembers } = await supabase
      .from("fleet_crew")
      .select("name, rank, department, status")
      .eq("status", "onboard");

    const fuelWithRate = recentFuel?.filter((f) => f.consumption_rate_mt_day) || [];
    const avgConsumption = fuelWithRate.length > 0
      ? fuelWithRate.reduce((sum, f) => sum + (f.consumption_rate_mt_day || 0), 0) / fuelWithRate.length
      : 0;

    moduleContext += `
## Datos de Flota & Mantenimiento Naval
- Buques: ${vessels?.map((v) => `${v.name} (IMO: ${v.imo_number}, ${v.vessel_type}, estado: ${v.status}, bandera: ${v.flag})`).join("; ") || "N/A"}
- Total equipos registrados: ${fleetEquipmentCount || 0}
- Equipos criticos/altos: ${criticalEquip.map((e) => `${e.name} [${e.code}] (${e.criticality}, ${e.status})`).join("; ") || "N/A"}
- Total ordenes de trabajo: ${fleetWOCount || 0}
- OT abiertas: ${openWOCount || 0}
- OT recientes: ${recentWOs?.map((w) => `${w.wo_number} - ${w.title} [${w.priority}, ${w.status}]`).join("; ") || "N/A"}
- Alertas activas: ${activeAlerts?.length || 0} - ${activeAlerts?.map((a) => `${a.severity}: ${a.title} (${a.equipment_name || a.alert_type})`).join("; ") || "Sin alertas"}
- Combustible (ultimos 7 dias): consumo promedio ${avgConsumption.toFixed(1)} MT/dia, ROB: ${recentFuel?.[0]?.rob_after?.toFixed(1) || "N/A"} MT
- Certificados por vencer/vencidos: ${expiringCerts?.map((c) => `${c.cert_type} [${c.status}] vence ${c.expiry_date}`).join("; ") || "Todos vigentes"}
- Tripulacion a bordo: ${crewMembers?.length || 0} - ${crewMembers?.map((c) => `${c.name} (${c.rank}, ${c.department})`).join("; ") || "N/A"}
- KPIs recientes: ${latestKPIs?.map((k) => `${k.snapshot_date}: Disp.${k.availability_pct}%, MTBF ${k.mtbf_hours}h, MTTR ${k.mttr_hours}h, Costo $${k.maintenance_cost}`).join("; ") || "N/A"}
`;
  }

  return `Eres GRIXI AI, el asistente inteligente de la plataforma GRIXI — una plataforma enterprise SaaS multi-tenant.

Tu rol:
- Ayudar a los usuarios con TODOS los modulos de la empresa: almacenes, finanzas, compras, flota (mantenimiento naval), usuarios, administracion, dashboard
- Responder en espanol de manera profesional pero amigable
- Proporcionar insights sobre datos del sistema con la informacion real proporcionada
- Sugerir optimizaciones y mejoras basadas en los datos
- Asistir con consultas sobre cualquier aspecto de la empresa
- Cuando el modulo activo es Flota, usar terminologia maritima profesional (buque, OT, MTBF, MTTR, certificados de clase, etc.)

Datos del sistema en tiempo real:
- ${userCount || 0} usuarios en el sistema
- ${warehouseCount || 0} almacenes activos
- ${productCount || 0} productos catalogados
- ${transactionCount || 0} transacciones financieras registradas
- ${vendorCount || 0} proveedores
- ${poCount || 0} ordenes de compra
- ${fleetEquipmentCount || 0} equipos de flota registrados
- ${fleetWOCount || 0} ordenes de trabajo de flota
${moduleContext}

Modulo(s) activo(s): ${isGeneral ? "Vista general (todos los modulos)" : modules.join(", ")}

## Capacidades Especiales de Visualización

### Gráficos Interactivos (MUY IMPORTANTE)
SIEMPRE que hables de datos numéricos, ocupación, tendencias, o el usuario pida gráficos, DEBES usar este formato HTML comment EXACTO. NUNCA uses emojis como 📊 ni texto plano para representar gráficos:
<!--CHART:{"type":"bar","title":"Título","description":"Descripción","data":[{"name":"A","valor":100}],"xKey":"name","yKeys":[{"key":"valor","label":"Valor","color":"#7C3AED"}]}-->

Tipos: "bar", "line", "area", "pie"
- Para "pie": un solo yKey, xKey para etiquetas
- Usa SIEMPRE los datos reales del sistema (proporcionados arriba) cuando estén disponibles
- Colores: #7C3AED (morado), #06B6D4 (cyan), #10B981 (verde), #F59E0B (ámbar), #F43F5E (rosa), #8B5CF6 (violeta), #F97316 (naranja)
- Puedes generar MÚLTIPLES gráficos en una respuesta
- CRITICO: El formato DEBE ser exactamente <!--CHART:{json}-->  — sin espacios extra, sin saltos de linea dentro del JSON

### Navegación al Visor 3D
Cuando menciones almacenes, racks, o items específicos, incluye links de navegación para que el usuario pueda ir directamente al visor 3D:
<!--NAVIGATE:{"type":"warehouse","id":"uuid-del-almacen","label":"🏭 Ver Almacén en 3D"}-->
<!--NAVIGATE:{"type":"rack","warehouseId":"uuid","rackCode":"RA-01","label":"🗄️ Ver Rack RA-01 en 3D"}-->

- Usa los IDs reales de almacenes proporcionados en los datos
- Solo incluye links NAVIGATE cuando tengas el ID real del almacén (está en los datos como "id:...")
- Los links se renderizan como botones clicables que abren el visor 3D

### Generación de Imágenes
Cuando el usuario pida una imagen, diagrama visual, o ilustración, genera:
<!--IMAGE:descripción detallada en inglés de la imagen a generar-->

### Tablas
Usa tablas markdown estándar para datos tabulares:
| Columna 1 | Columna 2 |
|-----------|-----------|
| dato 1    | dato 2    |

## Reglas Críticas
- Siempre responde en español
- Sé conciso pero informativo
- Usa formato Markdown (listas, negritas, tablas, headers)
- Si el usuario pregunta sobre datos, responde con los datos REALES proporcionados
- Si no tienes información suficiente, sugiere dónde encontrarla en la plataforma
- No inventes datos (excepto para gráficos de ejemplo cuando no haya datos reales)
- Cuando el módulo sea "almacenes" y el usuario pregunte sobre estado general, SIEMPRE incluye un chart de ocupación y links NAVIGATE a los almacenes
- Al final de cada respuesta, genera EXACTAMENTE 3 sugerencias de seguimiento en este formato:
<!--SUGGESTIONS-->
["sugerencia 1", "sugerencia 2", "sugerencia 3"]
<!--/SUGGESTIONS-->

Las sugerencias DEBEN ser:
- Específicas al módulo activo y a los datos reales (nombres de almacenes, racks, productos reales)
- Accionables desde el chat (preguntas que tú puedes responder con datos)
- NUNCA genéricas como "Generar orden de compra" — deben ser consultas analíticas
- Ejemplos buenos para almacenes: "¿Qué racks tienen posiciones vencidas?", "Muéstrame ocupación de [nombre almacén real] en detalle", "¿Cuántas operaciones pendientes hay hoy?"`;
}

/** Generate a short title for a conversation based on the first message */
async function generateTitle(firstMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Nueva conversación";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Generate a very short title (4-6 words max) in Spanish for a conversation that starts with this message. Return ONLY the title text, nothing else:\n\n"${firstMessage}"`,
    });
    return response.text?.trim().replace(/^["']|["']$/g, "") || "Nueva conversación";
  } catch {
    return "Nueva conversación";
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI_API_KEY not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const {
    conversationId,
    message,
    module,
    modules: modulesRaw,
    attachments = [],
  } = body as {
    conversationId: string;
    message: string;
    module?: string;
    modules?: string[];
    attachments: { id: string; name: string; url: string; type: string; size: number }[];
  };

  // Support both legacy single module and new modules array
  const modules: string[] = modulesRaw || (module ? [module] : ["general"]);

  if (!conversationId || !message) {
    return Response.json({ error: "Missing conversationId or message" }, { status: 400 });
  }

  // 1. Save user message to DB
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
    attachments: JSON.stringify(attachments),
    model_used: "user",
    tokens_used: 0,
  });

  // 2. Get conversation history (last 10 messages)
  const { data: historyData } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const history: HistoryMsg[] = (historyData || []).reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 3. Build system prompt with real data
  const systemPrompt = await buildSystemPrompt(modules);

  // 4. Build full prompt
  const contextParts = history
    .slice(0, -1)
    .map(
      (msg) =>
        `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
    )
    .join("\n\n");

  let attachmentContext = "";
  if (attachments.length > 0) {
    attachmentContext = `\n\n[El usuario adjuntó ${attachments.length} archivo(s): ${attachments.map((a: { name: string; type: string }) => `${a.name} (${a.type})`).join(", ")}]`;
  }

  const fullPrompt = contextParts
    ? `${systemPrompt}\n\nHistorial de conversación reciente:\n${contextParts}\n\nUsuario: ${message}${attachmentContext}\n\nAsistente:`
    : `${systemPrompt}\n\nUsuario: ${message}${attachmentContext}\n\nAsistente:`;

  // 5. Stream from AI
  const ai = new GoogleGenAI({ apiKey });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await ai.models.generateContentStream({
          model: "gemini-3.1-flash-lite-preview",
          contents: fullPrompt,
        });

        for await (const chunk of result) {
          const text = chunk.text || "";
          if (text) {
            fullResponse += text;
            // Send as SSE event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Send done event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();

        // 6. Save complete assistant response to DB
        await supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullResponse,
          attachments: "[]",
          model_used: "default",
          tokens_used: 0,
        });

        // 7. Update conversation metadata
        const { data: convData } = await supabase
          .from("ai_conversations")
          .select("title, message_count")
          .eq("id", conversationId)
          .single();

        const updatePayload: Record<string, unknown> = {
          last_message_at: new Date().toISOString(),
          message_count: (convData?.message_count || 0) + 2,
        };

        if (!convData?.title) {
          updatePayload.title = await generateTitle(message);
        }

        await supabase
          .from("ai_conversations")
          .update(updatePayload)
          .eq("id", conversationId);
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errMsg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
