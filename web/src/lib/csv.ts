// CSV de entrada como texto: se muestran tal cual están en el archivo (HH:MM, 0/1),
// sin convertir valores. Funciones puras para poder testearlas.

import { ARCHIVOS, type ArchivoCsv } from "@/lib/esquema";

export interface TablaCsv {
  readonly columnas: readonly string[];
  readonly filas: readonly (readonly string[])[];
}

export interface ArchivoCargado {
  readonly tabla: TablaCsv;
  readonly texto: string;
}

/** Lee los 5 CSV de entrada (copiados a public/data por scripts/copiar-datos.mjs). Son chicos: se parsean acá. */
export async function cargarCsvs(signal?: AbortSignal): Promise<Record<ArchivoCsv, ArchivoCargado>> {
  const pares = await Promise.all(
    ARCHIVOS.map(async (nombre) => {
      const respuesta = await fetch(`/data/${nombre}`, { signal });
      if (!respuesta.ok) throw new Error(`no se pudo leer ${nombre} (HTTP ${respuesta.status})`);
      const texto = await respuesta.text();
      return [nombre, { tabla: parsearCsv(texto), texto }] as const;
    }),
  );
  return Object.fromEntries(pares) as Record<ArchivoCsv, ArchivoCargado>;
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
