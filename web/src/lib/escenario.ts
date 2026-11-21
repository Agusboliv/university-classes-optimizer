// Contrato del escenario (CLAUDE.md, sección Datos). Si cambia un campo en
// solver/solver/generar_escenario.py, cambiarlo acá también.

export const IDS_BLANDAS = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;
export type IdBlanda = (typeof IDS_BLANDAS)[number];

export interface Resultado {
  estado: string;
  objetivo: number | null; // el del solver: puede quedar por encima del real
  cota_inferior: number | null;
  tiempo_s: number;
  tiempo_limite_s: number;
  workers: number;
}

export interface TerminoDesglose {
  id: IdBlanda;
  nombre: string;
  valor: number;
  maximo: number;
  peso: number;
  puntos: number;
}

export interface Verificacion {
  ok: boolean;
  problemas: string[];
}

export interface Asignacion {
  clase: string;
  materia: string;
  cohorte: string;
  profesor: string;
  aula: string;
  dia: string;
  inicio: string;
  fin: string;
}

export interface Escenario {
  resultado: Resultado;
  desglose: TerminoDesglose[];
  verificacion: Verificacion;
  asignaciones: Asignacion[];
}

/** Etiquetas para la UI (los nombres del JSON traen la unidad entre paréntesis). */
export const ETIQUETAS: Readonly<Record<IdBlanda, { nombre: string; unidad: string }>> = {
  B1: { nombre: "Asientos vacíos", unidad: "asiento·slot" },
  B2: { nombre: "Huecos de cohorte", unidad: "slots" },
  B3: { nombre: "Rachas docentes > 6 h", unidad: "slots" },
  B4: { nombre: "Días extra de docentes", unidad: "días" },
  B5: { nombre: "Laboratorio sin necesitarlo", unidad: "slots" },
  B6: { nombre: "Días con una sola materia", unidad: "días" },
};

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function validarTermino(t: unknown, i: number): TerminoDesglose {
  if (!esObjeto(t) || !IDS_BLANDAS.includes(t.id as IdBlanda)) {
    throw new Error(`desglose[${i}]: falta un id B1–B6`);
  }
  for (const campo of ["valor", "maximo", "peso", "puntos"] as const) {
    if (!esNumero(t[campo])) throw new Error(`desglose[${i}].${campo} no es un número`);
  }
  return t as unknown as TerminoDesglose;
}

/** Chequeo liviano del contrato: claves de primer nivel y el desglose completo. */
export function validarEscenario(datos: unknown): Escenario {
  if (!esObjeto(datos)) throw new Error("el escenario no es un objeto JSON");
  const { resultado, desglose, verificacion, asignaciones } = datos;
  if (!esObjeto(resultado) || !esNumero(resultado.tiempo_s)) throw new Error("falta resultado.tiempo_s");
  if (!esObjeto(verificacion) || typeof verificacion.ok !== "boolean") throw new Error("falta verificacion.ok");
  if (!Array.isArray(asignaciones)) throw new Error("falta la lista de asignaciones");
  if (!Array.isArray(desglose) || desglose.length !== IDS_BLANDAS.length) {
    throw new Error("el desglose tiene que tener B1–B6");
  }
  desglose.forEach(validarTermino);
  return datos as unknown as Escenario;
}

export async function cargarEscenario(nombre = "referencia", signal?: AbortSignal): Promise<Escenario> {
  const respuesta = await fetch(`/escenarios/${nombre}.json`, { signal });
  if (!respuesta.ok) throw new Error(`no se pudo leer el escenario "${nombre}" (HTTP ${respuesta.status})`);
  return validarEscenario(await respuesta.json());
}

/** Objetivo real de la solución: la suma del desglose (no el del solver). */
export function objetivoReal(desglose: readonly TerminoDesglose[]): number {
  return desglose.reduce((suma, t) => suma + t.puntos, 0);
}
