import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { validarEscenario } from "@/lib/escenario";
import {
  clasesDe, coloresPorMateria, diasDe, entidades, MAX_COLORES, minutos, posicion, rangoHorario, resumenDe,
} from "@/lib/grilla";

const { asignaciones } = validarEscenario(
  JSON.parse(readFileSync(new URL("../../../data/escenarios/referencia.json", import.meta.url), "utf-8")),
);

describe("grilla", () => {
  test("hay tantas entidades como en el caso de referencia", () => {
    expect(entidades(asignaciones, "cohorte")).toHaveLength(134);
    expect(entidades(asignaciones, "profesor")).toHaveLength(287);
    expect(entidades(asignaciones, "aula")).toHaveLength(116); // aulas usadas, de 200
  });

  test("los días salen en orden LUN–VIE y el rango es 08:00–22:00", () => {
    expect(diasDe(asignaciones)).toEqual(["LUN", "MAR", "MIÉ", "JUE", "VIE"]);
    expect(rangoHorario(asignaciones)).toEqual({ inicio: 8 * 60, fin: 22 * 60 });
  });

  test("clasesDe trae todas las clases de la entidad, ordenadas por día y hora", () => {
    const clases = clasesDe(asignaciones, "cohorte", "IND-1A");

    expect(clases).toHaveLength(asignaciones.filter((a) => a.cohorte === "IND-1A").length);
    const claves = clases.map((c) => diasDe(asignaciones).indexOf(c.dia) * 10_000 + minutos(c.inicio));
    expect(claves).toEqual([...claves].sort((a, b) => a - b));
  });

  test("como máximo 8 materias con color; el resto queda en 'otras'", () => {
    const aulaMasUsada = entidades(asignaciones, "aula")
      .map((id) => clasesDe(asignaciones, "aula", id))
      .sort((a, b) => b.length - a.length)[0];
    const colores = coloresPorMateria(aulaMasUsada);
    const conColor = [...colores.values()].filter((c) => c !== null);

    expect(conColor.length).toBe(Math.min(MAX_COLORES, colores.size));
    expect(new Set(conColor).size).toBe(conColor.length);
  });

  test("posicion ubica 08:00–10:00 arriba de todo con 2 de 14 horas de alto", () => {
    const p = posicion({ ...asignaciones[0], inicio: "08:00", fin: "10:00" }, { inicio: 480, fin: 1320 });
    expect(p.top).toBe(0);
    expect(p.alto).toBeCloseTo((100 * 2) / 14, 9);
  });

  test("resumenDe cuenta clases, minutos y días", () => {
    const r = resumenDe([
      { ...asignaciones[0], dia: "LUN", inicio: "08:00", fin: "10:00" },
      { ...asignaciones[0], dia: "LUN", inicio: "14:00", fin: "15:30" },
    ]);
    expect(r).toEqual({ clases: 2, minutos: 210, dias: 1 });
  });
});
