import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  // Check auth state
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  // Try a simple count
  const { count, error: countError } = await supabase
    .from("purchase_orders")
    .select("*", { count: "exact", head: true });

  // Try vendors
  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select("id, name")
    .limit(3);

  return NextResponse.json({
    auth: {
      userId: user?.id || null,
      email: user?.email || null,
      authError: authError?.message || null,
    },
    purchaseOrders: {
      count,
      countError: countError?.message || null,
    },
    vendors: {
      data: vendors,
      error: vendorsError?.message || null,
    },
  });
}
