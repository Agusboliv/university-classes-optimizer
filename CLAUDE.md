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
- `data/escenarios/referencia.csv`: la solución de `referencia.json` en CSV
  (Clase, Materia, Profesor, Cohorte, Aula, Día, Inicio, Fin), misma corrida.
  Se genera sin volver a resolver con `--desde-json … --csv`. La usa `/analisis`.
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

## Diseño
Tokens en `web/src/app/globals.css`; se ajustan solo ahí. Plan: `docs/plan-fase2.md`.
- Tono: instrumento de medición, sobrio, números en primer plano; textos en
  castellano rioplatense.
- Color: neutros cálidos (papel/grafito), claro y oscuro. Un solo acento
  `--acento` (índigo; se puede pasar a un azul institucional). Estados
  `--estado-ok/aviso/error`, siempre con ícono y texto. Materias:
  `--materia-1..8`, paleta categórica en orden fijo, validada con el skill
  dataviz en los dos temas.
- Tipografía: Inter (una sola familia, `next/font`), `tabular-nums` en números,
  horarios y tablas. Jerarquía por tamaño y peso, con dos escalas que no se
  mezclan:
  - Editorial (portada y títulos de pantalla, fuera de los paneles):
    `text-ed-display` clamp(3.5rem, 9vw, 8rem) / 800 / interlineado 0.95 /
    tracking -0.035em; `text-ed-titulo` clamp(2rem, 4.5vw, 3.5rem) / 700;
    `text-ed-apoyo` 1.25–1.5rem / 400.
  - Instrumento (dentro de los paneles): `etiqueta-panel` 0.75rem MAYÚSCULAS
    +0.08em / 600; `cifra` 2.5–3.5rem / 600 tabular; `text-in-ui` 0.9375rem y
    `text-in-ui-sm` 0.875rem; `text-in-tabla` 0.8125rem.
- Forma: radio 6 px, bordes de 1 px, sombras casi nulas.
- Movimiento: View Transitions (React `<ViewTransition>` en cada `page.tsx`)
  al cambiar de ruta; Motion con `LazyMotion` + `m` para entradas y hover. Sin
  GSAP. Solo `transform`/`opacity`, como máximo ~30 elementos animados a la vez,
  y respetar `prefers-reduced-motion`.
- Pantallas (rutas del export estático, navegación compartida):
  - `/` Portada: "Mil clases, un solo horario", subtítulo y "Explorar". De fondo,
    una grilla semanal generativa en canvas 2D: ≤ 30 fps, se pausa oculta o
    fuera de pantalla, queda en un cuadro fijo con reduced-motion. Encima un velo
    de papel ≥ 55% que deja título y subtítulo ≥ 4.5:1.
  - `/panel`: resumen, desglose B1–B6, re-ponderar pesos, grilla semanal con
    exploración y (opcional) editor.
  - `/analisis`: para quien organiza las clases. Calcula todo en el navegador
    (`web/src/lib/analisis.ts`) sobre `referencia.csv` y los 5 CSV, con la
    solución base (sin las ediciones del editor). Tres bloques, LUN a VIE:
    capacidad ociosa (aulas, laboratorios y docentes sin clases), presión
    horaria (mapa de calor día × hora: % de aulas ocupadas o aulas libres) y
    calidad del encaje (B1 asientos vacíos, B2 huecos, B4/B3 días y rachas,
    B5 laboratorios). B1–B6 salen del evaluador de `web/src/lib/modelo.ts` y
    deben coincidir con el desglose del JSON. Definiciones:
    - Aula libre un día: sin ninguna clase ese día, dentro de las franjas.
    - Laboratorio libre: lo mismo, solo para aulas con es_laboratorio = 1.
    - Docente sin clases un día: "disponible" (tiene disponibilidad ese día,
      holgura real) o "no disponible" (no tiene disponibilidad ese día).
    - Aula ocupada en una hora: tiene clase en algún momento de esa hora.
  - `/datos`: explorador de los 5 CSV con los mismos nombres, columnas, orden y
    formato.

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
  guardar aunque falle D1–D7, `--csv` para guardar también `<nombre>.csv`).
  En la consola de Windows usar `PYTHONIOENCODING=utf-8`.
- `cd solver && python -m solver.generar_escenario --data ../data --desde-json ../data/escenarios/referencia.json --csv`
  (no resuelve: exporta a CSV un escenario ya generado, verificado contra D1–D7)
- `cd web && npm run dev`
- `cd web && npm run test`
- (Fase 3) `cd solver && uvicorn main:app --reload`

## Cuidado
- No bloquear el hilo principal del navegador con cálculo ni animaciones pesadas
  (usar Web Workers para validar o verificar CSV grandes).
- No mezclar datos reales con los sintéticos.
- Generar JSON de escenarios de a uno, que pesan (~1000 clases por escenario).
- `web/` usa Next 16: leer `web/node_modules/next/dist/docs/` antes de usar una
  API. `cacheComponents` y `partialPrefetching` no funcionan con
  `output: "export"` (usan PPR).
- `web/public/escenarios/` y `web/public/data/` son copias que genera
  `scripts/copiar-datos.mjs` (en `predev`/`prebuild`; también lleva
  `data/escenarios/*.csv` a `public/data/`); no se editan ni se versionan.
- `web/src/lib/modelo.ts` es un port de `verificacion.py`: si cambia una fórmula
  en Python, cambiarla en los dos (los tests comparan contra el JSON). Para
  normalizar B1–B6 usar `maximosDe(desglose)` del escenario: el peor caso de B5
  no se puede recalcular en TS porque en Python las 10 aulas candidatas salen de
  `sort_values` (quicksort, no estable) y, con empates de capacidad, a veces entra
  un laboratorio. Usar `kind="stable"` en Python lo haría determinista, pero
  cambia la referencia.

## Filosofía
Esto es un POC. Preferir lo simple: pocos archivos, poca abstracción,
tests solo donde validan el modelo. No aplicar objetivo de 80% de cobertura.