// CSV de entrada como texto: se muestran tal cual están en el archivo (HH:MM, 0/1),
// sin convertir valores. Funciones puras para poder testearlas.

export interface TablaCsv {
  readonly columnas: readonly string[];
  readonly filas: readonly (readonly string[])[];
}

/** Parte una línea respetando comillas dobles (RFC 4180: "" dentro de comillas es una comilla). */
function partirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

/** Acepta CRLF o LF, BOM inicial y línea vacía final. La primera línea son las columnas. */
export function parsearCsv(texto: string): TablaCsv {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lineas.length === 0) return { columnas: [], filas: [] };
  const [encabezado, ...resto] = lineas;
  return { columnas: partirLinea(encabezado), filas: resto.map(partirLinea) };
}

export type TipoColumna = "numero" | "texto";

const NUMERO = /^-?\d+(\.\d+)?$/;

export function tipoColumna(filas: TablaCsv["filas"], indice: number): TipoColumna {
  return filas.length > 0 && filas.every((f) => NUMERO.test(f[indice] ?? "")) ? "numero" : "texto";
}

const normalizar = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Filas que contienen el texto en alguna columna (sin distinguir mayúsculas ni acentos). */
export function filtrarFilas(filas: TablaCsv["filas"], consulta: string): TablaCsv["filas"] {
  const q = normalizar(consulta.trim());
  if (!q) return filas;
  return filas.filter((f) => f.some((v) => normalizar(v).includes(q)));
}

export type Direccion = "asc" | "desc";

const comparar = new Intl.Collator("es", { numeric: true }).compare;

/** Copia ordenada por una columna (numérica o de texto). No modifica la original. */
export function ordenarFilas(
  filas: TablaCsv["filas"], indice: number, direccion: Direccion, tipo: TipoColumna,
): TablaCsv["filas"] {
  const signo = direccion === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => {
    const x = a[indice] ?? "";
    const y = b[indice] ?? "";
    return signo * (tipo === "numero" ? Number(x) - Number(y) : comparar(x, y));
  });
}
