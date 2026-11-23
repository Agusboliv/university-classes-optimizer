import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Barra de carga: solo anima opacidad, y nada con reduced-motion. */
export function Barra({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-3 rounded-sm bg-secondary motion-safe:animate-pulse", className)} />;
}

/** Encabezado editorial de una pantalla (fuera de los paneles). */
export function EncabezadoPantalla({ titulo, apoyo }: { titulo: string; apoyo?: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <h1 className="text-ed-titulo text-balance">{titulo}</h1>
      {apoyo && <p className="mt-4 text-ed-apoyo text-pretty text-tinta-2">{apoyo}</p>}
    </header>
  );
}
