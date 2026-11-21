import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { IDS_BLANDAS, objetivoReal, validarEscenario } from "@/lib/escenario";
import { mismosPesos, pesosDe, puntosCon, repartirPesos, reponderar, type Pesos } from "@/lib/ponderacion";

// Escenario real generado por el solver (Fase 1): objetivo recalculado 22.68
const escenario = validarEscenario(
  JSON.parse(readFileSync(new URL("../../../data/escenarios/referencia.json", import.meta.url), "utf-8")),
);
const ORIGINALES = pesosDe(escenario.desglose);
const suma = (p: Pesos) => IDS_BLANDAS.reduce((s, i) => s + p[i], 0);

describe("reponderar", () => {
  test("con los pesos originales reproduce los puntos del JSON y el objetivo 22.68", () => {
    const filas = reponderar(escenario.desglose, ORIGINALES);

    filas.forEach((f) => expect(f.puntos).toBeCloseTo(f.termino.puntos, 9));
    const total = filas.reduce((s, f) => s + f.puntos, 0);
    expect(total).toBeCloseTo(objetivoReal(escenario.desglose), 9);
    expect(total).toBeCloseTo(22.68, 2);
  });

  test("una blanda con peor caso 0 no suma puntos", () => {
    const termino = { ...escenario.desglose[0], maximo: 0 };
    expect(puntosCon(termino, 50)).toBe(0);
  });
});

describe("repartirPesos", () => {
  test("los pesos siguen sumando 100 y los demás mantienen su proporción", () => {
    const nuevos = repartirPesos(ORIGINALES, "B2", 40);

    expect(nuevos.B2).toBe(40);
    expect(suma(nuevos)).toBeCloseTo(100, 9);
    expect(nuevos.B1 / nuevos.B3).toBeCloseTo(ORIGINALES.B1 / ORIGINALES.B3, 9);
  });

  test("llevar uno a 100 deja los demás en 0 y bajarlo después reparte en partes iguales", () => {
    const todo = repartirPesos(ORIGINALES, "B4", 100);
    expect(IDS_BLANDAS.filter((i) => i !== "B4").every((i) => todo[i] === 0)).toBe(true);

    const bajado = repartirPesos(todo, "B4", 50);
    expect(bajado.B1).toBeCloseTo(10, 9);
    expect(suma(bajado)).toBeCloseTo(100, 9);
  });

  test("recorta valores fuera de 0–100", () => {
    expect(repartirPesos(ORIGINALES, "B1", 140).B1).toBe(100);
    expect(repartirPesos(ORIGINALES, "B1", -5).B1).toBe(0);
  });

  test("mismosPesos detecta cambios", () => {
    expect(mismosPesos(ORIGINALES, pesosDe(escenario.desglose))).toBe(true);
    expect(mismosPesos(ORIGINALES, repartirPesos(ORIGINALES, "B1", 20))).toBe(false);
  });
});
