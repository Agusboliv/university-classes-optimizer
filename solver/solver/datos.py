"""Carga, validación y preparación de los CSV (Parte 1 del notebook)."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

# Parámetros compartidos por el modelo y la verificación
SLOT_DURATION = 30      # resolución de la grilla (min): horas y duraciones son múltiplo
K_AULAS = 10            # aulas candidatas por clase: las K compatibles más chicas
UMBRAL_RACHA_MIN = 360  # U de B3
PESOS = {"B1": 17.5, "B2": 22.5, "B3": 22.5, "B4": 12, "B5": 17.5, "B6": 8}
NOMBRES_BLANDAS = {
    "B1": "asientos vacíos (asiento·slot)",
    "B2": "huecos de cohorte (slots)",
    "B3": "racha docente > U (slots)",
    "B4": "días extra de docentes",
    "B5": "laboratorio sin necesitarlo (slots)",
    "B6": "días con una sola materia (docentes 2+ materias)",
}

ESQUEMA = {
    "aulas.csv": ["aula_id", "nombre", "edificio", "capacidad", "tiene_proyector", "es_laboratorio"],
    "clases.csv": ["clase_id", "materia", "cohorte", "carrera", "anio", "tipo", "cantidad_alumnos",
                   "franja", "duracion_min", "profesor_id", "requiere_proyector", "requiere_laboratorio"],
    "franjas.csv": ["dia", "franja", "hora_inicio", "hora_fin"],
    "profesores.csv": ["profesor_id", "nombre", "dedicacion", "max_min_por_dia"],
    "disponibilidad_profesores.csv": ["profesor_id", "dia", "hora_desde", "hora_hasta"],
}
BINARIAS = {
    "aulas.csv": ["tiene_proyector", "es_laboratorio"],
    "clases.csv": ["requiere_proyector", "requiere_laboratorio"],
}
NUMERICAS = {
    "aulas.csv": ["capacidad"],
    "clases.csv": ["cantidad_alumnos", "duracion_min"],
    "profesores.csv": ["max_min_por_dia"],
}
CLAVES = {"aulas.csv": "aula_id", "clases.csv": "clase_id", "profesores.csv": "profesor_id"}
HORAS = {
    "franjas.csv": [("hora_inicio", "hora_fin")],
    "disponibilidad_profesores.csv": [("hora_desde", "hora_hasta")],
}

Tablas = dict[str, pd.DataFrame]
Problemas = tuple[list[str], list[str]]  # (errores, advertencias)


# --- Horas -------------------------------------------------------------------

def time_to_mins(t_str: object) -> int:
    """'HH:MM' -> minutos desde las 00:00. Lanza ValueError si el formato no es válido."""
    t_str = str(t_str)
    if not re.fullmatch(r"\d{2}:\d{2}", t_str):
        raise ValueError(f"hora inválida: {t_str!r} (formato HH:MM con dos dígitos, ej. '08:00')")
    h, m = map(int, t_str.split(":"))
    if h > 23 or m > 59:
        raise ValueError(f"hora inválida: {t_str!r} (formato HH:MM con dos dígitos, ej. '08:00')")
    return h * 60 + m


def mins_to_hhmm(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


# --- Carga -------------------------------------------------------------------

def cargar_csvs(carpeta: str | Path) -> Tablas:
    """Lee los CSV del ESQUEMA que existan en la carpeta. Los que faltan los reporta validar()."""
    carpeta = Path(carpeta)
    return {n: pd.read_csv(carpeta / n, encoding="utf-8") for n in ESQUEMA if (carpeta / n).exists()}


# --- Helpers compartidos -----------------------------------------------------

def ventanas_de(fr: pd.DataFrame) -> dict[tuple[str, str], tuple[int, int]]:
    """(día, franja) -> (minuto de inicio, minuto de fin)."""
    return {(r.dia, r.franja): (time_to_mins(r.hora_inicio), time_to_mins(r.hora_fin))
            for r in fr.itertuples()}


def minutos_disponibles_de(dp: pd.DataFrame) -> dict[tuple[str, str], set[int]]:
    """(docente, día) -> minutos disponibles (múltiplos de SLOT_DURATION)."""
    libres: dict[tuple[str, str], set[int]] = {}
    for r in dp.itertuples():
        libres.setdefault((r.profesor_id, r.dia), set()).update(
            range(time_to_mins(r.hora_desde), time_to_mins(r.hora_hasta), SLOT_DURATION))
    return libres


def _aulas_compatibles(au: pd.DataFrame, clase: Any) -> pd.DataFrame:
    """D2 capacidad y D3 proyector/laboratorio. Usar un lab sin necesitarlo se penaliza en B5."""
    ok = au[au.capacidad >= clase.cantidad_alumnos]
    if clase.requiere_laboratorio:
        ok = ok[ok.es_laboratorio == 1]
    if clase.requiere_proyector:
        ok = ok[ok.tiene_proyector == 1]
    return ok


def _inicios_posibles(franja: str, duracion: int, profesor: str,
                      ventanas: dict[tuple[str, str], tuple[int, int]],
                      libres: dict[tuple[str, str], set[int]]) -> list[tuple[str, int]]:
    """(día, minuto de inicio) donde la clase entra en su franja (D1) con el docente disponible (D5)."""
    return [(dia, t0)
            for (dia, f), (a, b) in ventanas.items() if f == franja
            for t0 in range(a, b - duracion + 1, SLOT_DURATION)
            if all(t in libres.get((profesor, dia), ()) for t in range(t0, t0 + duracion, SLOT_DURATION))]


# --- Validación ----------------------------------------------------------------

def _validar_estructura(dfs: Tablas) -> Problemas:
    errores: list[str] = []
    for nombre, cols in ESQUEMA.items():
        if nombre not in dfs:
            errores.append(f"{nombre}: archivo no cargado")
            continue
        df = dfs[nombre]
        faltan = [c for c in cols if c not in df.columns]
        if faltan:
            errores.append(f"{nombre}: faltan columnas {faltan}")
        if df.empty:
            errores.append(f"{nombre}: está vacío")
        for col, n in df[[c for c in cols if c in df.columns]].isna().sum().items():
            if n:
                errores.append(f"{nombre}: columna '{col}' tiene {n} valores vacíos")
        clave = CLAVES.get(nombre)
        if clave in df.columns and (dup := df[clave].duplicated().sum()):
            errores.append(f"{nombre}: {dup} IDs duplicados en '{clave}'")
        for col in BINARIAS.get(nombre, []):
            if col in df.columns and not df[col].isin([0, 1]).all():
                errores.append(f"{nombre}: '{col}' debe ser 0/1")
        for col in NUMERICAS.get(nombre, []):
            if col in df.columns and pd.to_numeric(df[col].dropna(), errors="coerce").isna().any():
                errores.append(f"{nombre}: '{col}' tiene valores no numéricos")
    return errores, []


def _validar_valores(dfs: Tablas) -> Problemas:
    errores: list[str] = []
    if (dfs["aulas.csv"].capacidad <= 0).any():
        errores.append("aulas.csv: hay capacidades <= 0")
    c = dfs["clases.csv"]
    if (c.cantidad_alumnos <= 0).any():
        errores.append("clases.csv: hay clases con cantidad_alumnos <= 0")
    if (c.duracion_min <= 0).any():
        errores.append("clases.csv: duracion_min debe ser > 0")
    malas = c.clase_id[c.duracion_min % SLOT_DURATION != 0].tolist()
    if malas:
        errores.append(f"clases.csv: duraciones que no son múltiplo de {SLOT_DURATION} min: {malas[:10]}")
    if (dfs["profesores.csv"].max_min_por_dia <= 0).any():
        errores.append("profesores.csv: max_min_por_dia debe ser > 0")
    for nombre, pares in HORAS.items():
        for col_ini, col_fin in pares:
            for i, r in dfs[nombre].iterrows():
                try:
                    a, b = time_to_mins(r[col_ini]), time_to_mins(r[col_fin])
                except ValueError as e:
                    errores.append(f"{nombre} fila {i}: {e}")
                    continue
                if a % SLOT_DURATION or b % SLOT_DURATION:
                    errores.append(f"{nombre} fila {i}: horas que no son múltiplo de {SLOT_DURATION} min")
                if a >= b:
                    errores.append(f"{nombre} fila {i}: '{col_ini}' tiene que ser menor que '{col_fin}'")
    return errores, []


def _validar_integridad(dfs: Tablas) -> Problemas:
    errores: list[str] = []
    advertencias: list[str] = []
    cl, pr = dfs["clases.csv"], dfs["profesores.csv"]
    dp, fr = dfs["disponibilidad_profesores.csv"], dfs["franjas.csv"]
    if sin_prof := set(cl.profesor_id) - set(pr.profesor_id):
        errores.append(f"clases.csv: docentes que no existen en profesores.csv: {sorted(sin_prof)}")
    if franjas_malas := set(cl.franja) - set(fr.franja):
        errores.append(f"clases.csv: franjas que no existen en franjas.csv: {sorted(franjas_malas)}")
    if dup := fr.duplicated(["dia", "franja"]).sum():
        errores.append(f"franjas.csv: {dup} filas repetidas para el mismo día y franja")
    if dias_malos := set(dp.dia) - set(fr.dia):
        errores.append(f"disponibilidad_profesores.csv: días que no están en franjas.csv: {sorted(dias_malos)}")
    if desconocidos := set(dp.profesor_id) - set(pr.profesor_id):
        errores.append("disponibilidad_profesores.csv: docentes que no existen en profesores.csv: "
                       f"{sorted(desconocidos)}")
    if sin_disp := set(pr.profesor_id) - set(dp.profesor_id):
        advertencias.append(f"Docentes sin filas de disponibilidad: {sorted(sin_disp)}")
    if sin_clases := set(pr.profesor_id) - set(cl.profesor_id):
        advertencias.append(f"{len(sin_clases)} docentes no tienen clases asignadas")
    return errores, advertencias


def _chequear_factibilidad(dfs: Tablas) -> Problemas:
    """Condiciones necesarias: cada clase tiene algún aula (D2, D3) y algún inicio (D1, D5, D7)."""
    errores: list[str] = []
    au, cl = dfs["aulas.csv"], dfs["clases.csv"]
    max_dia = dfs["profesores.csv"].set_index("profesor_id").max_min_por_dia
    ventanas = ventanas_de(dfs["franjas.csv"])
    libres = minutos_disponibles_de(dfs["disponibilidad_profesores.csv"])
    for c in cl.itertuples():
        if _aulas_compatibles(au, c).empty:
            errores.append(f"Clase {c.clase_id} ({c.materia}, {c.cantidad_alumnos} alumnos): "
                           "no hay ningún aula compatible")
        if c.duracion_min > max_dia[c.profesor_id]:
            errores.append(f"Clase {c.clase_id}: dura {c.duracion_min} min, "
                           f"más que el max_min_por_dia de {c.profesor_id}")
        elif not any(f == c.franja and b - a >= c.duracion_min for (_, f), (a, b) in ventanas.items()):
            errores.append(f"Clase {c.clase_id}: dura {c.duracion_min} min y no entra en la franja {c.franja}")
        elif not _inicios_posibles(c.franja, int(c.duracion_min), c.profesor_id, ventanas, libres):
            errores.append(f"Clase {c.clase_id} ({c.materia}): {c.profesor_id} no tiene ningún hueco de "
                           f"{c.duracion_min} min en la franja {c.franja}")
    return errores, []


def validar(dfs: Tablas) -> Problemas:
    """Corre las etapas en orden; cada una solo si las anteriores no dieron errores."""
    errores: list[str] = []
    advertencias: list[str] = []
    for etapa in (_validar_estructura, _validar_valores, _validar_integridad, _chequear_factibilidad):
        e, a = etapa(dfs)
        errores += e
        advertencias += a
        if errores:
            break
    return errores, advertencias


# --- Estructuras para el modelo y la verificación ------------------------------

@dataclass(frozen=True)
class Datos:
    aulas: dict[str, dict[str, Any]]
    clases: dict[str, dict[str, Any]]
    docentes: dict[str, dict[str, Any]]
    dias: list[str]                                     # orden del archivo (LUN, MAR, ...)
    ventanas: dict[tuple[str, str], tuple[int, int]]    # (día, franja) -> (min inicio, min fin)
    minutos_disponibles: dict[tuple[str, str], set[int]]
    aulas_compatibles: dict[str, list[str]]             # las K_AULAS compatibles más chicas
    cohortes: dict[str, list[str]]
    clases_por_docente: dict[str, list[str]]
    inicios: dict[str, list[tuple[str, int]]]           # clase -> (día, minuto) válidos por D1 y D5
    min_inicio: int                                     # minuto del slot 0
    slots_validos: dict[str, list[int]]                 # día -> slots dentro de alguna franja

    def slot_de(self, minuto: int) -> int:
        return (minuto - self.min_inicio) // SLOT_DURATION

    def minuto_de(self, slot: int) -> int:
        return self.min_inicio + slot * SLOT_DURATION

    def duracion_slots(self, clase_id: str) -> int:
        return int(self.clases[clase_id]["duracion_min"]) // SLOT_DURATION


def preparar_datos(dfs: Tablas) -> Datos:
    """Convierte tablas ya validadas en diccionarios listos para el modelo."""
    au, cl = dfs["aulas.csv"], dfs["clases.csv"]
    fr, pr = dfs["franjas.csv"], dfs["profesores.csv"]
    ventanas = ventanas_de(fr)
    libres = minutos_disponibles_de(dfs["disponibilidad_profesores.csv"])
    min_inicio = min(a for a, _ in ventanas.values())
    dias = list(dict.fromkeys(fr.dia))
    # Los cortes entre franjas (ej. el almuerzo) quedan fuera: no se usan ni cuentan como hueco en B2
    slots_validos = {
        d: sorted({(t - min_inicio) // SLOT_DURATION
                   for (dd, _), (a, b) in ventanas.items() if dd == d
                   for t in range(a, b, SLOT_DURATION)})
        for d in dias
    }
    return Datos(
        aulas=au.set_index("aula_id").to_dict("index"),
        clases=cl.set_index("clase_id").to_dict("index"),
        docentes=pr.set_index("profesor_id").to_dict("index"),
        dias=dias,
        ventanas=ventanas,
        minutos_disponibles=libres,
        aulas_compatibles={c.clase_id: list(_aulas_compatibles(au, c).sort_values("capacidad").aula_id[:K_AULAS])
                           for c in cl.itertuples()},
        cohortes={k: list(v.clase_id) for k, v in cl.groupby("cohorte")},
        clases_por_docente={k: list(v.clase_id) for k, v in cl.groupby("profesor_id")},
        inicios={c.clase_id: _inicios_posibles(c.franja, int(c.duracion_min), c.profesor_id, ventanas, libres)
                 for c in cl.itertuples()},
        min_inicio=min_inicio,
        slots_validos=slots_validos,
    )


# --- Derivados que usan B3, B4 y B6 (modelo y verificación) ----------------------

def ventanas_racha(slots: list[int]) -> list[list[int]]:
    """Ventanas de W = U/slot + 1 slots consecutivos que no cruzan un corte entre franjas."""
    w = UMBRAL_RACHA_MIN // SLOT_DURATION + 1
    return [slots[i:i + w] for i in range(len(slots) - w + 1) if slots[i + w - 1] - slots[i] == w - 1]


def minimo_dias(datos: Datos) -> dict[str, int]:
    """Días mínimos de cada docente: ⌈minutos totales / max_min_por_dia⌉."""
    return {p: math.ceil(sum(int(datos.clases[c]["duracion_min"]) for c in cs)
                         / int(datos.docentes[p]["max_min_por_dia"]))
            for p, cs in datos.clases_por_docente.items()}


def materias_por_docente(datos: Datos) -> dict[str, set[str]]:
    return {p: {datos.clases[c]["materia"] for c in cs} for p, cs in datos.clases_por_docente.items()}
