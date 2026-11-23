"use client";

import { CircleAlert } from "lucide-react";
import { startTransition, useEffect, useRef, useState, ViewTransition, type KeyboardEvent } from "react";

import { TablaHead } from "@/components/datos/tabla-csv";
import { Barra } from "@/components/esqueleto";
import { parsearCsv, type TablaCsv } from "@/lib/csv";
import { ARCHIVOS, type ArchivoCsv } from "@/lib/esquema";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** Lo que genera scripts/copiar-datos.mjs en public/data/manifest.json, por tabla. */
interface InfoTabla {
  readonly columnas: readonly string[];
  readonly filas: number;
}
type Manifest = Readonly<Record<ArchivoCsv, InfoTabla>>;

type Estado<T> = { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "listo"; valor: T };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : "error desconocido");
/** aulas.csv -> /data/aulas.head.csv (encabezado + 10 filas, ver copiar-datos.mjs). */
const urlHead = (archivo: ArchivoCsv) => `/data/${archivo.replace(/\.csv$/, ".head.csv")}`;

function validarManifest(datos: unknown): Manifest {
  if (!esObjeto(datos)) throw new Error("el manifest no es un objeto JSON");
  for (const archivo of ARCHIVOS) {
    const info = datos[archivo];
    if (!esObjeto(info) || !Array.isArray(info.columnas) || typeof info.filas !== "number") {
      throw new Error(`el manifest no describe ${archivo}`);
    }
  }
  return datos as unknown as Manifest;
}

async function leerTexto(url: string, signal?: AbortSignal): Promise<string> {
  const respuesta = await fetch(url, { signal });
  if (!respuesta.ok) throw new Error(`no se pudo leer ${url} (HTTP ${respuesta.status})`);
  return respuesta.text();
}

/**
 * Vista previa de las tablas de entrada: una pestaña por archivo (patrón ARIA de pestañas).
 * Solo lee el manifest y, al abrir cada pestaña, su .head.csv; nunca los CSV completos.
 */
export function ExploradorDatos() {
  const [manifest, setManifest] = useState<Estado<Manifest>>({ tipo: "cargando" });
  const [heads, setHeads] = useState<Partial<Record<ArchivoCsv, Estado<TablaCsv>>>>({});
  const [archivo, setArchivo] = useState<ArchivoCsv>(ARCHIVOS[0]);
  const pedidos = useRef(new Set<ArchivoCsv>());
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const control = new AbortController();
    leerTexto("/data/manifest.json", control.signal)
      .then((texto) => setManifest({ tipo: "listo", valor: validarManifest(JSON.parse(texto)) }))
      .catch((e: unknown) => {
        if (!control.signal.aborted) setManifest({ tipo: "error", mensaje: mensajeDe(e) });
      });
    return () => control.abort();
  }, []);

  // Cada pestaña pide su head la primera vez que se abre (después queda en memoria)
  useEffect(() => {
    if (pedidos.current.has(archivo)) return;
    pedidos.current.add(archivo);
    leerTexto(urlHead(archivo))
      .then((texto) => setHeads((h) => ({ ...h, [archivo]: { tipo: "listo", valor: parsearCsv(texto) } })))
      .catch((e: unknown) => {
        pedidos.current.delete(archivo);
        setHeads((h) => ({ ...h, [archivo]: { tipo: "error", mensaje: mensajeDe(e) } }));
      });
  }, [archivo]);

  const elegir = (nombre: ArchivoCsv) => startTransition(() => setArchivo(nombre));

  const moverConTeclado = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ARCHIVOS.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const j = (destino + ARCHIVOS.length) % ARCHIVOS.length;
    pestanas.current[j]?.focus();
    elegir(ARCHIVOS[j]);
  };

  const head = heads[archivo] ?? { tipo: "cargando" };
  const error = manifest.tipo === "error" ? manifest.mensaje : head.tipo === "error" ? head.mensaje : null;

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
            {manifest.tipo === "listo" && (
              <span className="text-in-tabla text-tinta-2 tabular-nums">{numero(manifest.valor[nombre].filas)}</span>
            )}
          </button>
        ))}
      </div>

      <div id="panel-archivo" role="tabpanel" aria-labelledby={`pestana-${ARCHIVOS.indexOf(archivo)}`} className="p-5">
        {error ? (
          <p role="alert" className="flex gap-2 text-in-ui">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-estado-error" aria-hidden="true" />
            <span>
              {error}. Volvé a correr <code>npm run dev</code> o <code>npm run build</code> (generan las vistas previas).
            </span>
          </p>
        ) : manifest.tipo === "listo" && head.tipo === "listo" ? (
          <ViewTransition key={archivo} enter="grilla-entra" exit="grilla-sale" default="none">
            <TablaHead archivo={archivo} tabla={head.valor} total={manifest.valor[archivo].filas} />
          </ViewTransition>
        ) : (
          <div className="space-y-2" aria-busy="true">
            <Barra className="h-6 w-64" />
            {Array.from({ length: 8 }, (_, i) => (
              <Barra key={i} className="h-4" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
