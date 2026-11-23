import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { analizar, solucionDesdeCsv } from "@/lib/analisis";
import { parsearCsv } from "@/lib/csv";
import { validarEscenario } from "@/lib/escenario";
import { ARCHIVOS } from "@/lib/esquema";
import { maximosDe, prepararDatos, verificarSolucion, type TablasEntrada } from "@/lib/modelo";

const MAXIMOS_CERO = { B1: 0, B2: 0, B3: 0, B4: 0, B5: 0, B6: 0 };

describe("dataset diminuto: 3 aulas (1 laboratorio), 3 docentes, 5 clases, LUN y MAR de 08 a 12", () => {
  const tablas: TablasEntrada = {
    "aulas.csv": parsearCsv(
      "aula_id,nombre,edificio,capacidad,tiene_proyector,es_laboratorio\nA1,A1,X,30,1,0\nA2,A2,X,50,1,0\nL1,L1,X,20,1,1\n",
    ),
    "clases.csv": parsearCsv(
      "clase_id,materia,cohorte,carrera,anio,tipo,cantidad_alumnos,franja,duracion_min,profesor_id,requiere_proyector,requiere_laboratorio\n" +
        "C1,Física,K1,Ing,1,teórica,20,mañana,60,P1,0,0\n" +
        "C2,Química,K1,Ing,1,teórica,40,mañana,60,P2,0,0\n" +
        "C3,Programación,K2,Ing,1,laboratorio,15,mañana,120,P1,0,1\n" +
        "C4,Álgebra,K2,Ing,1,teórica,25,mañana,60,P3,0,0\n" +
        "C5,Física,K1,Ing,1,práctica,10,mañana,60,P1,0,0\n",
    ),
    "franjas.csv": parsearCsv("dia,franja,hora_inicio,hora_fin\nLUN,mañana,08:00,12:00\nMAR,mañana,08:00,12:00\n"),
    "profesores.csv": parsearCsv("profesor_id,nombre,dedicacion,max_min_por_dia\nP1,P1,simple,480\nP2,P2,simple,480\nP3,P3,simple,480\n"),
    // P2 puede LUN y MAR; P3 solo MAR
    "disponibilidad_profesores.csv": parsearCsv(
      "profesor_id,dia,hora_desde,hora_hasta\nP1,LUN,08:00,12:00\nP1,MAR,08:00,12:00\nP2,LUN,08:00,12:00\nP2,MAR,08:00,12:00\nP3,MAR,08:00,12:00\n",
    ),
  };
  const datos = prepararDatos(tablas);
  // La solución trae solo las columnas obligatorias: Materia, Profesor, Cohorte y Fin se derivan
  const solucion = solucionDesdeCsv(
    parsearCsv(
      "Clase,Aula,Día,Inicio\nC1,A1,LUN,08:00\nC2,A2,LUN,09:00\nC3,L1,LUN,10:00\nC4,A1,MAR,08:00\nC5,A2,MAR,09:00\n",
    ),
    datos,
  );
  const r = analizar(datos, solucion, MAXIMOS_CERO);

  test("la solución es válida y se derivan las columnas que faltan", () => {
    expect(verificarSolucion(datos, solucion)).toEqual([]);
    expect(solucion.find((a) => a.clase === "C3")).toMatchObject({ profesor: "P1", cohorte: "K2", fin: "12:00" });
    expect(r.totalClases).toBe(5);
  });

  test("a) aulas sin ninguna clase y b) laboratorios sin ninguna clase", () => {
    expect(r.dias).toEqual(["LUN", "MAR"]);
    expect(r.aulasLibres).toEqual([0, 1]); // MAR: L1 libre
    expect(r.laboratoriosLibres).toEqual([0, 1]);
  });

  test("c) docentes sin clases: disponibles y no disponibles", () => {
    expect(r.docentesLibresDisponibles).toEqual([0, 1]); // MAR: P2 puede pero no tiene clases
    expect(r.docentesNoDisponibles).toEqual([1, 0]); // LUN: P3 no está disponible
  });

  test("d) aulas ocupadas por día y hora", () => {
    expect(r.horas).toEqual([480, 540, 600, 660]);
    expect(r.aulasOcupadas).toEqual([
      [1, 1, 1, 1],
      [1, 1, 0, 0],
    ]);
  });
});

describe("con los archivos reales", () => {
  const leer = (ruta: string) => readFileSync(new URL(`../../../data/${ruta}`, import.meta.url), "utf-8");
  const escenario = validarEscenario(JSON.parse(leer("escenarios/referencia.json")));
  const datos = prepararDatos(Object.fromEntries(ARCHIVOS.map((a) => [a, parsearCsv(leer(a))])) as TablasEntrada);
  const solucion = solucionDesdeCsv(parsearCsv(leer("escenarios/referencia.csv")), datos);
  const r = analizar(datos, solucion, maximosDe(escenario.desglose));

  test("son 1003 clases y es la misma corrida que referencia.json", () => {
    expect(r.totalClases).toBe(1003);
    const json = new Map(escenario.asignaciones.map((a) => [a.clase, a]));
    expect(solucion.every((a) => {
      const b = json.get(a.clase);
      return b && b.aula === a.aula && b.dia === a.dia && b.inicio === a.inicio && b.fin === a.fin;
    })).toBe(true);
  });

  test("B1–B6 coinciden con el desglose del JSON y los parciales por día suman el total", () => {
    escenario.desglose.forEach((py, i) => {
      expect(r.desglose[i].valor).toBe(py.valor);
      expect(r.desglose[i].puntos).toBeCloseTo(py.puntos, 9);
    });
    const suma = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
    const valor = (id: string) => r.desglose.find((t) => t.id === id)?.valor;
    expect(suma(r.asientosPorDia)).toBe(valor("B1"));
    expect(suma(r.huecosPorDia)).toBe(valor("B2"));
    expect(suma(r.laboratoriosSinNecesidad.map((l) => l.slots))).toBe(valor("B5"));
    expect(suma(r.docentesPorDias)).toBe(r.totalDocentes);
  });
});
