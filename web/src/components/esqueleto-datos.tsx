"use client";

import { useState } from "react";

import { Barra } from "@/components/esqueleto";
import { ARCHIVOS, ESQUEMA, type ArchivoCsv } from "@/lib/esquema";
import { cn } from "@/lib/utils";

/** Pestañas por archivo con su esquema. Las filas llegan con el explorador de tablas. */
export function EsqueletoDatos() {
  const [archivo, setArchivo] = useState<ArchivoCsv>(ARCHIVOS[0]);
  const columnas = ESQUEMA[archivo];

  return (
    <section className="rounded-lg border bg-card">
      <div role="tablist" aria-label="Archivos de entrada" className="flex gap-1 overflow-x-auto border-b p-2">
        {ARCHIVOS.map((nombre) => (
          <button
            key={nombre}
            role="tab"
            aria-selected={nombre === archivo}
            onClick={() => setArchivo(nombre)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-in-ui-sm text-tinta-2 transition-colors hover:text-foreground",
              "aria-selected:bg-secondary aria-selected:text-foreground",
            )}
          >
            {nombre}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={archivo} className="p-5">
        <h2 className="etiqueta-panel">
          Esquema · <span data-numero>{columnas.length}</span> columnas
        </h2>
        <ol className="mt-3 flex flex-wrap gap-2">
          {columnas.map((col) => (
            <li key={col} className="rounded-sm border px-2 py-1 text-in-tabla">
              {col}
            </li>
          ))}
        </ol>

        <div className="mt-6 space-y-2" aria-busy="true">
          <Barra className="h-6" />
          {Array.from({ length: 8 }, (_, i) => (
            <Barra key={i} className="h-4" />
          ))}
        </div>
      </div>
    </section>
  );
}
