"""Modelo CP-SAT (Parte 2 del notebook): variables y/x, duras D1–D7, blandas B1–B6."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd
from ortools.sat.python import cp_model

from solver.datos import (
    PESOS, SLOT_DURATION, UMBRAL_RACHA_MIN, Datos,
    materias_por_docente, mins_to_hhmm, minimo_dias, ventanas_racha,
)
from solver.verificacion import maximos_blandas

ESCALA = 10**6  # CP-SAT solo acepta coeficientes enteros: los pesos se multiplican por esto

Clave = tuple[str, str, int]  # (recurso, día, slot)


@dataclass
class Variables:
    """Variables de decisión e índices para armar las restricciones."""
    y: dict[tuple[str, str, int], cp_model.IntVar] = field(default_factory=dict)       # (clase, día, slot)
    x: dict[tuple[str, str, str, int], cp_model.IntVar] = field(default_factory=dict)  # (clase, aula, día, slot)
    y_por_clase: dict[str, list[cp_model.IntVar]] = field(default_factory=dict)
    ocupacion_aula: dict[Clave, list[cp_model.IntVar]] = field(default_factory=dict)
    ocupacion_profesor: dict[Clave, list[cp_model.IntVar]] = field(default_factory=dict)
    ocupacion_cohorte: dict[Clave, list[cp_model.IntVar]] = field(default_factory=dict)
    ocupacion_profesor_dia: dict[tuple[str, str], list[tuple[int, cp_model.IntVar]]] = field(default_factory=dict)


@dataclass(frozen=True)
class Resultado:
    estado: str                       # OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, MODEL_INVALID
    objetivo: float | None            # 0–100, según el solver
    cota_inferior: float | None
    tiempo_s: float
    solucion: pd.DataFrame | None     # Clase, Materia, Profesor, Cohorte, Aula, Día, Inicio, Fin


def _crear_variables(model: cp_model.CpModel, datos: Datos) -> Variables:
    """Solo combinaciones válidas por construcción: D1 (franja), D2/D3 (aula compatible), D5 (disponible)."""
    v = Variables()
    for c_id, clase in datos.clases.items():
        dur = datos.duracion_slots(c_id)
        for dia, inicio in datos.inicios[c_id]:
            slot = datos.slot_de(inicio)
            ocupa = range(slot, slot + dur)
            yv = model.NewBoolVar("")  # sin nombre: ahorra mucha memoria con ~160k variables
            v.y[c_id, dia, slot] = yv
            v.y_por_clase.setdefault(c_id, []).append(yv)
            xs = []
            for aula_id in datos.aulas_compatibles[c_id]:
                xv = model.NewBoolVar("")
                v.x[c_id, aula_id, dia, slot] = xv
                xs.append(xv)
                for b in ocupa:
                    v.ocupacion_aula.setdefault((aula_id, dia, b), []).append(xv)
            model.Add(sum(xs) == yv)  # si la clase arranca ahí, va en exactamente un aula
            for b in ocupa:
                v.ocupacion_profesor.setdefault((clase["profesor_id"], dia, b), []).append(yv)
                v.ocupacion_cohorte.setdefault((clase["cohorte"], dia, b), []).append(yv)
            v.ocupacion_profesor_dia.setdefault((clase["profesor_id"], dia), []).append(
                (int(clase["duracion_min"]), yv))
    return v


def _agregar_duras(model: cp_model.CpModel, v: Variables, datos: Datos) -> dict[tuple[str, str], cp_model.IntVar]:
    """D1 una vez por clase; D4/D5/D6 sin superposición; D7 tope diario. Devuelve dia_activo (lo usa B4)."""
    for c_id in datos.clases:
        model.AddExactlyOne(v.y_por_clase.get(c_id, []))  # lista vacía -> infactible
    for ocupacion in (v.ocupacion_aula, v.ocupacion_profesor, v.ocupacion_cohorte):
        for variables in ocupacion.values():
            if len(variables) > 1:
                model.AddAtMostOne(variables)
    dia_activo = {}
    for (prof_id, dia), asignaciones in v.ocupacion_profesor_dia.items():
        dia_activo[prof_id, dia] = model.NewBoolVar("")
        model.Add(sum(d * var for d, var in asignaciones)
                  <= int(datos.docentes[prof_id]["max_min_por_dia"]) * dia_activo[prof_id, dia])
    return dia_activo


def _b2_huecos(model: cp_model.CpModel, v: Variables, datos: Datos) -> Any:
    """Slots libres entre la primera y la última clase del día de cada cohorte."""
    huecos = []
    for cohorte in datos.cohortes:
        for dia in datos.dias:
            slots = datos.slots_validos[dia]
            if not any(v.ocupacion_cohorte.get((cohorte, dia, s)) for s in slots):
                continue
            ocupado = [sum(v.ocupacion_cohorte.get((cohorte, dia, s), [])) for s in slots]
            antes = [model.NewBoolVar("") for _ in slots]    # ya tuvo clase en algún slot <= i
            despues = [model.NewBoolVar("") for _ in slots]  # todavía tiene clase en algún slot >= i
            for i in range(len(slots)):
                model.Add(antes[i] >= ocupado[i])
                model.Add(despues[i] >= ocupado[i])
                if i > 0:
                    model.Add(antes[i] >= antes[i - 1])
                if i < len(slots) - 1:
                    model.Add(despues[i] >= despues[i + 1])
                hueco = model.NewBoolVar("")
                model.Add(hueco >= antes[i] + despues[i] - 1 - ocupado[i])
                huecos.append(hueco)
    return sum(huecos)


def _b3_rachas(model: cp_model.CpModel, v: Variables, datos: Datos) -> Any:
    """Una ventana de W slots llena = un slot por encima de U."""
    w = UMBRAL_RACHA_MIN // SLOT_DURATION + 1
    rachas = []
    for prof_id in datos.clases_por_docente:
        for dia in datos.dias:
            for ventana in ventanas_racha(datos.slots_validos[dia]):
                terminos = [var for s in ventana for var in v.ocupacion_profesor.get((prof_id, dia, s), [])]
                if len(terminos) < w:
                    continue
                racha = model.NewBoolVar("")
                model.Add(racha >= sum(terminos) - (w - 1))
                rachas.append(racha)
    return sum(rachas)


def _b6_una_materia(model: cp_model.CpModel, v: Variables, datos: Datos) -> Any:
    """Días en que un docente con 2+ materias dicta una sola."""
    materias_prof = materias_por_docente(datos)
    y_por_materia: dict[tuple[str, str, str], list[cp_model.IntVar]] = {}
    for (c_id, dia, _), yv in v.y.items():
        clase = datos.clases[c_id]
        y_por_materia.setdefault((clase["profesor_id"], dia, clase["materia"]), []).append(yv)
    dias_una_materia = []
    for prof_id, dia in v.ocupacion_profesor_dia:
        if len(materias_prof[prof_id]) < 2:
            continue
        ms = []
        for materia in materias_prof[prof_id]:
            vs = y_por_materia.get((prof_id, dia, materia))
            if not vs:
                continue
            m = model.NewBoolVar("")
            for yv in vs:
                model.Add(m >= yv)
            model.Add(m <= sum(vs))
            ms.append(m)
        una_sola = model.NewBoolVar("")
        for i, mi in enumerate(ms):
            model.Add(una_sola >= mi - sum(ms[:i] + ms[i + 1:]))
        dias_una_materia.append(una_sola)
    return sum(dias_una_materia)


def _blandas(model: cp_model.CpModel, v: Variables, datos: Datos,
             dia_activo: dict[tuple[str, str], cp_model.IntVar]) -> dict[str, Any]:
    cl, au = datos.clases, datos.aulas
    claves_x = list(v.x)
    lab_sin_necesidad = [(var, datos.duracion_slots(c)) for (c, a, _, _), var in v.x.items()
                         if not cl[c]["requiere_laboratorio"] and au[a]["es_laboratorio"]]
    return {
        "B1": cp_model.LinearExpr.WeightedSum(
            [v.x[k] for k in claves_x],
            [(int(au[a]["capacidad"]) - int(cl[c]["cantidad_alumnos"])) * datos.duracion_slots(c)
             for c, a, _, _ in claves_x]),
        "B2": _b2_huecos(model, v, datos),
        "B3": _b3_rachas(model, v, datos),
        "B4": sum(dia_activo.values()) - sum(minimo_dias(datos).values()),
        "B5": cp_model.LinearExpr.WeightedSum([var for var, _ in lab_sin_necesidad],
                                              [k for _, k in lab_sin_necesidad]) if lab_sin_necesidad else 0,
        "B6": _b6_una_materia(model, v, datos),
    }


def construir_modelo(datos: Datos) -> tuple[cp_model.CpModel, Variables]:
    """objetivo = Σ peso_i × B_i / peor_caso_i (0 = ideal, 100 = peor caso en todas a la vez)."""
    model = cp_model.CpModel()
    v = _crear_variables(model, datos)
    dia_activo = _agregar_duras(model, v, datos)
    blandas = _blandas(model, v, datos, dia_activo)
    maximos = maximos_blandas(datos)
    coef = {b: max(1, round(PESOS[b] * ESCALA / maximos[b])) if maximos[b] > 0 else 0 for b in PESOS}
    model.Minimize(sum(coef[b] * blandas[b] for b in PESOS))
    return model, v


def _extraer_solucion(solver: cp_model.CpSolver, v: Variables, datos: Datos) -> pd.DataFrame:
    filas = []
    for (c_id, aula_id, dia, slot), var in v.x.items():
        if solver.BooleanValue(var):
            clase = datos.clases[c_id]
            ini = datos.minuto_de(slot)
            filas.append({"Clase": c_id, "Materia": clase["materia"], "Profesor": clase["profesor_id"],
                          "Cohorte": clase["cohorte"], "Aula": aula_id, "Día": dia,
                          "Inicio": mins_to_hhmm(ini), "Fin": mins_to_hhmm(ini + int(clase["duracion_min"]))})
    orden_dias = {d: i for i, d in enumerate(datos.dias)}
    return (pd.DataFrame(filas)
            .sort_values(["Día", "Inicio", "Aula"], key=lambda s: s.map(orden_dias) if s.name == "Día" else s)
            .reset_index(drop=True))


def resolver(datos: Datos, tiempo_s: float, workers: int = 8, semilla: int = 0) -> Resultado:
    """Arma y resuelve el modelo, siempre con límite de tiempo."""
    model, v = construir_modelo(datos)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = tiempo_s
    solver.parameters.num_workers = workers
    solver.parameters.random_seed = semilla
    status = solver.Solve(model)
    hay_solucion = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    return Resultado(
        estado=solver.StatusName(status),
        objetivo=solver.ObjectiveValue() / ESCALA if hay_solucion else None,
        # Todas las blandas son >= 0: la cota útil nunca es menor que 0
        cota_inferior=max(0.0, solver.BestObjectiveBound()) / ESCALA if hay_solucion else None,
        tiempo_s=solver.WallTime(),
        solucion=_extraer_solucion(solver, v, datos) if hay_solucion else None,
    )
