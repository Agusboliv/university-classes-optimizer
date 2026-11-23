"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filtrarFilas, ordenarFilas, tipoColumna, type Direccion, type TablaCsv } from "@/lib/csv";
import { DESCRIPCION, ENLACE_A_VISTA, ESQUEMA, type ArchivoCsv } from "@/lib/esquema";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utils";

const FILAS_POR_PAGINA = 25;

interface Orden {
  readonly indice: number;
  readonly direccion: Direccion;
}

interface TablaCsvVistaProps {
  archivo: ArchivoCsv;
  tabla: TablaCsv;
  texto: string;
}

function Celda({ columna, valor, esNumero }: { columna: string; valor: string; esNumero: boolean }) {
  const vista = ENLACE_A_VISTA[columna];
  return (
    <td className={cn("px-3 py-1.5 whitespace-nowrap", esNumero && "text-right tabular-nums")}>
      {vista ? (
        <Link
          href={`/panel?ver=${vista}&id=${encodeURIComponent(valor)}`}
          className="text-acento underline-offset-2 hover:underline"
          title={`Ver la semana de ${valor} en el panel`}
        >
          {valor}
        </Link>
      ) : (
        valor
      )}
    </td>
  );
}

/** Una tabla de entrada con su esquema, búsqueda, orden por columna, paginación y vista cruda. */
export function TablaCsvVista({ archivo, tabla, texto }: TablaCsvVistaProps) {
  const [consulta, setConsulta] = useState("");
  const [orden, setOrden] = useState<Orden | null>(null);
  const [pagina, setPagina] = useState(0);
  const [verCrudo, setVerCrudo] = useState(false);
  const consultaDiferida = useDeferredValue(consulta);

  const { columnas, filas } = tabla;
  const tipos = useMemo(() => columnas.map((_, i) => tipoColumna(filas, i)), [columnas, filas]);
  const filtradas = useMemo(() => filtrarFilas(filas, consultaDiferida), [filas, consultaDiferida]);
  const ordenadas = useMemo(
    () => (orden ? ordenarFilas(filtradas, orden.indice, orden.direccion, tipos[orden.indice]) : filtradas),
    [filtradas, orden, tipos],
  );
  const paginas = Math.max(1, Math.ceil(ordenadas.length / FILAS_POR_PAGINA));
  const actual = Math.min(pagina, paginas - 1);
  const desde = actual * FILAS_POR_PAGINA;
  const visibles = ordenadas.slice(desde, desde + FILAS_POR_PAGINA);
  const esquemaEsperado: readonly string[] = ESQUEMA[archivo];
  const coincideEsquema = columnas.length === esquemaEsperado.length && columnas.every((c, i) => c === esquemaEsperado[i]);

  const ordenarPor = (indice: number) => {
    setPagina(0);
    setOrden((o) => (o?.indice !== indice ? { indice, direccion: "asc" } : o.direccion === "asc" ? { indice, direccion: "desc" } : null));
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="etiqueta-panel">
            {archivo} · <span data-numero>{numero(filas.length)}</span> filas × <span data-numero>{columnas.length}</span> columnas
          </h2>
          <p className="mt-1 text-in-ui-sm text-tinta-2">{DESCRIPCION[archivo]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-2" aria-hidden="true" />
            <Input
              type="search"
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setPagina(0);
              }}
              aria-label={`Buscar en ${archivo}`}
              placeholder="Buscar en la tabla"
              className="w-56 pl-8"
              disabled={verCrudo}
            />
          </div>
          <Button variant="outline" aria-pressed={verCrudo} onClick={() => setVerCrudo((v) => !v)}>
            {verCrudo ? "Ver tabla" : "Ver CSV crudo"}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <p className="etiqueta-panel">Esquema</p>
        <ol className="mt-2 flex flex-wrap gap-1.5">
          {columnas.map((col, i) => (
            <li key={col} className="rounded-sm border px-2 py-1 text-in-tabla">
              {col} <span className="text-tinta-2">· {tipos[i] === "numero" ? "número" : "texto"}</span>
            </li>
          ))}
        </ol>
        {!coincideEsquema && (
          <p role="alert" className="mt-2 text-in-ui-sm text-estado-error">
            Las columnas no coinciden con el esquema esperado: {esquemaEsperado.join(", ")}.
          </p>
        )}
      </div>

      {verCrudo ? (
        <pre className="mt-5 max-h-[32rem] overflow-auto rounded-md border bg-secondary p-3 text-in-tabla tabular-nums">{texto}</pre>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-md border">
            <table className="w-full text-in-tabla">
              <caption className="sr-only">
                {archivo}: página {actual + 1} de {paginas}. Los encabezados ordenan la tabla.
              </caption>
              <thead className="bg-secondary text-tinta-2">
                <tr>
                  {columnas.map((col, i) => {
                    const activo = orden?.indice === i ? orden.direccion : null;
                    const Icono = activo === "asc" ? ArrowUp : activo === "desc" ? ArrowDown : ArrowUpDown;
                    return (
                      <th
                        key={col}
                        scope="col"
                        aria-sort={activo === "asc" ? "ascending" : activo === "desc" ? "descending" : "none"}
                        className={cn("px-1 py-1 font-medium", tipos[i] === "numero" ? "text-right" : "text-left")}
                      >
                        <button
                          type="button"
                          onClick={() => ordenarPor(i)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-sm px-2 py-1 hover:text-foreground",
                            activo && "text-foreground",
                          )}
                        >
                          {col}
                          <Icono className="size-3.5" aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibles.map((fila, j) => (
                  <tr key={`${desde + j}-${fila[0]}`} className="border-t">
                    {fila.map((valor, i) => (
                      <Celda key={columnas[i]} columna={columnas[i]} valor={valor} esNumero={tipos[i] === "numero"} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {visibles.length === 0 && (
              <p className="p-4 text-in-ui-sm text-tinta-2">Ninguna fila contiene “{consultaDiferida}”.</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-in-ui-sm text-tinta-2">
            <p aria-live="polite" data-numero>
              {ordenadas.length > 0
                ? `Filas ${numero(desde + 1)}–${numero(desde + visibles.length)} de ${numero(ordenadas.length)}`
                : "Sin filas"}
              {ordenadas.length !== filas.length && ` (filtradas de ${numero(filas.length)})`}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setPagina(actual - 1)} disabled={actual === 0}>
                <ChevronLeft aria-hidden="true" /> Anterior
              </Button>
              <span data-numero>
                {numero(actual + 1)} / {numero(paginas)}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPagina(actual + 1)} disabled={actual >= paginas - 1}>
                Siguiente <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
