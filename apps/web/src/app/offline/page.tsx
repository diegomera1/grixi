"use client";

import Image from "next/image";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] px-6 text-center">
      {/* Logo */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-2xl bg-[var(--brand)] opacity-10 blur-2xl scale-150" />
        <Image
          src="/brand/icon-192.png"
          alt="GRIXI"
          width={72}
          height={72}
          className="relative rounded-2xl"
          priority
        />
      </div>

      {/* Title */}
      <h1 className="font-serif text-xl font-semibold italic text-[var(--text-primary)] mb-2">
        Sin conexión
      </h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-8 leading-relaxed">
        No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo.
      </p>

      {/* Retry button */}
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-[var(--brand)] px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-[var(--brand)]/20 transition-all hover:opacity-90 active:scale-95"
      >
        Reintentar
      </button>

      {/* Back to dashboard */}
      <Link
        href="/dashboard"
        className="mt-4 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        Volver al dashboard
      </Link>

      {/* Brand footer */}
      <p className="absolute bottom-8 text-[10px] text-[var(--text-muted)]">
        GRIXI — La interconexión inteligente
      </p>
    </div>
  );
}
