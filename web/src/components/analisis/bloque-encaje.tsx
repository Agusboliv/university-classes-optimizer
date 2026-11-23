"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useCallback, type ReactNode } from "react";

import { Desplazable, EncabezadoBloque } from "@/components/analisis/bloque-capacidad";
import { opcionesBarras } from "@/components/analisis/opciones";
import { Grafico } from "@/components/grafico";
import { Nota } from "@/components/nota";
import { Marco } from "@/components/panel/marco";
import type { Analisis } from "@/lib/analisis";
import type { Colores } from "@/lib/echarts";
import { ETIQUETAS, type TerminoDesglose } from "@/lib/escenario";
import { numero } from "@/lib/formato";

const celda = "px-2 py-1.5";
const celdaNumero = `${celda} text-right tabular-nums`;

function Tabla({ titulo, columnas, children }: { titulo: string; columnas: readonly (readonly [string, boolean])[]; children: ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-in-tabla">
        <caption className="sr-only">{titulo}</caption>
        <thead className="text-tinta-2">
          <tr className="border-b">
            {columnas.map(([c, esNumero]) => (
              <th key={c} scope="col" className={`${celda} font-medium ${esNumero ? "text-right" : "text-left"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** B1–B6 de esta solución (evaluador TS) y si coinciden con el desglose del solver (JSON). */
function Consistencia({ desglose, solver }: { desglose: readonly TerminoDesglose[]; solver: readonly TerminoDesglose[] }) {
  const coinciden = desglose.every((t, i) => t.valor === solver[i]?.valor);
  return (
    <div className="mt-4 rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-in-ui-sm">
        {coinciden ? (
          <><CircleCheck className="size-4 text-estado-ok" aria-hidden="true" /> B1–B6 coinciden con el desglose del solver</>
        ) : (
          <><CircleAlert className="size-4 text-estado-error" aria-hidden="true" /> B1–B6 no coinciden con el desglose del solver</>
        )}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {desglose.map((t) => (
          <div key={t.id}>
            <dt className="text-in-tabla text-tinta-2">{t.id} {ETIQUETAS[t.id].nombre}</dt>
            <dd className="mt-0.5 text-in-ui font-semibold tabular-nums">
              {numero(t.valor)} <span className="text-in-tabla font-normal text-tinta-2">{ETIQUETAS[t.id].unidad}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const etiquetaDias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** Bloque 3: calidad del encaje, ligada a B1–B6 (asientos, huecos, días y rachas, laboratorios). */
export function BloqueEncaje({ a, solver }: { a: Analisis; solver: readonly TerminoDesglose[] }) {
  const valor = (id: string) => a.desglose.find((t) => t.id === id)?.valor ?? 0;
  // Barras de "días de trabajo": se omite el 0 si ningún docente queda sin clases
  const desdeDias = a.docentesPorDias[0] === 0 ? 1 : 0;
  const diasCategorias = a.docentesPorDias.slice(desdeDias).map((_, i) => etiquetaDias(i + desdeDias));

  const opcionesAsientos = useCallback(
    (c: Colores) =>
      opcionesBarras({
        categorias: a.dias,
        series: [{ nombre: "Asientos vacíos (asiento·slot)", valores: a.asientosPorDia, color: c.acento }],
        colores: c,
        tooltip: (i) => `<strong>${a.dias[i]}</strong><br/>${numero(a.asientosPorDia[i])} asiento·slot vacíos (B1)`,
      }),
    [a],
  );
  const opcionesHuecos = useCallback(
    (c: Colores) =>
      opcionesBarras({
        categorias: a.dias,
        series: [{ nombre: "Huecos de cohorte (slots)", valores: a.huecosPorDia, color: c.acento }],
        colores: c,
        tooltip: (i) => `<strong>${a.dias[i]}</strong><br/>${numero(a.huecosPorDia[i])} slots de hueco (${numero(a.huecosPorDia[i] / 2, 1)} h) (B2)`,
      }),
    [a],
  );
  const opcionesDias = useCallback(
    (c: Colores) =>
      opcionesBarras({
        categorias: diasCategorias,
        series: [{ nombre: "Docentes", valores: a.docentesPorDias.slice(desdeDias), color: c.acento }],
        colores: c,
        tooltip: (i) => `<strong>${diasCategorias[i]} de clase</strong><br/>${numero(a.docentesPorDias[i + desdeDias])} docentes`,
      }),
    [a, desdeDias, diasCategorias],
  );

  return (
    <section aria-labelledby="bloque-encaje">
      <EncabezadoBloque id="bloque-encaje" titulo="Calidad del encaje">
        Dónde se podría reorganizar: cada panel corresponde a una penalización del objetivo (B1–B6).
      </EncabezadoBloque>
      <Consistencia desglose={a.desglose} solver={solver} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Marco estatico etiqueta="Asientos vacíos por día · B1">
          <Desplazable>
            <Grafico opciones={opcionesAsientos} etiqueta="Asientos vacíos por día, en asiento por slot." />
          </Desplazable>
          <Tabla
            titulo="Las 10 clases con más asientos vacíos"
            columnas={[["Clase", false], ["Materia", false], ["Aula", false], ["Día", false], ["Capacidad", true], ["Alumnos", true], ["Vacíos", true]]}
          >
            {a.topAsientos.map((f) => (
              <tr key={f.clase} className="border-b last:border-b-0">
                <td className={celda}>{f.clase}</td>
                <td className={`${celda} max-w-40 truncate`}>{f.materia}</td>
                <td className={celda}>{f.aula}</td>
                <td className={`${celda} tabular-nums`}>{f.dia} {f.inicio}</td>
                <td className={celdaNumero}>{numero(f.capacidad)}</td>
                <td className={celdaNumero}>{numero(f.alumnos)}</td>
                <td className={`${celdaNumero} font-semibold`}>{numero(f.vacios)}</td>
              </tr>
            ))}
          </Tabla>
          <Nota className="mt-3">B1 suma asientos vacíos × slots de 30 min de cada clase. La tabla ordena por asientos vacíos.</Nota>
        </Marco>

        <Marco estatico etiqueta="Huecos de cohorte por día · B2">
          <Desplazable>
            <Grafico opciones={opcionesHuecos} etiqueta="Huecos de cohorte por día, en slots de 30 minutos." />
          </Desplazable>
          <Tabla titulo="Cohortes con más huecos" columnas={[["Cohorte", false], ["Huecos (slots)", true], ["Horas", true]]}>
            {a.topCohortes.map((c) => (
              <tr key={c.cohorte} className="border-b last:border-b-0">
                <td className={celda}>{c.cohorte}</td>
                <td className={`${celdaNumero} font-semibold`}>{numero(c.huecos)}</td>
                <td className={celdaNumero}>{numero(c.huecos / 2, 1)}</td>
              </tr>
            ))}
          </Tabla>
          <Nota className="mt-3">Hueco: slot sin clase entre la primera y la última clase del día de una cohorte (el corte entre franjas no cuenta).</Nota>
        </Marco>

        <Marco estatico etiqueta="Días de trabajo por docente · B4 y B3">
          <Desplazable>
            <Grafico opciones={opcionesDias} etiqueta="Cantidad de docentes según los días de la semana en que dan clase." />
          </Desplazable>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-in-ui-sm">
            <div>
              <dt className="text-tinta-2">Días extra (B4)</dt>
              <dd className="mt-1 text-in-ui font-semibold tabular-nums">{numero(valor("B4"))}</dd>
            </div>
            <div>
              <dt className="text-tinta-2">Docentes con más de 360 min seguidos (B3)</dt>
              <dd className="mt-1 text-in-ui font-semibold tabular-nums">
                {numero(a.docentesConRacha)} <span className="text-in-tabla font-normal text-tinta-2">· {numero(valor("B3"))} slots de exceso</span>
              </dd>
            </div>
          </dl>
          <Nota className="mt-3">
            B4: días con clase por encima del mínimo necesario de cada docente (minutos totales / tope diario). B3: algún
            día con más de 360 minutos de clase seguidos.
          </Nota>
        </Marco>

        <Marco estatico etiqueta="Laboratorios usados sin necesitarlos · B5">
          {a.laboratoriosSinNecesidad.length === 0 ? (
            <p className="text-in-ui-sm text-tinta-2">Ninguna clase usa un laboratorio sin necesitarlo.</p>
          ) : (
            <Tabla
              titulo="Clases sin requisito de laboratorio ubicadas en un laboratorio"
              columnas={[["Clase", false], ["Materia", false], ["Laboratorio", false], ["Horario", false], ["Slots", true]]}
            >
              {a.laboratoriosSinNecesidad.map((l) => (
                <tr key={l.clase} className="border-b last:border-b-0">
                  <td className={celda}>{l.clase}</td>
                  <td className={`${celda} max-w-48 truncate`}>{l.materia}</td>
                  <td className={celda}>{l.aula}</td>
                  <td className={`${celda} tabular-nums`}>{l.dia} {l.inicio}–{l.fin}</td>
                  <td className={celdaNumero}>{numero(l.slots)}</td>
                </tr>
              ))}
            </Tabla>
          )}
          <Nota className="mt-3">
            {numero(a.laboratoriosSinNecesidad.length)} clases sin requisito de laboratorio ocupan uno ({numero(valor("B5"))} slots).
            Liberarlos deja lugar a las clases que sí lo necesitan.
          </Nota>
        </Marco>
      </div>
    </section>
  );
}
