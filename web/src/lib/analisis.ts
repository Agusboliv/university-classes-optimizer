// Análisis de la solución base: capacidad ociosa por día,
// presión horaria y calidad del encaje (B1–B6). Funciones puras; B1–B6 salen del
// evaluador de modelo.ts (mismas fórmulas que el solver), no se reimplementan acá.

import type { TablaCsv } from "@/lib/csv";
import type { Asignacion, TerminoDesglose } from "@/lib/escenario";
import {
  aHhmm, aMinutos, asientosVacios, duracionSlots, evaluarBlandas, huecosDe, ocupaciones, rachasDe, separar,
  type Datos, type ValoresBlandas,
} from "@/lib/modelo";

const COLUMNAS_OBLIGATORIAS = ["Clase", "Aula", "Día", "Inicio"] as const;
const TOP = 10;

/**
 * Lee el CSV de la solución del solver (Clase, Aula, Día, Inicio como mínimo). Si no trae
 * Materia, Profesor, Cohorte o Fin, se derivan cruzando por clase con clases.csv.
 */
export function solucionDesdeCsv(tabla: TablaCsv, datos: Datos): Asignacion[] {
  const indice = (col: string) => tabla.columnas.indexOf(col);
  const faltan = COLUMNAS_OBLIGATORIAS.filter((c) => indice(c) < 0);
  if (faltan.length > 0) throw new Error(`a la solución le faltan las columnas ${faltan.join(", ")}`);
  const opcional = (fila: readonly string[], col: string): string | undefined =>
    indice(col) >= 0 && fila[indice(col)] ? fila[indice(col)] : undefined;

  return tabla.filas.map((f) => {
    const id = f[indice("Clase")];
    const c = datos.clases.get(id);
    if (!c) throw new Error(`la clase ${id} de la solución no está en clases.csv`);
    const inicio = f[indice("Inicio")];
    const ini = aMinutos(inicio);
    if (ini === null) throw new Error(`hora de inicio inválida para ${id}: '${inicio}'`);
    return {
      clase: id,
      materia: opcional(f, "Materia") ?? c.materia,
      cohorte: opcional(f, "Cohorte") ?? c.cohorte,
      profesor: opcional(f, "Profesor") ?? c.profesor,
      aula: f[indice("Aula")],
      dia: f[indice("Día")],
      inicio,
      fin: opcional(f, "Fin") ?? aHhmm(ini + c.duracion),
    };
  });
}

export interface FilaAsientos {
  readonly clase: string;
  readonly materia: string;
  readonly aula: string;
  readonly dia: string;
  readonly inicio: string;
  readonly capacidad: number;
  readonly alumnos: number;
  readonly vacios: number; // asientos
}

export interface FilaLaboratorio {
  readonly clase: string;
  readonly materia: string;
  readonly aula: string;
  readonly dia: string;
  readonly inicio: string;
  readonly fin: string;
  readonly slots: number;
}

export interface Analisis {
  readonly dias: readonly string[];
  readonly totalClases: number;
  readonly totalAulas: number;
  readonly totalLaboratorios: number;
  readonly totalDocentes: number;
  // Bloque 1: capacidad ociosa (arrays alineados con `dias`)
  readonly aulasLibres: readonly number[];
  readonly laboratoriosLibres: readonly number[];
  readonly docentesLibresDisponibles: readonly number[];
  readonly docentesNoDisponibles: readonly number[];
  // Bloque 2: presión horaria
  readonly horas: readonly number[]; // minuto de inicio de cada hora
  readonly aulasOcupadas: readonly (readonly (number | null)[])[]; // [día][hora]; null = fuera de las franjas
  // Bloque 3: calidad del encaje
  readonly asientosPorDia: readonly number[]; // B1 por día (asiento·slot)
  readonly topAsientos: readonly FilaAsientos[];
  readonly huecosPorDia: readonly number[]; // B2 por día (slots)
  readonly topCohortes: readonly { readonly cohorte: string; readonly huecos: number }[];
  readonly docentesPorDias: readonly number[]; // índice = días con clase (0..n)
  readonly docentesConRacha: number; // docentes con algún día de más de 360 min seguidos (B3 > 0)
  readonly laboratoriosSinNecesidad: readonly FilaLaboratorio[]; // B5
  readonly desglose: readonly TerminoDesglose[]; // B1–B6 del evaluador
}

/** Hay una franja que toca la hora [h, h+60) ese día. */
function enFranja(datos: Datos, dia: string, h: number): boolean {
  for (const [k, [a, b]] of datos.ventanas) {
    if (separar(k)[0] === dia && a < h + 60 && h < b) return true;
  }
  return false;
}

function capacidadOciosa(datos: Datos, asignaciones: readonly Asignacion[]) {
  const aulasPorDia = new Map(datos.dias.map((d) => [d, new Set<string>()]));
  const docentesPorDia = new Map(datos.dias.map((d) => [d, new Set<string>()]));
  for (const a of asignaciones) {
    aulasPorDia.get(a.dia)?.add(a.aula);
    const c = datos.clases.get(a.clase);
    if (c) docentesPorDia.get(a.dia)?.add(c.profesor);
  }
  const aulas = [...datos.aulas.values()];
  const docentes = [...datos.maxMinPorDia.keys()];
  const libresDe = (d: string) => docentes.filter((p) => !docentesPorDia.get(d)?.has(p));
  return {
    aulasLibres: datos.dias.map((d) => aulas.filter((a) => !aulasPorDia.get(d)?.has(a.id)).length),
    laboratoriosLibres: datos.dias.map((d) => aulas.filter((a) => a.laboratorio && !aulasPorDia.get(d)?.has(a.id)).length),
    docentesLibresDisponibles: datos.dias.map((d) => libresDe(d).filter((p) => datos.disponibles.has(`${p}|${d}`)).length),
    docentesNoDisponibles: datos.dias.map((d) => libresDe(d).filter((p) => !datos.disponibles.has(`${p}|${d}`)).length),
  };
}

function presionHoraria(datos: Datos, asignaciones: readonly Asignacion[]) {
  const fin = Math.max(...[...datos.ventanas.values()].map(([, b]) => b));
  const desde = Math.floor(datos.minInicio / 60) * 60;
  const horas = Array.from({ length: Math.ceil((fin - desde) / 60) }, (_, i) => desde + i * 60);
  const aulasOcupadas = datos.dias.map((d) =>
    horas.map((h) => {
      if (!enFranja(datos, d, h)) return null;
      const ocupadas = new Set<string>();
      for (const a of asignaciones) {
        const ini = aMinutos(a.inicio);
        const f = aMinutos(a.fin);
        if (a.dia === d && ini !== null && f !== null && ini < h + 60 && h < f) ocupadas.add(a.aula);
      }
      return ocupadas.size;
    }),
  );
  return { horas, aulasOcupadas };
}

function calidadEncaje(datos: Datos, asignaciones: readonly Asignacion[]) {
  const indiceDia = new Map(datos.dias.map((d, i) => [d, i]));
  const asientosPorDia = datos.dias.map(() => 0);
  const filasAsientos: FilaAsientos[] = [];
  const laboratoriosSinNecesidad: FilaLaboratorio[] = [];
  for (const a of asignaciones) {
    const c = datos.clases.get(a.clase);
    const aula = datos.aulas.get(a.aula);
    const i = indiceDia.get(a.dia);
    if (!c || !aula || i === undefined) continue;
    asientosPorDia[i] += asientosVacios(c, aula);
    filasAsientos.push({ clase: c.id, materia: c.materia, aula: aula.id, dia: a.dia, inicio: a.inicio,
      capacidad: aula.capacidad, alumnos: c.alumnos, vacios: aula.capacidad - c.alumnos });
    if (!c.requiereLaboratorio && aula.laboratorio) {
      laboratoriosSinNecesidad.push({ clase: c.id, materia: c.materia, aula: aula.id, dia: a.dia, inicio: a.inicio,
        fin: a.fin, slots: duracionSlots(c) });
    }
  }

  const occ = ocupaciones(datos, asignaciones);
  const huecosPorDia = datos.dias.map(() => 0);
  const huecosPorCohorte = new Map<string, number>();
  for (const [k, slots] of occ.cohorte) {
    const [cohorte, dia] = separar(k);
    const h = huecosDe(datos, dia, slots);
    const i = indiceDia.get(dia);
    if (i !== undefined) huecosPorDia[i] += h;
    huecosPorCohorte.set(cohorte, (huecosPorCohorte.get(cohorte) ?? 0) + h);
  }

  const diasPorDocente = new Map<string, number>();
  const conRacha = new Set<string>();
  for (const [k, slots] of occ.docente) {
    const [docente, dia] = separar(k);
    diasPorDocente.set(docente, (diasPorDocente.get(docente) ?? 0) + 1);
    if (rachasDe(datos, dia, slots) > 0) conRacha.add(docente);
  }
  const docentesPorDias = Array.from({ length: datos.dias.length + 1 }, () => 0);
  for (const p of datos.maxMinPorDia.keys()) docentesPorDias[diasPorDocente.get(p) ?? 0]++;

  return {
    asientosPorDia,
    topAsientos: filasAsientos.sort((x, y) => y.vacios - x.vacios || x.clase.localeCompare(y.clase)).slice(0, TOP),
    huecosPorDia,
    topCohortes: [...huecosPorCohorte]
      .filter(([, h]) => h > 0)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, TOP)
      .map(([cohorte, huecos]) => ({ cohorte, huecos })),
    docentesPorDias,
    docentesConRacha: conRacha.size,
    laboratoriosSinNecesidad,
  };
}

/** Todo el análisis de una solución. `maximos` = peores casos del escenario (maximosDe del JSON). */
export function analizar(datos: Datos, asignaciones: readonly Asignacion[], maximos: ValoresBlandas): Analisis {
  const aulas = [...datos.aulas.values()];
  return {
    dias: datos.dias,
    totalClases: asignaciones.length,
    totalAulas: aulas.length,
    totalLaboratorios: aulas.filter((a) => a.laboratorio).length,
    totalDocentes: datos.maxMinPorDia.size,
    ...capacidadOciosa(datos, asignaciones),
    ...presionHoraria(datos, asignaciones),
    ...calidadEncaje(datos, asignaciones),
    desglose: evaluarBlandas(datos, asignaciones, maximos),
  };
}
