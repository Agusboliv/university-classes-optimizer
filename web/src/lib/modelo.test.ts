import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parsearCsv } from "@/lib/csv";
import { validarEscenario } from "@/lib/escenario";
import { ARCHIVOS, type ArchivoCsv } from "@/lib/esquema";
import { evaluarBlandas, maximosBlandas, maximosDe, moverClase, prepararDatos, verificarSolucion } from "@/lib/modelo";

const leer = (ruta: string) => readFileSync(new URL(`../../../data/${ruta}`, import.meta.url), "utf-8");

const escenario = validarEscenario(JSON.parse(leer("escenarios/referencia.json")));
const datos = prepararDatos(
  Object.fromEntries(ARCHIVOS.map((a) => [a, parsearCsv(leer(a))])) as Record<ArchivoCsv, ReturnType<typeof parsearCsv>>,
);

describe("modelo TS contra el solver Python (referencia.json)", () => {
  test("la solución de referencia cumple D1–D7", () => {
    expect(verificarSolucion(datos, escenario.asignaciones)).toEqual([]);
  });

  test("los peores casos coinciden con CLAUDE.md (B5 sale del JSON: ver maximosBlandas)", () => {
    const m = maximosBlandas(datos);
    expect([m.B1, m.B2, m.B3, m.B4, m.B6]).toEqual([50563, 16080, 1922, 421, 800]);
    expect(maximosDe(escenario.desglose)).toEqual({ B1: 50563, B2: 16080, B3: 1922, B4: 421, B5: 587, B6: 800 });
  });

  test("evaluarBlandas da los mismos valores y puntos que el desglose del JSON", () => {
    const ts = evaluarBlandas(datos, escenario.asignaciones, maximosDe(escenario.desglose));
    escenario.desglose.forEach((py, i) => {
      expect(ts[i].id).toBe(py.id);
      expect(ts[i].valor).toBe(py.valor);
      expect(ts[i].maximo).toBe(py.maximo);
      expect(ts[i].puntos).toBeCloseTo(py.puntos, 9);
    });
  });

  test("mover una clase al aula y horario de otra da un problema D4, sin tocar la original", () => {
    const [x, y] = escenario.asignaciones;
    const movidas = moverClase(datos, escenario.asignaciones, x.clase, { dia: y.dia, inicio: y.inicio, aula: y.aula });

    expect(verificarSolucion(datos, movidas).some((p) => p.startsWith("D4:"))).toBe(true);
    expect(escenario.asignaciones[0]).toBe(x);
    expect(movidas.find((a) => a.clase === x.clase)?.aula).toBe(y.aula);
  });
});
