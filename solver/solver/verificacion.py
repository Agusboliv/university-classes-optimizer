"""Postcondiciones independientes del modelo: D1–D7 y valor real de B1–B6.

Trabaja solo con los datos y la grilla de la solución (Clase, Aula, Día, Inicio);
no usa ninguna variable de CP-SAT.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

import pandas as pd

from solver.datos import (
    NOMBRES_BLANDAS, PESOS, SLOT_DURATION, UMBRAL_RACHA_MIN, Datos,
    materias_por_docente, minimo_dias, time_to_mins, ventanas_racha,
)

COLUMNAS_SOLUCION = ["Clase", "Aula", "Día", "Inicio"]


# --- D1–D7 ---------------------------------------------------------------------

def _problemas_de_asignacion(datos: Datos, c_id: str, aula_id: str, dia: str, ini: int) -> list[str]:
    """D1 (franja y grilla), D2, D3 y disponibilidad de D5 para una sola asignación."""
    clase, aula = datos.clases[c_id], datos.aulas[aula_id]
    fin = ini + int(clase["duracion_min"])
    problemas = []
    if ini % SLOT_DURATION:
        problemas.append(f"D1: {c_id} empieza fuera de la grilla de {SLOT_DURATION} min")
    franja = datos.ventanas.get((dia, clase["franja"]))
    if franja is None or not (franja[0] <= ini and fin <= franja[1]):
        problemas.append(f"D1: {c_id} queda fuera de su franja")
    if aula["capacidad"] < clase["cantidad_alumnos"]:
        problemas.append(f"D2: {c_id} no entra en {aula_id}")
    if aula["tiene_proyector"] < clase["requiere_proyector"] or aula["es_laboratorio"] < clase["requiere_laboratorio"]:
        problemas.append(f"D3: {c_id} en {aula_id} sin proyector o laboratorio")
    libres = datos.minutos_disponibles.get((clase["profesor_id"], dia), set())
    if any(t not in libres for t in range(ini, fin, SLOT_DURATION)):
        problemas.append(f"D5: {clase['profesor_id']} no está disponible para {c_id}")
    return problemas


def verificar_solucion(datos: Datos, solucion: pd.DataFrame) -> list[str]:
    """Lista de violaciones de D1–D7 (vacía = la solución es válida)."""
    if faltan := [c for c in COLUMNAS_SOLUCION if c not in solucion.columns]:
        return [f"solución: faltan columnas {faltan}"]
    problemas: list[str] = []
    if sorted(map(str, solucion["Clase"])) != sorted(datos.clases):
        problemas.append("D1: hay clases sin asignar o asignadas más de una vez")
    uso: dict[tuple[str, str, str, int], str] = {}
    minutos_dia: Counter[tuple[str, str]] = Counter()
    for c_id, aula_id, dia, ini_txt in zip(*(solucion[c] for c in COLUMNAS_SOLUCION)):
        if c_id not in datos.clases or aula_id not in datos.aulas:
            problemas.append(f"D1: clase {c_id} o aula {aula_id} desconocida")
            continue
        try:
            ini = time_to_mins(ini_txt)
        except ValueError as e:
            problemas.append(f"D1: {c_id}: {e}")
            continue
        problemas += _problemas_de_asignacion(datos, c_id, aula_id, dia, ini)
        clase = datos.clases[c_id]
        duracion = int(clase["duracion_min"])
        for t in range(ini, ini + duracion, SLOT_DURATION):
            for regla, recurso in (("D4", aula_id), ("D5", clase["profesor_id"]), ("D6", clase["cohorte"])):
                k = (regla, recurso, dia, t)
                if k in uso:
                    problemas.append(f"{regla}: {c_id} se superpone con {uso[k]} ({recurso}, {dia})")
                uso[k] = c_id
        minutos_dia[clase["profesor_id"], dia] += duracion
    for (prof_id, dia), mins in minutos_dia.items():
        if mins > int(datos.docentes[prof_id]["max_min_por_dia"]):
            problemas.append(f"D7: {prof_id} da {mins} min el {dia}")
    return problemas


# --- B1–B6 ---------------------------------------------------------------------

def _asignaciones(datos: Datos, solucion: pd.DataFrame) -> list[tuple[str, str, str, int]]:
    """(clase, aula, día, slot de inicio) de cada fila."""
    return [(c, a, d, datos.slot_de(time_to_mins(i)))
            for c, a, d, i in zip(*(solucion[col] for col in COLUMNAS_SOLUCION))]


def _huecos(slots: list[int], ocupados: set[int]) -> int:
    """Slots válidos libres entre la primera y la última clase del día."""
    idx = [i for i, s in enumerate(slots) if s in ocupados]
    return sum(1 for i in range(idx[0], idx[-1] + 1) if slots[i] not in ocupados) if idx else 0


def valores_blandas(datos: Datos, solucion: pd.DataFrame) -> dict[str, int]:
    """Valor real de cada blanda en la solución (supone que ya pasó verificar_solucion)."""
    asig = _asignaciones(datos, solucion)
    cl, au = datos.clases, datos.aulas
    ocup_coh: dict[tuple[str, str], set[int]] = {}
    ocup_prof: dict[tuple[str, str], set[int]] = {}
    materias_dia: dict[tuple[str, str], set[str]] = {}
    for c, _, d, s in asig:
        slots = range(s, s + datos.duracion_slots(c))
        ocup_coh.setdefault((cl[c]["cohorte"], d), set()).update(slots)
        ocup_prof.setdefault((cl[c]["profesor_id"], d), set()).update(slots)
        materias_dia.setdefault((cl[c]["profesor_id"], d), set()).add(cl[c]["materia"])
    materias_prof = materias_por_docente(datos)
    return {
        "B1": sum((int(au[a]["capacidad"]) - int(cl[c]["cantidad_alumnos"])) * datos.duracion_slots(c)
                  for c, a, _, _ in asig),
        "B2": sum(_huecos(datos.slots_validos[d], occ) for (_, d), occ in ocup_coh.items()),
        "B3": sum(1 for (_, d), occ in ocup_prof.items()
                  for w in ventanas_racha(datos.slots_validos[d]) if all(s in occ for s in w)),
        "B4": len(ocup_prof) - sum(minimo_dias(datos).values()),
        "B5": sum(datos.duracion_slots(c) for c, a, _, _ in asig
                  if not cl[c]["requiere_laboratorio"] and au[a]["es_laboratorio"]),
        "B6": sum(1 for (p, _), ms in materias_dia.items() if len(materias_prof[p]) >= 2 and len(ms) == 1),
    }


def maximos_blandas(datos: Datos) -> dict[str, int]:
    """Peor caso de cada blanda (normaliza el objetivo). Mismas cotas que el modelo del notebook."""
    cl, au, compat = datos.clases, datos.aulas, datos.aulas_compatibles
    w = UMBRAL_RACHA_MIN // SLOT_DURATION + 1
    dias_cohorte = {(cl[c]["cohorte"], d) for c, inis in datos.inicios.items() for d, _ in inis}
    # Cuántos inicios posibles de cada docente cubren cada slot (= términos de la ventana en B3)
    cobertura: Counter[tuple[str, str, int]] = Counter()
    for c, inis in datos.inicios.items():
        for d, t0 in inis:
            s = datos.slot_de(t0)
            for b in range(s, s + datos.duracion_slots(c)):
                cobertura[cl[c]["profesor_id"], d, b] += 1
    dias_prof = {(p, d) for p, d, _ in cobertura}
    dias_posibles = Counter(p for p, _ in dias_prof)
    minimo = minimo_dias(datos)
    materias_prof = materias_por_docente(datos)
    exceso_max = {p: max(0, int(v["max_min_por_dia"]) - UMBRAL_RACHA_MIN) // SLOT_DURATION
                  for p, v in datos.docentes.items()}
    return {
        "B1": sum(max((int(au[a]["capacidad"]) - int(cl[c]["cantidad_alumnos"])) * datos.duracion_slots(c)
                      for a in compat[c]) for c in cl if compat[c]),
        "B2": sum(max(len(datos.slots_validos[d]) - 2, 0) for _, d in dias_cohorte),
        "B3": sum(min(sum(1 for v in ventanas_racha(datos.slots_validos[d])
                          if sum(cobertura[p, d, s] for s in v) >= w), exceso_max[p])
                  for p, d in dias_prof),
        "B4": sum(max(0, min(dias_posibles[p], len(cs)) - minimo[p]) for p, cs in datos.clases_por_docente.items()),
        "B5": sum(datos.duracion_slots(c) for c in cl
                  if not cl[c]["requiere_laboratorio"] and any(au[a]["es_laboratorio"] for a in compat[c])),
        "B6": sum(min(dias_posibles[p], len(cs)) for p, cs in datos.clases_por_docente.items()
                  if len(materias_prof[p]) >= 2),
    }


def evaluar_blandas(datos: Datos, solucion: pd.DataFrame) -> list[dict[str, Any]]:
    """Desglose del objetivo: puntos = peso × valor / peor caso (objetivo total de 0 a 100)."""
    valores, maximos = valores_blandas(datos, solucion), maximos_blandas(datos)
    return [{"id": b, "nombre": NOMBRES_BLANDAS[b], "valor": valores[b], "maximo": maximos[b],
             "peso": PESOS[b], "puntos": PESOS[b] * valores[b] / maximos[b] if maximos[b] else 0.0}
            for b in PESOS]
