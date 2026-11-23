"use client";

import { CircleAlert } from "lucide-react";
import { startTransition, useEffect, useRef, useState, ViewTransition, type KeyboardEvent } from "react";

import { TablaCsvVista } from "@/components/datos/tabla-csv";
import { Barra } from "@/components/esqueleto";
import { parsearCsv, type TablaCsv } from "@/lib/csv";
import { ARCHIVOS, type ArchivoCsv } from "@/lib/esquema";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Archivo {
  readonly tabla: TablaCsv;
  readonly texto: string;
}

type EstadoCarga =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; archivos: Readonly<Record<ArchivoCsv, Archivo>> };

/** Lee los 5 CSV (copiados a public/data por scripts/copiar-datos.mjs). Son chicos: se parsean acá. */
async function cargarArchivos(signal: AbortSignal): Promise<Record<ArchivoCsv, Archivo>> {
  const pares = await Promise.all(
    ARCHIVOS.map(async (nombre) => {
      const respuesta = await fetch(`/data/${nombre}`, { signal });
      if (!respuesta.ok) throw new Error(`no se pudo leer ${nombre} (HTTP ${respuesta.status})`);
      const texto = await respuesta.text();
      return [nombre, { tabla: parsearCsv(texto), texto }] as const;
    }),
  );
  return Object.fromEntries(pares) as Record<ArchivoCsv, Archivo>;
}

function useArchivos(): EstadoCarga {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: "cargando" });
  useEffect(() => {
    const control = new AbortController();
    cargarArchivos(control.signal)
      .then((archivos) => setEstado({ tipo: "listo", archivos }))
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        setEstado({ tipo: "error", mensaje: error instanceof Error ? error.message : "error desconocido" });
      });
    return () => control.abort();
  }, []);
  return estado;
}

/** Explorador de las tablas de entrada: una pestaña por archivo (patrón ARIA de pestañas). */
export function ExploradorDatos() {
  const estado = useArchivos();
  const [archivo, setArchivo] = useState<ArchivoCsv>(ARCHIVOS[0]);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);

  const elegir = (nombre: ArchivoCsv) => startTransition(() => setArchivo(nombre));

  const moverConTeclado = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ARCHIVOS.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const j = (destino + ARCHIVOS.length) % ARCHIVOS.length;
    pestanas.current[j]?.focus();
    elegir(ARCHIVOS[j]);
  };

  return (
    <section className="rounded-lg border bg-card">
      <div role="tablist" aria-label="Archivos de entrada" className="flex gap-1 overflow-x-auto border-b p-2">
        {ARCHIVOS.map((nombre, i) => (
          <button
            key={nombre}
            ref={(el) => {
              pestanas.current[i] = el;
            }}
            id={`pestana-${i}`}
            role="tab"
            aria-selected={nombre === archivo}
            aria-controls="panel-archivo"
            tabIndex={nombre === archivo ? 0 : -1}
            onClick={() => elegir(nombre)}
            onKeyDown={(e) => moverConTeclado(e, i)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-in-ui-sm text-tinta-2 transition-colors hover:text-foreground",
              "aria-selected:bg-secondary aria-selected:text-foreground",
            )}
          >
            {nombre}
            {estado.tipo === "listo" && (
              <span className="text-in-tabla text-tinta-2 tabular-nums">{numero(estado.archivos[nombre].tabla.filas.length)}</span>
            )}
          </button>
        ))}
      </div>

      <div id="panel-archivo" role="tabpanel" aria-labelledby={`pestana-${ARCHIVOS.indexOf(archivo)}`} className="p-5">
        {estado.tipo === "cargando" && (
          <div className="space-y-2" aria-busy="true">
            <Barra className="h-6 w-64" />
            {Array.from({ length: 8 }, (_, i) => (
              <Barra key={i} className="h-4" />
            ))}
          </div>
        )}
        {estado.tipo === "error" && (
          <p role="alert" className="flex gap-2 text-in-ui">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-estado-error" aria-hidden="true" />
            <span>
              {estado.mensaje}. Revisá que estén los CSV en <code>data/</code> y volvé a correr <code>npm run dev</code> o{" "}
              <code>npm run build</code>.
            </span>
          </p>
        )}
        {estado.tipo === "listo" && (
          <ViewTransition key={archivo} enter="grilla-entra" exit="grilla-sale" default="none">
            <TablaCsvVista archivo={archivo} tabla={estado.archivos[archivo].tabla} texto={estado.archivos[archivo].texto} />
          </ViewTransition>
        )}
      </div>
    </section>
  );
}
