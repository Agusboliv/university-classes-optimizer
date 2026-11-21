import type { ReactNode } from "react";

import { PanelInteractivo } from "@/components/entrada";
import { cn } from "@/lib/utils";

interface MarcoProps {
  etiqueta: string;
  /** Contenido a la derecha de la etiqueta (escala de instrumento). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Panel de instrumento: etiqueta en mayúsculas arriba y contenido debajo. */
export function Marco({ etiqueta, extra, className, children }: MarcoProps) {
  return (
    <PanelInteractivo className={cn("h-full rounded-lg border bg-card p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="etiqueta-panel">{etiqueta}</h2>
        {extra}
      </div>
      <div className="mt-4">{children}</div>
    </PanelInteractivo>
  );
}
