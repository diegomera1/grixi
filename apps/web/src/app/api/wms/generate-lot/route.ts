import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/wms/generate-lot?count=N
 * Generates N sequential lot numbers using wms_generate_lot_number RPC.
 * Returns: { success: true, lots: ["LOT-20260406-001", ...] }
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    // Get org_id
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();
    if (!member) return NextResponse.json({ success: false, message: "No org found" }, { status: 403 });

    const url = new URL(request.url);
    const count = Math.min(Math.max(1, Number(url.searchParams.get("count") || "1")), 20);

    const lots: string[] = [];
    for (let i = 0; i < count; i++) {
      const { data, error } = await supabase.rpc("wms_generate_lot_number", { p_org_id: member.org_id });
      if (error) throw error;
      lots.push(data as string);
    }

    return NextResponse.json({ success: true, lots });
  } catch (err) {
    console.error("[generate-lot] Error:", err);
    return NextResponse.json({ success: false, message: "Error generating lot numbers" }, { status: 500 });
  }
}
