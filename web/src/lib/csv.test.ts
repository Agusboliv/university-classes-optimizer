import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parsearCsv } from "@/lib/csv";
import { ARCHIVOS, ESQUEMA } from "@/lib/esquema";

const leer = (archivo: string) =>
  parsearCsv(readFileSync(new URL(`../../../data/${archivo}`, import.meta.url), "utf-8"));

// Caso sintético de referencia (CLAUDE.md, sección Datos)
const FILAS_ESPERADAS = {
  "aulas.csv": 200,
  "clases.csv": 1003,
  "franjas.csv": 15,
  "profesores.csv": 287,
  "disponibilidad_profesores.csv": 1378,
} as const;

describe("parsearCsv con los datos reales", () => {
  test.each(ARCHIVOS)("%s tiene las columnas del esquema, en orden, y las filas esperadas", (archivo) => {
    const tabla = leer(archivo);

    expect(tabla.columnas).toEqual(ESQUEMA[archivo]);
    expect(tabla.filas).toHaveLength(FILAS_ESPERADAS[archivo]);
    expect(tabla.filas.every((f) => f.length === tabla.columnas.length)).toBe(true);
  });

  test("mantiene el formato del archivo (HH:MM y 0/1 como texto)", () => {
    const franjas = leer("franjas.csv");
    expect(franjas.filas[0]).toEqual(["LUN", "mañana", "08:00", "13:00"]);
    expect(leer("aulas.csv").filas[0].slice(4)).toEqual(["1", "0"]);
  });
});

describe("parsearCsv con casos borde", () => {
  test("acepta BOM, LF y campos entre comillas con comas y comillas", () => {
    const tabla = parsearCsv('﻿a,b\n"x, y","dijo ""hola"""\n');
    expect(tabla).toEqual({ columnas: ["a", "b"], filas: [["x, y", 'dijo "hola"']] });
  });

  test("un texto vacío da una tabla vacía", () => {
    expect(parsearCsv("")).toEqual({ columnas: [], filas: [] });
  });
});
