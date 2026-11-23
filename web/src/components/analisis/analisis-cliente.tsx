"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { BloqueCapacidad } from "@/components/analisis/bloque-capacidad";
import { BloqueEncaje } from "@/components/analisis/bloque-encaje";
import { BloquePresion } from "@/components/analisis/bloque-presion";
import { Entrada } from "@/components/entrada";
import { Barra } from "@/components/esqueleto";
import { Nota } from "@/components/nota";
import { analizar, solucionDesdeCsv, type Analisis } from "@/lib/analisis";
import { cargarCsvs, parsearCsv } from "@/lib/csv";
import { cargarEscenario, type TerminoDesglose } from "@/lib/escenario";
import { numero } from "@/lib/formato";
import { maximosDe, prepararDatos, type TablasEntrada } from "@/lib/modelo";

/** CSV de la solución: misma corrida que referencia.json (copiado a public/data por copiar-datos.mjs). */
const SOLUCION = "/data/referencia.csv";

interface Resultado {
  readonly analisis: Analisis;
  readonly desgloseSolver: readonly TerminoDesglose[];
}

type EstadoCarga = { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "listo"; resultado: Resultado };

async function cargar(signal: AbortSignal): Promise<Resultado> {
  const [archivos, escenario, textoSolucion] = await Promise.all([
    cargarCsvs(signal),
    cargarEscenario("referencia", signal),
    fetch(SOLUCION, { signal }).then((r) => {
      if (!r.ok) throw new Error(`no se pudo leer ${SOLUCION} (HTTP ${r.status})`);
      return r.text();
    }),
  ]);
  const tablas = Object.fromEntries(Object.entries(archivos).map(([n, a]) => [n, a.tabla])) as TablasEntrada;
  const datos = prepararDatos(tablas);
  const solucion = solucionDesdeCsv(parsearCsv(textoSolucion), datos);
  return { analisis: analizar(datos, solucion, maximosDe(escenario.desglose)), desgloseSolver: escenario.desglose };
}

/** Carga los datos y arma los tres bloques del análisis (solución base, sin ediciones manuales). */
export function AnalisisCliente() {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: "cargando" });
  useEffect(() => {
    const control = new AbortController();
    cargar(control.signal)
      .then((resultado) => setEstado({ tipo: "listo", resultado }))
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        setEstado({ tipo: "error", mensaje: error instanceof Error ? error.message : "error desconocido" });
      });
    return () => control.abort();
  }, []);

  if (estado.tipo === "cargando") {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <Barra key={i} className="h-72" />
        ))}
      </div>
    );
  }
  if (estado.tipo === "error") {
    return (
      <p role="alert" className="flex gap-2 rounded-lg border bg-card p-5 text-in-ui">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-estado-error" aria-hidden="true" />
        <span>
          {estado.mensaje}. Revisá que existan los CSV en <code>data/</code> y <code>data/escenarios/referencia.csv</code>
          (se genera con <code>generar_escenario --desde-json … --csv</code>) y volvé a correr <code>npm run dev</code> o{" "}
          <code>npm run build</code>.
        </span>
      </p>
    );
  }

  const { analisis: a, desgloseSolver } = estado.resultado;
  return (
    <div className="space-y-14">
      <Entrada>
        <Nota>
          Refleja la solución base del solver ({numero(a.totalClases)} clases, misma corrida que el panel), no las ediciones
          manuales del editor. Universo: {numero(a.totalAulas)} aulas ({numero(a.totalLaboratorios)} laboratorios) y{" "}
          {numero(a.totalDocentes)} docentes, de lunes a viernes.
        </Nota>
      </Entrada>
      <Entrada orden={1}>
        <BloqueCapacidad a={a} />
      </Entrada>
      <Entrada orden={2}>
        <BloquePresion a={a} />
      </Entrada>
      <Entrada orden={3}>
        <BloqueEncaje a={a} solver={desgloseSolver} />
      </Entrada>
    </div>
  );
}
