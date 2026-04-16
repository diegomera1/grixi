import { Suspense } from "react";
import { fetchCustomers } from "@/features/ventas/actions/ventas-actions";
import { FichaClientePage } from "@/features/ventas/components/ficha-cliente-page";

export const metadata = {
  title: "Modo Presentación — Comercial & CRM",
};

export const dynamic = "force-dynamic";

export default async function PresentacionPage() {
  const customers = await fetchCustomers();

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      }
    >
      <FichaClientePage customers={customers} />
    </Suspense>
  );
}
