"""CLI: resuelve un caso y guarda el escenario en JSON (y, con --csv, la solución en CSV).

    python -m solver.generar_escenario --data ../data --tiempo 120 --csv
    python -m solver.generar_escenario --data ../data --desde-json ../data/escenarios/referencia.json --csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

from solver.datos import Datos, cargar_csvs, preparar_datos, validar
from solver.modelo import Resultado, resolver
from solver.verificacion import evaluar_blandas, verificar_solucion

# Columnas del CSV de solución (las mismas que arma modelo._extraer_solucion)
COLUMNAS_CSV = {"clase": "Clase", "materia": "Materia", "profesor": "Profesor", "cohorte": "Cohorte",
                "aula": "Aula", "dia": "Día", "inicio": "Inicio", "fin": "Fin"}


def escribir_csv(solucion: pd.DataFrame, ruta: Path) -> None:
    solucion[list(COLUMNAS_CSV.values())].to_csv(ruta, index=False, encoding="utf-8")
    print(f"Solución en CSV guardada en {ruta}")


def exportar_desde_json(datos: Datos, ruta_json: Path, salida: Path | None) -> int:
    """Escribe el CSV de un escenario ya generado (misma corrida, sin volver a resolver)."""
    escenario = json.loads(ruta_json.read_text(encoding="utf-8"))
    solucion = pd.DataFrame(escenario["asignaciones"]).rename(columns=COLUMNAS_CSV)
    if problemas := verificar_solucion(datos, solucion):
        print(f"El escenario no pasa D1-D7 ({len(problemas)} problemas): no se exporta.")
        return 1
    escribir_csv(solucion, (salida or ruta_json.parent) / f"{ruta_json.stem}.csv")
    return 0


def armar_escenario(resultado: Resultado, desglose: list[dict[str, Any]], problemas: list[str],
                    tiempo_limite_s: float, workers: int) -> dict[str, Any]:
    sol = resultado.solucion
    asignaciones = [] if sol is None else [
        {"clase": r["Clase"], "materia": r["Materia"], "cohorte": r["Cohorte"], "profesor": r["Profesor"],
         "aula": r["Aula"], "dia": r["Día"], "inicio": r["Inicio"], "fin": r["Fin"]}
        for r in sol.to_dict("records")]
    return {
        "resultado": {"estado": resultado.estado, "objetivo": resultado.objetivo,
                      "cota_inferior": resultado.cota_inferior, "tiempo_s": round(resultado.tiempo_s, 2),
                      "tiempo_limite_s": tiempo_limite_s, "workers": workers},
        "desglose": desglose,
        "verificacion": {"ok": sol is not None and not problemas, "problemas": problemas},
        "asignaciones": asignaciones,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Genera un escenario JSON con la mejor solución encontrada.")
    p.add_argument("--data", type=Path, default=Path("../data"), help="carpeta con los 5 CSV")
    p.add_argument("--tiempo", type=float, default=120, help="límite del solver en segundos")
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--semilla", type=int, default=0)
    p.add_argument("--nombre", default="referencia", help="nombre del escenario (archivo .json)")
    p.add_argument("--salida", type=Path, default=None, help="carpeta de salida (por defecto <data>/escenarios)")
    p.add_argument("--forzar", action="store_true",
                   help="guarda el escenario aunque la solución no pase la verificación D1-D7 (para depurar)")
    p.add_argument("--csv", action="store_true",
                   help="guarda también <nombre>.csv con la solución (Clase, Materia, Profesor, Cohorte, Aula, Día, Inicio, Fin)")
    p.add_argument("--desde-json", type=Path, default=None,
                   help="no resuelve: exporta a CSV las asignaciones de un escenario ya generado (misma corrida)")
    args = p.parse_args(argv)
    if args.desde_json and not args.csv:
        p.error("--desde-json solo exporta el CSV: agregá --csv")

    dfs = cargar_csvs(args.data)
    errores, advertencias = validar(dfs)
    for a in advertencias:
        print("AVISO:", a)
    if errores:
        for e in errores:
            print("ERROR:", e)
        return 1

    datos = preparar_datos(dfs)
    if args.desde_json:
        return exportar_desde_json(datos, args.desde_json, args.salida)
    print(f"Resolviendo {len(datos.clases)} clases ({args.tiempo:.0f} s, {args.workers} workers)...")
    resultado = resolver(datos, args.tiempo, args.workers, args.semilla)
    print(f"Estado: {resultado.estado} en {resultado.tiempo_s:.1f} s")
    if resultado.solucion is None:
        print("No se encontró una solución: no se genera el escenario.")
        return 1

    problemas = verificar_solucion(datos, resultado.solucion)
    if problemas and not args.forzar:
        print(f"Verificación D1-D7: {len(problemas)} problemas, no se guarda el escenario (usar --forzar):")
        for pr in problemas[:10]:
            print("  ", pr)
        return 1
    desglose = evaluar_blandas(datos, resultado.solucion) if not problemas else []
    escenario = armar_escenario(resultado, desglose, problemas, args.tiempo, args.workers)

    salida = (args.salida or args.data / "escenarios") / f"{args.nombre}.json"
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(escenario, ensure_ascii=False, indent=1), encoding="utf-8")
    if args.csv:
        escribir_csv(resultado.solucion, salida.with_suffix(".csv"))

    print(f"Verificación D1-D7: {'OK' if not problemas else f'{len(problemas)} problemas'}")
    for b in desglose:
        print(f"  {b['id']} {b['nombre']:<50} {b['valor']:>7} / {b['maximo']:<7} {b['puntos']:6.2f}")
    print(f"Objetivo (solver): {resultado.objetivo:.2f} de 100, cota inferior {resultado.cota_inferior:.2f}")
    print(f"Objetivo recalculado: {sum(b['puntos'] for b in desglose):.2f}")
    print(f"Escenario guardado en {salida}")
    return 0 if not problemas else 1


if __name__ == "__main__":
    sys.exit(main())
