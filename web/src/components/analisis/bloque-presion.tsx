"use client";

import { useCallback, useMemo, useState } from "react";

import { Desplazable, EncabezadoBloque } from "@/components/analisis/bloque-capacidad";
import { opcionesMapaCalor } from "@/components/analisis/opciones";
import { Grafico } from "@/components/grafico";
import { Nota } from "@/components/nota";
import { Marco } from "@/components/panel/marco";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Analisis } from "@/lib/analisis";
import type { Colores } from "@/lib/echarts";
import { numero, porcentaje } from "@/lib/formato";
import { aHhmm } from "@/lib/modelo";

type Modo = "ocupadas" | "libres";

interface Celda {
  readonly dia: string;
  readonly hora: number;
  readonly ocupadas: number;
}

/** Bloque 2: mapa de calor día × hora con el % de aulas ocupadas (o la cantidad de aulas libres). */
export function BloquePresion({ a }: { a: Analisis }) {
  const [modo, setModo] = useState<Modo>("ocupadas");
  const total = a.totalAulas;
  const horaTexto = (h: number) => `${aHhmm(h)}–${aHhmm(h + 60)}`;

  const valores = useMemo(
    () => a.aulasOcupadas.map((fila) =>
      fila.map((v) => (v === null ? null : modo === "ocupadas" ? Math.round((1000 * v) / total) / 10 : total - v))),
    [a, modo, total],
  );

  // Escala de 0 al máximo observado (redondeado a la decena): con 0–100 % todo quedaba pálido
  const maximoEscala = useMemo(() => {
    const mayor = Math.max(0, ...valores.flat().filter((v): v is number => v !== null));
    return Math.max(10, Math.ceil(mayor / 10) * 10);
  }, [valores]);

  // Hora pico y hora más tranquila (dentro de las franjas)
  const [pico, valle] = useMemo(() => {
    const celdas: Celda[] = a.aulasOcupadas.flatMap((fila, y) =>
      fila.flatMap((v, x) => (v === null ? [] : [{ dia: a.dias[y], hora: a.horas[x], ocupadas: v }])));
    const orden = [...celdas].sort((p, q) => q.ocupadas - p.ocupadas);
    return [orden[0], orden[orden.length - 1]];
  }, [a]);

  const opciones = useCallback(
    (c: Colores) =>
      opcionesMapaCalor({
        filas: a.dias,
        columnas: a.horas.map((h) => aHhmm(h).slice(0, 2)),
        valores,
        maximo: maximoEscala,
        sufijo: modo === "ocupadas" ? " %" : " aulas",
        colores: c,
        descripcion: `Mapa de calor por día y hora: ${modo === "ocupadas" ? "porcentaje de aulas ocupadas" : "aulas libres"}. Pico: ${pico ? `${pico.dia} ${horaTexto(pico.hora)}, ${numero(pico.ocupadas)} aulas ocupadas` : "sin datos"}.`,
        tooltip: (y, x) => {
          const ocupadas = a.aulasOcupadas[y][x];
          const titulo = `<strong>${a.dias[y]} · ${horaTexto(a.horas[x])}</strong>`;
          if (ocupadas === null) return `${titulo}<br/>Fuera de las franjas`;
          return [
            titulo,
            `${numero(ocupadas)} de ${numero(total)} aulas ocupadas (${porcentaje((100 * ocupadas) / total, 0)})`,
            `${numero(total - ocupadas)} aulas libres`,
          ].join("<br/>");
        },
      }),
    [a, valores, modo, total, pico, maximoEscala],
  );

  return (
    <section aria-labelledby="bloque-presion">
      <EncabezadoBloque id="bloque-presion" titulo="Presión horaria">
        Cuándo se llenan las aulas: los momentos con poca holgura son los más difíciles de reorganizar.
      </EncabezadoBloque>
      <div className="mt-4">
        <Marco
          estatico
          etiqueta={modo === "ocupadas" ? "Aulas ocupadas por día y hora (%)" : "Aulas libres por día y hora"}
          extra={
            <ToggleGroup
              size="sm"
              variant="outline"
              value={[modo]}
              onValueChange={(v: string[]) => (v[0] === "ocupadas" || v[0] === "libres") && setModo(v[0])}
              aria-label="Qué mostrar en el mapa de calor"
            >
              <ToggleGroupItem value="ocupadas">% ocupadas</ToggleGroupItem>
              <ToggleGroupItem value="libres">Aulas libres</ToggleGroupItem>
            </ToggleGroup>
          }
        >
          {pico && valle && (
            <dl className="mb-4 grid gap-4 text-in-ui-sm sm:grid-cols-2">
              <div>
                <dt className="text-tinta-2">Hora pico</dt>
                <dd className="mt-1 tabular-nums">
                  <span className="font-semibold">{pico.dia} {horaTexto(pico.hora)}</span> · {numero(pico.ocupadas)} de{" "}
                  {numero(total)} aulas ({porcentaje((100 * pico.ocupadas) / total, 0)})
                </dd>
              </div>
              <div>
                <dt className="text-tinta-2">Hora más tranquila</dt>
                <dd className="mt-1 tabular-nums">
                  <span className="font-semibold">{valle.dia} {horaTexto(valle.hora)}</span> · {numero(valle.ocupadas)} de{" "}
                  {numero(total)} aulas ({porcentaje((100 * valle.ocupadas) / total, 0)})
                </dd>
              </div>
            </dl>
          )}
          <Desplazable minimo="min-w-[40rem]">
            <Grafico opciones={opciones} className="h-72" etiqueta="Mapa de calor de aulas ocupadas por día y hora." />
          </Desplazable>
          <Nota className="mt-3">
            Un aula cuenta como ocupada en una hora si tiene clase en algún momento de esa hora. Las celdas vacías
            quedan fuera de las franjas de franjas.csv (por ejemplo, el corte de 13 a 14).
          </Nota>
        </Marco>
      </div>
    </section>
  );
}
