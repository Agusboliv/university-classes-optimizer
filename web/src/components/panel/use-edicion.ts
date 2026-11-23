"use client";

import { useEffect, useMemo, useState } from "react";

import { cargarCsvs } from "@/lib/csv";
import type { Asignacion, Escenario, TerminoDesglose } from "@/lib/escenario";
import {
  evaluarBlandas, maximosDe, moverClase, prepararDatos, verificarSolucion, type Datos, type Movimiento, type TablasEntrada,
} from "@/lib/modelo";

export type EstadoModelo =
  | { tipo: "inactivo" } // todavía no se fijó ninguna clase: no se piden los CSV
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: Datos };

export interface Edicion {
  readonly modelo: EstadoModelo;
  readonly actuales: readonly Asignacion[];
  readonly movidas: ReadonlySet<string>;
  readonly cambios: number;
  /** null mientras se cargan los CSV. */
  readonly problemas: readonly string[] | null;
  readonly desglose: readonly TerminoDesglose[] | null;
  readonly desgloseBase: readonly TerminoDesglose[];
  /** Pide los CSV completos (se llama al fijar la primera clase). */
  iniciar: () => void;
  mover: (claseId: string, m: Movimiento) => void;
  deshacer: () => void;
  restaurar: () => void;
}

/** Los CSV completos se piden solo cuando `activo` (al empezar a editar), no al entrar a /panel. */
function useModelo(activo: boolean): EstadoModelo {
  const [estado, setEstado] = useState<EstadoModelo>({ tipo: "cargando" });
  useEffect(() => {
    if (!activo) return;
    const control = new AbortController();
    cargarCsvs(control.signal)
      .then((archivos) => {
        const tablas = Object.fromEntries(Object.entries(archivos).map(([n, a]) => [n, a.tabla])) as TablasEntrada;
        setEstado({ tipo: "listo", datos: prepararDatos(tablas) });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        setEstado({ tipo: "error", mensaje: error instanceof Error ? error.message : "error desconocido" });
      });
    return () => control.abort();
  }, [activo]);
  return activo ? estado : { tipo: "inactivo" };
}

/**
 * Edición manual de la solución base: historial inmutable (cada movimiento agrega una copia),
 * verificación D1–D7 y cálculo de B1–B6 en el navegador. Los peores casos salen del JSON.
 */
export function useEdicion(escenario: Escenario): Edicion {
  const [activo, setActivo] = useState(false);
  const modelo = useModelo(activo);
  const [historial, setHistorial] = useState<readonly (readonly Asignacion[])[]>([escenario.asignaciones]);
  const actuales = historial[historial.length - 1];
  const datos = modelo.tipo === "listo" ? modelo.datos : null;
  const maximos = useMemo(() => maximosDe(escenario.desglose), [escenario]);

  const movidas = useMemo(() => {
    const base = new Map(escenario.asignaciones.map((a) => [a.clase, a]));
    return new Set(
      actuales
        .filter((a) => {
          const b = base.get(a.clase);
          return !b || b.dia !== a.dia || b.inicio !== a.inicio || b.aula !== a.aula;
        })
        .map((a) => a.clase),
    );
  }, [actuales, escenario]);

  const problemas = useMemo(() => (datos ? verificarSolucion(datos, actuales) : null), [datos, actuales]);
  const desglose = useMemo(() => (datos ? evaluarBlandas(datos, actuales, maximos) : null), [datos, actuales, maximos]);

  return {
    modelo,
    actuales,
    movidas,
    cambios: historial.length - 1,
    problemas,
    desglose,
    desgloseBase: escenario.desglose,
    iniciar: () => setActivo(true),
    mover: (claseId, m) => {
      if (!datos) return;
      setHistorial((h) => [...h, moverClase(datos, h[h.length - 1], claseId, m)]);
    },
    deshacer: () => setHistorial((h) => (h.length > 1 ? h.slice(0, -1) : h)),
    restaurar: () => setHistorial((h) => [h[0]]),
  };
}
