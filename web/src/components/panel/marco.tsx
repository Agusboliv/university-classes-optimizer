import type { ReactNode } from "react";

import { PanelInteractivo } from "@/components/entrada";
import { cn } from "@/lib/utils";

interface MarcoProps {
  etiqueta: string;
  /** Contenido a la derecha de la etiqueta (escala de instrumento). */
  extra?: ReactNode;
  className?: string;
  /** Sin elevación en hover (paneles grandes con mucha interacción, como la grilla). */
  estatico?: boolean;
  children: ReactNode;
}

/** Panel de instrumento: etiqueta en mayúsculas arriba y contenido debajo. */
export function Marco({ etiqueta, extra, className, estatico = false, children }: MarcoProps) {
  const contenido = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="etiqueta-panel">{etiqueta}</h2>
        {extra}
      </div>
      <div className="mt-4">{children}</div>
    </>
  );
  const clases = cn("h-full rounded-lg border bg-card p-5", className);
  if (estatico) return <section className={clases}>{contenido}</section>;
  return <PanelInteractivo className={clases}>{contenido}</PanelInteractivo>;
}
