from pathlib import Path

import pandas as pd
import pytest

from solver.datos import cargar_csvs, preparar_datos, validar
from solver.modelo import resolver
from solver.verificacion import evaluar_blandas, verificar_solucion

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"

AULAS = ["aula_id", "nombre", "edificio", "capacidad", "tiene_proyector", "es_laboratorio"]
CLASES = ["clase_id", "materia", "cohorte", "carrera", "anio", "tipo", "cantidad_alumnos",
          "franja", "duracion_min", "profesor_id", "requiere_proyector", "requiere_laboratorio"]


def _caso_chico(aulas: list[tuple], clases: list[tuple], disponibilidad: list[tuple]) -> dict[str, pd.DataFrame]:
    """Un solo día (LUN): mañana 08:00-10:00 y tarde 14:00-15:00. Docentes con tope de 480 min."""
    docentes = sorted({c[9] for c in clases})
    return {
        "aulas.csv": pd.DataFrame(aulas, columns=AULAS),
        "clases.csv": pd.DataFrame(clases, columns=CLASES),
        "franjas.csv": pd.DataFrame([("LUN", "mañana", "08:00", "10:00"), ("LUN", "tarde", "14:00", "15:00")],
                                    columns=["dia", "franja", "hora_inicio", "hora_fin"]),
        "profesores.csv": pd.DataFrame([(p, p, "simple", 480) for p in docentes],
                                       columns=["profesor_id", "nombre", "dedicacion", "max_min_por_dia"]),
        "disponibilidad_profesores.csv": pd.DataFrame(
            disponibilidad, columns=["profesor_id", "dia", "hora_desde", "hora_hasta"]),
    }


def test_caso_factible_da_la_unica_solucion_optima():
    # C1 (25 alumnos, 120 min) solo puede empezar 08:00 y B1 prefiere el aula chica A1.
    # C2 (80 alumnos) solo entra en A2 y solo puede empezar 14:00.
    dfs = _caso_chico(
        aulas=[("A1", "Chica", "X", 30, 1, 0), ("A2", "Grande", "X", 100, 1, 0)],
        clases=[("C1", "Física", "K1", "Ing", 1, "teórica", 25, "mañana", 120, "P1", 1, 0),
                ("C2", "Química", "K2", "Ing", 1, "teórica", 80, "tarde", 60, "P1", 1, 0)],
        disponibilidad=[("P1", "LUN", "08:00", "15:00")],
    )
    assert validar(dfs)[0] == []
    datos = preparar_datos(dfs)

    resultado = resolver(datos, tiempo_s=10, workers=1)

    assert resultado.estado == "OPTIMAL"
    asignadas = resultado.solucion[["Clase", "Aula", "Día", "Inicio"]].values.tolist()
    assert asignadas == [["C1", "A1", "LUN", "08:00"], ["C2", "A2", "LUN", "14:00"]]
    assert verificar_solucion(datos, resultado.solucion) == []
    # El objetivo del solver coincide con el recalculado sin el modelo
    recalculado = sum(b["puntos"] for b in evaluar_blandas(datos, resultado.solucion))
    assert resultado.objetivo == pytest.approx(recalculado, abs=1e-3)


def test_caso_infactible_dos_clases_de_la_misma_cohorte_en_un_solo_horario():
    # Cada clase por separado tiene horario (pasa la validación), pero las dos
    # ocupan toda la mañana y son de la misma cohorte: D6 lo hace infactible.
    dfs = _caso_chico(
        aulas=[("A1", "Aula 1", "X", 50, 1, 0), ("A2", "Aula 2", "X", 50, 1, 0)],
        clases=[("C1", "Física", "K1", "Ing", 1, "teórica", 20, "mañana", 120, "P1", 0, 0),
                ("C2", "Química", "K1", "Ing", 1, "teórica", 20, "mañana", 120, "P2", 0, 0)],
        disponibilidad=[("P1", "LUN", "08:00", "10:00"), ("P2", "LUN", "08:00", "10:00")],
    )
    assert validar(dfs)[0] == []

    resultado = resolver(preparar_datos(dfs), tiempo_s=10, workers=1)

    assert resultado.estado == "INFEASIBLE"
    assert resultado.solucion is None

# Desglose de la solución de referencia (CLAUDE.md: objetivo 21.37/100)
DESGLOSE_REFERENCIA = {"B1": 8.70, "B2": 0.25, "B3": 0.05, "B4": 7.72, "B5": 0.00, "B6": 4.65}


def test_solucion_de_referencia_cumple_duras_y_da_el_desglose_esperado():
    dfs = cargar_csvs(RAIZ / "data")
    errores, _ = validar(dfs)
    assert errores == []
    datos = preparar_datos(dfs)
    solucion = pd.read_csv(FIXTURES / "solucion_horarios.csv", encoding="utf-8")

    assert verificar_solucion(datos, solucion) == []

    desglose = {b["id"]: b["puntos"] for b in evaluar_blandas(datos, solucion)}
    assert desglose == pytest.approx(DESGLOSE_REFERENCIA, abs=0.006)
    assert sum(desglose.values()) == pytest.approx(21.37, abs=0.02)
