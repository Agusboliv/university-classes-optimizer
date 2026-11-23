// Grilla semanal: agrupar asignaciones por cohorte, profesor o aula y ubicarlas
// en el tiempo. Funciones puras (sin React) para poder testearlas.

import type { Asignacion } from "@/lib/escenario";

export const VISTAS = ["cohorte", "profesor", "aula"] as const;
export type Vista = (typeof VISTAS)[number];
export type Campo = "materia" | Vista;

export const NOMBRE_CAMPO: Readonly<Record<Campo, string>> = {
  materia: "Materia",
  cohorte: "Cohorte",
  profesor: "Profesor",
  aula: "Aula",
};

/** Días en el orden del archivo franjas.csv. */
export const DIAS = ["LUN", "MAR", "MIÉ", "JUE", "VIE"] as const;
export const NOMBRE_DIA: Readonly<Record<string, string>> = {
  LUN: "Lunes", MAR: "Martes", MIÉ: "Miércoles", JUE: "Jueves", VIE: "Viernes",
};

/** Cantidad de colores categóricos (--materia-1..8). El resto se agrupa en "otras". */
export const MAX_COLORES = 8;

const comparar = new Intl.Collator("es", { numeric: true }).compare;

export const esVista = (v: unknown): v is Vista => VISTAS.includes(v as Vista);

export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Días presentes en los datos, en orden LUN–VIE (los desconocidos van al final). */
export function diasDe(asignaciones: readonly Asignacion[]): string[] {
  const presentes = new Set(asignaciones.map((a) => a.dia));
  const conocidos = DIAS.filter((d) => presentes.has(d));
  const otros = [...presentes].filter((d) => !(DIAS as readonly string[]).includes(d)).sort(comparar);
  return [...conocidos, ...otros];
}

export function valoresDe(clases: readonly Asignacion[], campo: Campo): string[] {
  return [...new Set(clases.map((c) => c[campo]))].sort(comparar);
}

export const entidades = (asignaciones: readonly Asignacion[], vista: Vista): string[] =>
  valoresDe(asignaciones, vista);

/** Clases de una entidad, ordenadas por día y hora. */
export function clasesDe(asignaciones: readonly Asignacion[], vista: Vista, id: string): Asignacion[] {
  const orden = new Map(diasDe(asignaciones).map((d, i) => [d, i]));
  return asignaciones
    .filter((a) => a[vista] === id)
    .sort((a, b) => (orden.get(a.dia) ?? 0) - (orden.get(b.dia) ?? 0) || minutos(a.inicio) - minutos(b.inicio));
}

export interface RangoHorario {
  readonly inicio: number; // minutos, redondeado a la hora
  readonly fin: number;
}

/** Rango de toda la solución, así todas las grillas son comparables. */
export function rangoHorario(asignaciones: readonly Asignacion[]): RangoHorario {
  const inicios = asignaciones.map((a) => minutos(a.inicio));
  const fines = asignaciones.map((a) => minutos(a.fin));
  return { inicio: Math.floor(Math.min(...inicios) / 60) * 60, fin: Math.ceil(Math.max(...fines) / 60) * 60 };
}

/** Posición vertical del bloque en % del alto de la columna. */
export function posicion(clase: Asignacion, rango: RangoHorario): { top: number; alto: number } {
  const total = rango.fin - rango.inicio;
  const ini = minutos(clase.inicio);
  return { top: (100 * (ini - rango.inicio)) / total, alto: (100 * (minutos(clase.fin) - ini)) / total };
}

/**
 * Color de cada materia de la vista: en orden fijo por minutos de clase (y nombre).
 * Las primeras 8 reciben un color (0..7); el resto, null ("otras", gris neutro).
 */
export function coloresPorMateria(clases: readonly Asignacion[]): Map<string, number | null> {
  const minutosPorMateria = new Map<string, number>();
  for (const c of clases) {
    minutosPorMateria.set(c.materia, (minutosPorMateria.get(c.materia) ?? 0) + minutos(c.fin) - minutos(c.inicio));
  }
  const orden = [...minutosPorMateria].sort((a, b) => b[1] - a[1] || comparar(a[0], b[0])).map(([m]) => m);
  return new Map(orden.map((m, i) => [m, i < MAX_COLORES ? i : null]));
}

export interface ResumenEntidad {
  readonly clases: number;
  readonly minutos: number;
  readonly dias: number;
}

export function resumenDe(clases: readonly Asignacion[]): ResumenEntidad {
  return {
    clases: clases.length,
    minutos: clases.reduce((s, c) => s + minutos(c.fin) - minutos(c.inicio), 0),
    dias: new Set(clases.map((c) => c.dia)).size,
  };
}

/** Los dos datos que se muestran debajo de la materia en cada bloque. */
export function camposSecundarios(vista: Vista): [Vista, Vista] {
  const otros = VISTAS.filter((v) => v !== vista);
  return [otros[0], otros[1]];
}

/** Campo para resaltar además de la materia: profesor, o cohorte en la vista de profesor. */
export const campoResaltable = (vista: Vista): Vista => (vista === "profesor" ? "cohorte" : "profesor");
