# Optimizador académico de horarios (CP-SAT)

Web interactiva para explorar un modelo de timetabling universitario hecho con
OR-Tools CP-SAT: asigna cada clase a un día, una hora de inicio y un aula,
respetando restricciones duras y minimizando penalizaciones blandas.
El modelo original vive en un notebook de Colab (Partes 1–4). Este repo replica
solo su lógica principal.

## Alcance
- SÍ replicar: carga y validación de CSV (Parte 1), modelo CP-SAT con D1–D7 y
  B1–B6 (Parte 2) y la verificación independiente de la solución.
- REEMPLAZAR: la visualización (Parte 3, matplotlib/ipywidgets) se rehace en la
  web con ECharts. No se porta código de plots.
- NO replicar: las pruebas de estrés de la Parte 4 (menos aulas / menos
  profesores) ni otros análisis del notebook. Si más adelante se muestran, serán
  resultados precalculados en JSON.

## Arquitectura
- `solver/`: Python + OR-Tools CP-SAT. Cuatro módulos en `solver/solver/`:
  `datos.py` (carga, validación, `preparar_datos`, parámetros), `modelo.py`
  (CP-SAT y `resolver`), `verificacion.py` (D1–D7 y B1–B6 sin el modelo) y
  `generar_escenario.py` (CLI). Un solo archivo de tests: `tests/test_solver.py`.
  FastAPI solo en la Fase 3.
- `web/`: Next.js + TypeScript + Tailwind v4 + shadcn/ui, export estático.
- `data/`: CSV sintéticos (creados por mí, se pueden subir y compartir) y
  `data/escenarios/*.json` con soluciones precalculadas.

## Datos (contrato fijo)
Caso sintético de referencia: 1003 clases, 200 aulas, 287 docentes, 134 cohortes
(comisiones = grupos de alumnos). No hay tabla de alumnos: cada clase trae su
`cantidad_alumnos`.
- `aulas.csv`: aula_id, nombre, edificio, capacidad, tiene_proyector, es_laboratorio
- `clases.csv`: clase_id, materia, cohorte, carrera, anio, tipo, cantidad_alumnos,
  franja, duracion_min, profesor_id, requiere_proyector, requiere_laboratorio
- `franjas.csv`: dia, franja, hora_inicio, hora_fin
- `profesores.csv`: profesor_id, nombre, dedicacion, max_min_por_dia
- `disponibilidad_profesores.csv`: profesor_id, dia, hora_desde, hora_hasta
- Salida `solucion_horarios.csv`: Clase, Aula, Día, Inicio (mínimo; puede traer
  más columnas)
- Horas en HH:MM, múltiplos de `SLOT_DURATION` = 30 min. Binarias son 0/1.
- Escenario `data/escenarios/<nombre>.json` (lo leen los tipos TS de la Fase 2):
  - `resultado`: estado, objetivo, cota_inferior, tiempo_s, tiempo_limite_s, workers
  - `desglose`: [{id, nombre, valor, maximo, peso, puntos}] para B1–B6
  - `verificacion`: {ok, problemas}
  - `asignaciones`: [{clase, materia, cohorte, profesor, aula, dia, inicio, fin}]
- Si cambia una columna o un campo del JSON, actualizar a la vez Python y los
  tipos TS.

## Modelo
- Variables: `y[clase,día,slot]` (horario) y `x[clase,aula,día,slot]` (horario +
  aula) con Σ_aulas x = y. Solo se crean combinaciones válidas por construcción
  (franja, aula compatible, disponibilidad docente). `K_AULAS` = 10: cada clase
  considera solo las 10 aulas compatibles más chicas.
- Duras: D1 una asignación por clase dentro de su franja; D2 capacidad;
  D3 proyector/laboratorio; D4 aula sin superposición; D5 docente sin
  superposición y disponible; D6 cohorte sin superposición; D7 tope diario
  `max_min_por_dia`.
- Blandas (peso %, cada una normalizada por su peor caso; el objetivo va de 0 a
  100 y los pesos suman 100): B1 asientos vacíos 17.5 · B2 huecos de cohorte 22.5
  · B3 racha docente > 360 min 22.5 · B4 días extra de docentes 12 ·
  B5 laboratorio sin necesitarlo 17.5 · B6 días con una sola materia 8.
- Referencia: `solver/tests/fixtures/solucion_horarios.csv` (factible, sin
  garantía de óptimo). Objetivo 21.37/100 recalculado con `evaluar_blandas`.
  Desglose en puntos: B1 8.70, B2 0.25, B3 0.05, B4 7.72, B5 0.00, B6 4.65.
  Debe pasar `verificar_solucion` (D1–D7). Los peores casos de la
  normalización son B1 50563, B2 16080, B3 1922, B4 421, B5 587, B6 800.
  (La corrida del notebook que reportó 24.45 es otra solución y no está guardada).
- Escenario generado `data/escenarios/referencia.json` (120 s, 8 workers):
  recalculado 22.68, solver 24.20, cota 0.00.
- `resultado.objetivo` es lo que reporta el solver y puede quedar por encima del
  real: en una solución no óptima, las auxiliares de B2/B3/B4/B6 solo están
  acotadas por abajo. El objetivo real es la suma de `desglose[].puntos`;
  mostrar ese en la web.
- En la web NUNCA decir "óptimo": mostrar "mejor solución encontrada en X s" y la cota.
- Con varios workers CP-SAT no es determinista aunque se fije la semilla.
  Por eso las soluciones se precalculan y se versionan; no se espera
  reproducirlas bit a bit.

## Decisión de cómputo
- CP-SAT no corre en el navegador (no hay WASM oficial) y reescribir a MIP
  (highs-js) cambia el modelo y rinde peor. Por eso NO se hace el paso de
  highs-js.
- Fases 1–2: todo estático, sin servidor ni costo. La solución del caso completo
  se calcula en local o en Colab.
- Resolver en vivo es opcional (Fase 3) y solo para instancias chicas. El caso
  completo necesitó 8 workers × 120 s; un plan gratuito tiene menos CPU, así que
  no prometerlo.

## Plan por fases
1. HECHA (rama `fase1-solver`, ver `docs/plan-fase1.md`): `solver/` con los 4
   módulos, 3 tests (factible, infactible, referencia) y el CLI
   `generar_escenario` que exporta el JSON de escenario.
2. `web/` estático: selector de escenario; grilla semanal por cohorte, profesor
   o aula; desglose del objetivo; subir CSV con validación en el navegador
   (Parte 1 en TS). Opcional: verificar D1–D7 y recalcular B1–B6 al mover una
   clase a mano, todo en el navegador y sin solver.
3. Opcional: FastAPI + CP-SAT para instancias chicas (tope de clases, tiempo
   máximo ~30 s, 1–2 workers, límite por usuario). Antes de elegir hosting
   gratuito, verificar sus límites vigentes.
4. Opcional: agente Claude que explique la solución (Vercel AI SDK; Sonnet 5.5
   para consultas simples, Opus 5.5 para las complejas; Prompt Caching,
   Cloudflare Turnstile y cuotas en Upstash Redis).
- Deploy del frontend: Cloudflare Pages. Gráficos: Apache ECharts sobre Canvas.
  Animaciones: CSS nativo y Motion; GSAP solo si hace falta.

## Reglas de código
- Python: type hints; validar los CSV con pandas antes de armar el modelo
  (`validar` devuelve listas de errores y advertencias); el modelo siempre con
  límite de tiempo.
- TypeScript estricto, sin `any`.
- Tests: pytest con casos chicos de solución conocida (incluir uno infactible);
  vitest para validación y verificación en el frontend.
- La verificación de D1–D7 es independiente del modelo (postcondición), no reusa
  sus variables.

## Comandos
- `cd solver && python -m pytest` (unos 10 s)
- `cd solver && python -m solver.generar_escenario --data ../data --tiempo 120`
  (opciones: `--workers`, `--semilla`, `--nombre`, `--salida`, `--forzar` para
  guardar aunque falle D1–D7). En la consola de Windows usar
  `PYTHONIOENCODING=utf-8`.
- `cd web && npm run dev`
- `cd web && npm run test`
- (Fase 3) `cd solver && uvicorn main:app --reload`

## Cuidado
- No bloquear el hilo principal del navegador con cálculo ni animaciones pesadas
  (usar Web Workers para validar o verificar CSV grandes).
- No mezclar datos reales con los sintéticos.
- Generar JSON de escenarios de a uno, que pesan (~1000 clases por escenario).

## Filosofía
Esto es un POC. Preferir lo simple: pocos archivos, poca abstracción,
tests solo donde validan el modelo. No aplicar objetivo de 80% de cobertura.