import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

// Ephemeral token API route for secure Live API access
// The GEMINI_API_KEY never reaches the client — only the ephemeral token does
export async function POST() {
  try {
    // Verify user is authenticated
    const supabase = await createClient();

    let userId: string | undefined;
    let userMeta: Record<string, string> | undefined;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      userMeta = user.user_metadata as Record<string, string>;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        userMeta = session.user.user_metadata as Record<string, string>;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get user info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, department, position")
      .eq("id", userId)
      .single();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    // Create ephemeral token
    const client = new GoogleGenAI({ apiKey });
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    // Gather real data for voice context
    const [
      { count: totalProducts },
      { count: openPOs },
      { count: activeUsers },
      { data: warehouses },
      { data: incomeData },
      { data: expenseData },
      { count: fleetEquipmentCount },
      { count: fleetWOCount },
      { data: activeAlerts },
      { data: recentFuel },
    ] = await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("purchase_orders").select("*", { count: "exact", head: true }).not("status", "in", '("closed","cancelled")'),
      supabase.from("active_sessions").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("warehouses").select("id, name"),
      supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "income").gte("posting_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "expense").gte("posting_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from("fleet_equipment").select("*", { count: "exact", head: true }),
      supabase.from("fleet_work_orders").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "on_hold"]),
      supabase.from("fleet_alerts").select("title, severity").is("resolved_at", null).limit(5),
      supabase.from("fleet_fuel_logs").select("consumption_rate_mt_day, rob_after").order("log_date", { ascending: false }).limit(3),
    ]);

    const revenue = (incomeData || []).reduce((s, t) => s + Number(t.amount_usd || 0), 0);
    const expenses = (expenseData || []).reduce((s, t) => s + Math.abs(Number(t.amount_usd || 0)), 0);
    const fuelRates = (recentFuel || []).filter((f) => f.consumption_rate_mt_day);
    const avgFuelConsumption = fuelRates.length > 0
      ? fuelRates.reduce((s, f) => s + (f.consumption_rate_mt_day || 0), 0) / fuelRates.length
      : 0;

    const dataContext = `
DATOS ACTUALES DEL SISTEMA:
- Productos totales: ${totalProducts || 0}
- OC abiertas: ${openPOs || 0}
- Usuarios activos: ${activeUsers || 0}
- Almacenes: ${(warehouses || []).map(w => w.name).join(", ") || "ninguno"}
- Revenue mensual: $${revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
- Gastos mensuales: $${expenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
- Equipos de flota: ${fleetEquipmentCount || 0}
- OT de flota abiertas: ${fleetWOCount || 0}
- Alertas flota activas: ${activeAlerts?.length || 0}${activeAlerts?.length ? " - " + activeAlerts.map((a) => `${a.severity}: ${a.title}`).join("; ") : ""}
- Consumo combustible promedio: ${avgFuelConsumption.toFixed(1)} MT/dia, ROB: ${recentFuel?.[0]?.rob_after?.toFixed(1) || "N/A"} MT
`;

    return NextResponse.json({
      token: token.name,
      userName: profile?.full_name || userMeta?.full_name || "Usuario",
      userDepartment: profile?.department || "General",
      userPosition: profile?.position || "Operador",
      dataContext,
    });
  } catch (error) {
    console.error("[ephemeral-token] Error:", error);
    return NextResponse.json(
      { error: "Error al generar token de voz" },
      { status: 500 }
    );
  }
}
