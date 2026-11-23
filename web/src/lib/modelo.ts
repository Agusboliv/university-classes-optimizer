// Port a TS de preparar_datos (lo necesario) y de solver/solver/verificacion.py:
// D1–D7 y el valor real de B1–B6, sin solver. Mismos mensajes y fórmulas que Python.
// Si cambia una fórmula en Python, cambiarla acá (los tests comparan contra el JSON).

import type { TablaCsv } from "@/lib/csv";
import { IDS_BLANDAS, type Asignacion, type IdBlanda, type TerminoDesglose } from "@/lib/escenario";
import type { ArchivoCsv } from "@/lib/esquema";

export const SLOT_DURATION = 30;
const K_AULAS = 10;
const UMBRAL_RACHA_MIN = 360;
const W_RACHA = UMBRAL_RACHA_MIN / SLOT_DURATION + 1;

export const PESOS: Readonly<Record<IdBlanda, number>> = { B1: 17.5, B2: 22.5, B3: 22.5, B4: 12, B5: 17.5, B6: 8 };
const NOMBRES_BLANDAS: Readonly<Record<IdBlanda, string>> = {
  B1: "asientos vacíos (asiento·slot)",
  B2: "huecos de cohorte (slots)",
  B3: "racha docente > U (slots)",
  B4: "días extra de docentes",
  B5: "laboratorio sin necesitarlo (slots)",
  B6: "días con una sola materia (docentes 2+ materias)",
};

// --- Horas ---------------------------------------------------------------------

/** "HH:MM" -> minutos; null si el formato no es válido (como time_to_mins). */
export function aMinutos(hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h > 23 || m > 59 ? null : h * 60 + m;
}

export const aHhmm = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

// --- Datos -----------------------------------------------------------------------

export interface Aula {
  readonly id: string;
  readonly capacidad: number;
  readonly proyector: boolean;
  readonly laboratorio: boolean;
}

export interface Clase {
  readonly id: string;
  readonly materia: string;
  readonly cohorte: string;
  readonly profesor: string;
  readonly franja: string;
  readonly alumnos: number;
  readonly duracion: number; // minutos
  readonly requiereProyector: boolean;
  readonly requiereLaboratorio: boolean;
}

export interface Datos {
  readonly aulas: ReadonlyMap<string, Aula>;
  readonly clases: ReadonlyMap<string, Clase>;
  readonly maxMinPorDia: ReadonlyMap<string, number>; // docente -> tope diario
  readonly dias: readonly string[]; // orden de franjas.csv
  readonly ventanas: ReadonlyMap<string, readonly [number, number]>; // "día|franja" -> (inicio, fin)
  readonly disponibles: ReadonlyMap<string, ReadonlySet<number>>; // "docente|día" -> minutos libres
  readonly aulasCompatibles: ReadonlyMap<string, readonly string[]>; // las K_AULAS compatibles más chicas
  readonly clasesPorDocente: ReadonlyMap<string, readonly string[]>;
  readonly inicios: ReadonlyMap<string, readonly (readonly [string, number])[]>; // clase -> (día, minuto) por D1 y D5
  readonly minInicio: number; // minuto del slot 0
  readonly slotsValidos: ReadonlyMap<string, readonly number[]>; // día -> slots dentro de alguna franja
}

export type TablasEntrada = Readonly<Record<ArchivoCsv, TablaCsv>>;

const clave = (a: string, b: string): string => `${a}|${b}`;
const rango = (desde: number, hasta: number): number[] =>
  Array.from({ length: Math.max(0, Math.ceil((hasta - desde) / SLOT_DURATION)) }, (_, i) => desde + i * SLOT_DURATION);

function registros(tabla: TablaCsv): Record<string, string>[] {
  return tabla.filas.map((f) => Object.fromEntries(tabla.columnas.map((c, i) => [c, f[i] ?? ""])));
}

function agrupar<T>(items: readonly T[], claveDe: (t: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const it of items) grupos.set(claveDe(it), [...(grupos.get(claveDe(it)) ?? []), it]);
  return grupos;
}

/**
 * D2 capacidad y D3 proyector/laboratorio; las K más chicas. `porCapacidad` ya viene ordenada
 * (estable), así que filtrar en orden equivale a filtrar y después ordenar.
 */
function aulasCompatibles(porCapacidad: readonly Aula[], c: Clase): string[] {
  const elegidas: string[] = [];
  for (const a of porCapacidad) {
    if (elegidas.length === K_AULAS) break;
    if (a.capacidad >= c.alumnos && (!c.requiereLaboratorio || a.laboratorio) && (!c.requiereProyector || a.proyector)) {
      elegidas.push(a.id);
    }
  }
  return elegidas;
}

function libreEntre(libres: ReadonlySet<number> | undefined, desde: number, hasta: number): boolean {
  if (!libres) return false;
  for (let t = desde; t < hasta; t += SLOT_DURATION) if (!libres.has(t)) return false;
  return true;
}

function iniciosPosibles(
  c: Clase, ventanas: ReadonlyMap<string, readonly [number, number]>, disponibles: ReadonlyMap<string, ReadonlySet<number>>,
): [string, number][] {
  const inicios: [string, number][] = [];
  for (const [k, [a, b]] of ventanas) {
    const [dia, franja] = k.split("|");
    if (franja !== c.franja) continue;
    const libres = disponibles.get(clave(c.profesor, dia));
    for (let t0 = a; t0 <= b - c.duracion; t0 += SLOT_DURATION) {
      if (libreEntre(libres, t0, t0 + c.duracion)) inicios.push([dia, t0]);
    }
  }
  return inicios;
}

/** Convierte las tablas (ya validadas por el solver) en estructuras para verificar y evaluar. */
export function prepararDatos(tablas: TablasEntrada): Datos {
  const aulas = registros(tablas["aulas.csv"]).map((r) => ({
    id: r.aula_id, capacidad: Number(r.capacidad), proyector: r.tiene_proyector === "1", laboratorio: r.es_laboratorio === "1",
  }));
  const clases = registros(tablas["clases.csv"]).map((r) => ({
    id: r.clase_id, materia: r.materia, cohorte: r.cohorte, profesor: r.profesor_id, franja: r.franja,
    alumnos: Number(r.cantidad_alumnos), duracion: Number(r.duracion_min),
    requiereProyector: r.requiere_proyector === "1", requiereLaboratorio: r.requiere_laboratorio === "1",
  }));
  const franjas = registros(tablas["franjas.csv"]);
  const ventanas = new Map(
    franjas.map((r) => [clave(r.dia, r.franja), [aMinutos(r.hora_inicio) ?? 0, aMinutos(r.hora_fin) ?? 0] as const]),
  );
  const disponibles = new Map<string, Set<number>>();
  for (const r of registros(tablas["disponibilidad_profesores.csv"])) {
    const k = clave(r.profesor_id, r.dia);
    const libres = disponibles.get(k) ?? new Set<number>();
    rango(aMinutos(r.hora_desde) ?? 0, aMinutos(r.hora_hasta) ?? 0).forEach((t) => libres.add(t));
    disponibles.set(k, libres);
  }
  const porCapacidad = [...aulas].sort((a, b) => a.capacidad - b.capacidad); // sort estable: empates en orden del CSV
  const minInicio = Math.min(...[...ventanas.values()].map(([a]) => a));
  const dias = [...new Set(franjas.map((r) => r.dia))];
  const slotsValidos = new Map(
    dias.map((d) => {
      const slots = new Set<number>();
      for (const [k, [a, b]] of ventanas) {
        if (k.split("|")[0] === d) rango(a, b).forEach((t) => slots.add((t - minInicio) / SLOT_DURATION));
      }
      return [d, [...slots].sort((x, y) => x - y)] as const;
    }),
  );
  return {
    aulas: new Map(aulas.map((a) => [a.id, a])),
    clases: new Map(clases.map((c) => [c.id, c])),
    maxMinPorDia: new Map(registros(tablas["profesores.csv"]).map((r) => [r.profesor_id, Number(r.max_min_por_dia)])),
    dias,
    ventanas,
    disponibles,
    aulasCompatibles: new Map(clases.map((c) => [c.id, aulasCompatibles(porCapacidad, c)])),
    clasesPorDocente: new Map([...agrupar(clases, (c) => c.profesor)].map(([p, cs]) => [p, cs.map((c) => c.id)])),
    inicios: new Map(clases.map((c) => [c.id, iniciosPosibles(c, ventanas, disponibles)])),
    minInicio,
    slotsValidos,
  };
}

const slotDe = (datos: Datos, minuto: number): number => Math.floor((minuto - datos.minInicio) / SLOT_DURATION);
export const duracionSlots = (c: Clase): number => c.duracion / SLOT_DURATION;
/** "a|b" -> [a, b] (claves de los mapas de este módulo). */
export const separar = (k: string): [string, string] => {
  const [a, b] = k.split("|");
  return [a, b];
};

/** Ventanas de W slots consecutivos que no cruzan un corte entre franjas (B3). */
function ventanasRacha(slots: readonly number[]): number[][] {
  const ventanas: number[][] = [];
  for (let i = 0; i + W_RACHA <= slots.length; i++) {
    if (slots[i + W_RACHA - 1] - slots[i] === W_RACHA - 1) ventanas.push(slots.slice(i, i + W_RACHA));
  }
  return ventanas;
}

function minimoDias(datos: Datos): Map<string, number> {
  return new Map(
    [...datos.clasesPorDocente].map(([p, cs]) => {
      const total = cs.reduce((s, c) => s + (datos.clases.get(c)?.duracion ?? 0), 0);
      return [p, Math.ceil(total / (datos.maxMinPorDia.get(p) ?? 1))];
    }),
  );
}

function materiasPorDocente(datos: Datos): Map<string, Set<string>> {
  return new Map([...datos.clasesPorDocente].map(([p, cs]) => [p, new Set(cs.map((c) => datos.clases.get(c)?.materia ?? ""))]));
}

// --- D1–D7 ---------------------------------------------------------------------

type Ubicacion = Pick<Asignacion, "clase" | "aula" | "dia" | "inicio">;

function problemasDeAsignacion(datos: Datos, c: Clase, aula: Aula, dia: string, ini: number): string[] {
  const fin = ini + c.duracion;
  const problemas: string[] = [];
  if (ini % SLOT_DURATION) problemas.push(`D1: ${c.id} empieza fuera de la grilla de ${SLOT_DURATION} min`);
  const franja = datos.ventanas.get(clave(dia, c.franja));
  if (!franja || !(franja[0] <= ini && fin <= franja[1])) problemas.push(`D1: ${c.id} queda fuera de su franja`);
  if (aula.capacidad < c.alumnos) problemas.push(`D2: ${c.id} no entra en ${aula.id}`);
  if ((c.requiereProyector && !aula.proyector) || (c.requiereLaboratorio && !aula.laboratorio)) {
    problemas.push(`D3: ${c.id} en ${aula.id} sin proyector o laboratorio`);
  }
  const libres = datos.disponibles.get(clave(c.profesor, dia));
  if (rango(ini, fin).some((t) => !libres?.has(t))) problemas.push(`D5: ${c.profesor} no está disponible para ${c.id}`);
  return problemas;
}

/** Violaciones de D1–D7 (vacía = la solución es válida). Independiente del modelo. */
export function verificarSolucion(datos: Datos, asignaciones: readonly Ubicacion[]): string[] {
  const problemas: string[] = [];
  const ids = asignaciones.map((a) => a.clase).sort();
  const esperados = [...datos.clases.keys()].sort();
  if (ids.length !== esperados.length || ids.some((id, i) => id !== esperados[i])) {
    problemas.push("D1: hay clases sin asignar o asignadas más de una vez");
  }
  const uso = new Map<string, string>();
  const minutosDia = new Map<string, number>();
  for (const { clase: id, aula: aulaId, dia, inicio } of asignaciones) {
    const c = datos.clases.get(id);
    const aula = datos.aulas.get(aulaId);
    if (!c || !aula) {
      problemas.push(`D1: clase ${id} o aula ${aulaId} desconocida`);
      continue;
    }
    const ini = aMinutos(inicio);
    if (ini === null) {
      problemas.push(`D1: ${id}: hora inválida: '${inicio}'`);
      continue;
    }
    problemas.push(...problemasDeAsignacion(datos, c, aula, dia, ini));
    for (const t of rango(ini, ini + c.duracion)) {
      for (const [regla, recurso] of [["D4", aulaId], ["D5", c.profesor], ["D6", c.cohorte]] as const) {
        const k = `${regla}|${recurso}|${dia}|${t}`;
        const previa = uso.get(k);
        if (previa) problemas.push(`${regla}: ${id} se superpone con ${previa} (${recurso}, ${dia})`);
        uso.set(k, id);
      }
    }
    const kd = clave(c.profesor, dia);
    minutosDia.set(kd, (minutosDia.get(kd) ?? 0) + c.duracion);
  }
  for (const [kd, mins] of minutosDia) {
    const [prof, dia] = kd.split("|");
    if (mins > (datos.maxMinPorDia.get(prof) ?? Infinity)) problemas.push(`D7: ${prof} da ${mins} min el ${dia}`);
  }
  return problemas;
}

// --- B1–B6 ---------------------------------------------------------------------

export type ValoresBlandas = Readonly<Record<IdBlanda, number>>;

/** Slots válidos libres entre la primera y la última clase del día. */
function huecos(slots: readonly number[], ocupados: ReadonlySet<number>): number {
  const idx = slots.flatMap((s, i) => (ocupados.has(s) ? [i] : []));
  if (idx.length === 0) return 0;
  return slots.slice(idx[0], idx[idx.length - 1] + 1).filter((s) => !ocupados.has(s)).length;
}

function agregar<T>(mapa: Map<string, Set<T>>, k: string, valores: Iterable<T>): void {
  const conjunto = mapa.get(k) ?? new Set<T>();
  for (const v of valores) conjunto.add(v);
  mapa.set(k, conjunto);
}

export interface Ocupaciones {
  readonly cohorte: ReadonlyMap<string, ReadonlySet<number>>; // "cohorte|día" -> slots ocupados
  readonly docente: ReadonlyMap<string, ReadonlySet<number>>; // "docente|día" -> slots ocupados
  readonly materiasDia: ReadonlyMap<string, ReadonlySet<string>>; // "docente|día" -> materias que dicta
}

/** Slots ocupados por cohorte y por docente en cada día (base de B2, B3, B4 y B6). */
export function ocupaciones(datos: Datos, asignaciones: readonly Ubicacion[]): Ocupaciones {
  const cohorte = new Map<string, Set<number>>();
  const docente = new Map<string, Set<number>>();
  const materiasDia = new Map<string, Set<string>>();
  for (const a of asignaciones) {
    const c = datos.clases.get(a.clase);
    const ini = aMinutos(a.inicio);
    if (!c || ini === null) continue;
    const s0 = slotDe(datos, ini);
    const slots = Array.from({ length: duracionSlots(c) }, (_, i) => s0 + i);
    agregar(cohorte, clave(c.cohorte, a.dia), slots);
    agregar(docente, clave(c.profesor, a.dia), slots);
    agregar(materiasDia, clave(c.profesor, a.dia), [c.materia]);
  }
  return { cohorte, docente, materiasDia };
}

/** B2 de una cohorte en un día. */
export const huecosDe = (datos: Datos, dia: string, ocupados: ReadonlySet<number>): number =>
  huecos(datos.slotsValidos.get(dia) ?? [], ocupados);

/** B3 de un docente en un día: ventanas de W slots totalmente ocupadas (= slots por encima de 360 min). */
export const rachasDe = (datos: Datos, dia: string, ocupados: ReadonlySet<number>): number =>
  ventanasRacha(datos.slotsValidos.get(dia) ?? []).filter((v) => v.every((s) => ocupados.has(s))).length;

/** B1 de una clase en un aula: asientos vacíos × slots. */
export const asientosVacios = (c: Clase, aula: Aula): number => (aula.capacidad - c.alumnos) * duracionSlots(c);

/** Valor real de cada blanda (supone que la solución ya pasó verificarSolucion). */
export function valoresBlandas(datos: Datos, asignaciones: readonly Ubicacion[]): ValoresBlandas {
  let b1 = 0;
  let b5 = 0;
  for (const a of asignaciones) {
    const c = datos.clases.get(a.clase);
    const aula = datos.aulas.get(a.aula);
    if (!c || !aula || aMinutos(a.inicio) === null) continue;
    b1 += asientosVacios(c, aula);
    if (!c.requiereLaboratorio && aula.laboratorio) b5 += duracionSlots(c);
  }
  const occ = ocupaciones(datos, asignaciones);
  const materiasProf = materiasPorDocente(datos);
  const minimo = [...minimoDias(datos).values()].reduce((s, v) => s + v, 0);
  let b2 = 0;
  for (const [k, s] of occ.cohorte) b2 += huecosDe(datos, separar(k)[1], s);
  let b3 = 0;
  for (const [k, s] of occ.docente) b3 += rachasDe(datos, separar(k)[1], s);
  let b6 = 0;
  for (const [k, ms] of occ.materiasDia) {
    if ((materiasProf.get(separar(k)[0])?.size ?? 0) >= 2 && ms.size === 1) b6++;
  }
  return { B1: b1, B2: b2, B3: b3, B4: occ.docente.size - minimo, B5: b5, B6: b6 };
}

/** Peores casos que usó el solver, tomados del desglose del escenario (fuente de verdad para normalizar). */
export function maximosDe(desglose: readonly TerminoDesglose[]): ValoresBlandas {
  return Object.fromEntries(desglose.map((t) => [t.id, t.maximo])) as ValoresBlandas;
}

/**
 * Peor caso de cada blanda, con las mismas fórmulas que maximos_blandas en Python.
 * B1–B4 y B6 coinciden; B5 puede no coincidir: en Python las 10 aulas candidatas salen de
 * sort_values (quicksort, no estable) y, con empates de capacidad, a veces entra un laboratorio.
 * Acá el orden es estable. Para normalizar, usar maximosDe(desglose) del escenario.
 */
export function maximosBlandas(datos: Datos): ValoresBlandas {
  const diasCohorte = new Set<string>();
  const cobertura = new Map<string, Map<number, number>>(); // "docente|día" -> slot -> inicios posibles que lo cubren
  for (const [id, inis] of datos.inicios) {
    const c = datos.clases.get(id);
    if (!c) continue;
    for (const [d, t0] of inis) {
      diasCohorte.add(clave(c.cohorte, d));
      const porSlot = cobertura.get(clave(c.profesor, d)) ?? new Map<number, number>();
      const s0 = slotDe(datos, t0);
      for (let b = s0; b < s0 + duracionSlots(c); b++) porSlot.set(b, (porSlot.get(b) ?? 0) + 1);
      cobertura.set(clave(c.profesor, d), porSlot);
    }
  }
  const diasPosibles = new Map<string, number>();
  for (const k of cobertura.keys()) diasPosibles.set(k.split("|")[0], (diasPosibles.get(k.split("|")[0]) ?? 0) + 1);
  const minimo = minimoDias(datos);
  const materiasProf = materiasPorDocente(datos);

  let b1 = 0;
  let b5 = 0;
  for (const [id, compat] of datos.aulasCompatibles) {
    const c = datos.clases.get(id);
    if (!c || compat.length === 0) continue;
    const aulas = compat.map((a) => datos.aulas.get(a)).filter((a): a is Aula => a !== undefined);
    b1 += Math.max(...aulas.map((a) => (a.capacidad - c.alumnos) * duracionSlots(c)));
    if (!c.requiereLaboratorio && aulas.some((a) => a.laboratorio)) b5 += duracionSlots(c);
  }
  let b2 = 0;
  for (const k of diasCohorte) b2 += Math.max((datos.slotsValidos.get(k.split("|")[1])?.length ?? 0) - 2, 0);
  let b3 = 0;
  for (const [k, porSlot] of cobertura) {
    const [p, d] = k.split("|");
    const llenas = ventanasRacha(datos.slotsValidos.get(d) ?? []).filter(
      (v) => v.reduce((s, slot) => s + (porSlot.get(slot) ?? 0), 0) >= W_RACHA,
    ).length;
    const excesoMax = Math.floor(Math.max(0, (datos.maxMinPorDia.get(p) ?? 0) - UMBRAL_RACHA_MIN) / SLOT_DURATION);
    b3 += Math.min(llenas, excesoMax);
  }
  let b4 = 0;
  let b6 = 0;
  for (const [p, cs] of datos.clasesPorDocente) {
    const posibles = Math.min(diasPosibles.get(p) ?? 0, cs.length);
    b4 += Math.max(0, posibles - (minimo.get(p) ?? 0));
    if ((materiasProf.get(p)?.size ?? 0) >= 2) b6 += posibles;
  }
  return { B1: b1, B2: b2, B3: b3, B4: b4, B5: b5, B6: b6 };
}

/** Desglose del objetivo: puntos = peso × valor / peor caso (objetivo de 0 a 100). */
export function evaluarBlandas(
  datos: Datos, asignaciones: readonly Ubicacion[], maximos: ValoresBlandas = maximosBlandas(datos),
): TerminoDesglose[] {
  const valores = valoresBlandas(datos, asignaciones);
  return IDS_BLANDAS.map((id) => ({
    id,
    nombre: NOMBRES_BLANDAS[id],
    valor: valores[id],
    maximo: maximos[id],
    peso: PESOS[id],
    puntos: maximos[id] ? (PESOS[id] * valores[id]) / maximos[id] : 0,
  }));
}

// --- Edición manual ------------------------------------------------------------

export interface Movimiento {
  readonly dia: string;
  readonly inicio: string; // HH:MM
  readonly aula: string;
}

/** Copia de las asignaciones con una clase movida (con su nuevo fin). No modifica la original. */
export function moverClase(datos: Datos, asignaciones: readonly Asignacion[], claseId: string, m: Movimiento): Asignacion[] {
  const duracion = datos.clases.get(claseId)?.duracion ?? 0;
  const inicio = aMinutos(m.inicio) ?? 0;
  return asignaciones.map((a) =>
    a.clase === claseId ? { ...a, dia: m.dia, inicio: m.inicio, aula: m.aula, fin: aHhmm(inicio + duracion) } : a,
  );
}

/** Horas de inicio posibles en la grilla (de la primera apertura al último cierre, cada 30 min). */
export function iniciosDeGrilla(datos: Datos, duracion: number): string[] {
  const fin = Math.max(...[...datos.ventanas.values()].map(([, b]) => b));
  return rango(datos.minInicio, fin - duracion + SLOT_DURATION).map(aHhmm);
}
