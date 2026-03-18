import { fetchVessel } from "@/features/flota/actions/flota-actions";
import { FlotaContent } from "@/features/flota/components/flota-content";

export const metadata = {
  title: "Flota | GRIXI",
  description: "Gestión de mantenimiento de flota marítima",
};

export default async function FlotaPage() {
  const data = await fetchVessel();

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">No se encontró información de la flota</p>
      </div>
    );
  }

  return <FlotaContent data={data} />;
}
