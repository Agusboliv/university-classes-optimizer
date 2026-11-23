"use client";

import { useCallback, type ReactNode } from "react";

import { opcionesBarras } from "@/components/analisis/opciones";
import { Grafico } from "@/components/grafico";
import { Nota } from "@/components/nota";
import { Marco } from "@/components/panel/marco";
import type { Analisis } from "@/lib/analisis";
import type { Colores } from "@/lib/echarts";
import { numero, porcentaje } from "@/lib/formato";

/** Encabezado de un bloque del análisis (escala de instrumento, fuera de los paneles). */
export function EncabezadoBloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <h2 id={id} className="text-in-ui font-semibold">{titulo}</h2>
      <p className="mt-1 text-in-ui-sm text-tinta-2">{children}</p>
    </header>
  );
}

/** En pantallas angostas el gráfico se desplaza en horizontal en vez de aplastarse. */
export function Desplazable({ minimo = "min-w-[18rem]", children }: { minimo?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <div className={minimo}>{children}</div>
    </div>
  );
}

const fraccion = (parte: number, total: number) => porcentaje(total ? (100 * parte) / total : 0, 0);

/** Bloque 1: aulas, laboratorios y docentes sin ninguna clase, por día. */
export function BloqueCapacidad({ a }: { a: Analisis }) {
  const opcionesAulas = useCallback(
    (c: Colores) =>
      opcionesBarras({
        categorias: a.dias,
        series: [{ nombre: "Aulas sin clases", valores: a.aulasLibres, color: c.acento }],
        colores: c,
        maximo: a.totalAulas,
        tooltip: (i) => `<strong>${a.dias[i]}</strong><br/>${numero(a.aulasLibres[i])} de ${numero(a.totalAulas)} aulas sin ninguna clase (${fraccion(a.aulasLibres[i], a.totalAulas)})`,
      }),
    [a],
  );
  const opcionesLabs = useCallback(
    (c: Colores) =>
      opcionesBarras({
        categorias: a.dias,
        series: [{ nombre: "Laboratorios sin clases", valores: a.laboratoriosLibres, color: c.acento }],
        colores: c,
        maximo: a.totalLaboratorios,
        tooltip: (i) =>
          `<strong>${a.dias[i]}</strong><br/>${numero(a.laboratoriosLibres[i])} de ${numero(a.totalLaboratorios)} laboratorios sin ninguna clase (${fraccion(a.laboratoriosLibres[i], a.totalLaboratorios)})`,
      }),
    [a],
  );
  const opcionesDocentes = useCallback(
    (c: Colores) =>
      opcionesBarras({
        categorias: a.dias,
        series: [
          { nombre: "Disponibles, sin clases", valores: a.docentesLibresDisponibles, color: c.materias[0] },
          { nombre: "No disponibles", valores: a.docentesNoDisponibles, color: c.materias[1] },
        ],
        colores: c,
        apilado: true,
        tooltip: (i) =>
          [
            `<strong>${a.dias[i]}</strong>: ${numero(a.docentesLibresDisponibles[i] + a.docentesNoDisponibles[i])} de ${numero(a.totalDocentes)} docentes sin clases`,
            `Disponibles, sin clases (holgura real): ${numero(a.docentesLibresDisponibles[i])}`,
            `No disponibles ese día: ${numero(a.docentesNoDisponibles[i])}`,
          ].join("<br/>"),
      }),
    [a],
  );

  return (
    <section aria-labelledby="bloque-capacidad">
      <EncabezadoBloque id="bloque-capacidad" titulo="Capacidad ociosa por día">
        Cuánto sobra cada día: aulas, laboratorios y docentes que no tienen ninguna clase.
      </EncabezadoBloque>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Marco estatico etiqueta="Aulas sin clases" extra={<span className="text-in-ui-sm text-tinta-2" data-numero>de {numero(a.totalAulas)}</span>}>
          <Desplazable>
            <Grafico opciones={opcionesAulas} etiqueta="Aulas sin ninguna clase por día, de lunes a viernes." />
          </Desplazable>
          <Nota className="mt-3">Aula libre un día: sin ninguna clase ese día, dentro de las franjas de franjas.csv.</Nota>
        </Marco>
        <Marco estatico etiqueta="Laboratorios sin clases" extra={<span className="text-in-ui-sm text-tinta-2" data-numero>de {numero(a.totalLaboratorios)}</span>}>
          <Desplazable>
            <Grafico opciones={opcionesLabs} etiqueta="Laboratorios sin ninguna clase por día, de lunes a viernes." />
          </Desplazable>
          <Nota className="mt-3">Lo mismo que un aula libre, solo para las aulas con es_laboratorio = 1.</Nota>
        </Marco>
        <Marco estatico etiqueta="Docentes sin clases" extra={<span className="text-in-ui-sm text-tinta-2" data-numero>de {numero(a.totalDocentes)}</span>}>
          <Desplazable>
            <Grafico opciones={opcionesDocentes} etiqueta="Docentes sin clases por día, separados en disponibles y no disponibles." />
          </Desplazable>
          <Nota className="mt-3">
            Disponibles: pueden dar clase ese día según disponibilidad_profesores.csv y no tienen ninguna (holgura real).
            No disponibles: no tienen disponibilidad ese día.
          </Nota>
        </Marco>
      </div>
    </section>
  );
}
