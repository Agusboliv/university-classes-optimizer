# Plan Fase 2: `web/` interactiva (POC)

Web estática (Next.js `output: "export"`) para explorar un escenario
precalculado. Se prioriza la interacción: explorar la grilla, re-ponderar
B1–B6 y mover clases a mano con verificación en vivo. Sin backend, sin agente
y sin subir CSV. Rama `fase2-web`. Los archivos se agregan de forma explícita
(nunca `git add -A`) y `CLAUDE.md` queda fuera de los commits.

## Punto de partida

- No hay código web. Toolchain: Node 22.19, npm 10.9. Versiones actuales:
  Next 16.4, Tailwind 4.3, ECharts 6.1, Vitest 5.1.
- Contrato: `data/escenarios/referencia.json` (CLAUDE.md, sección Datos),
  ~200 KB, 1003 asignaciones, LUN–VIE de 08:00 a 22:00, 163 materias y 12 carreras.
  Clases por vista: hasta 11 (cohorte), 9 (profesor), 25 (aula).
- Nombres en español, iguales a los del Python y del JSON (`verificarSolucion`,
  `evaluarBlandas`, `maximosBlandas`). Errores como listas de strings.

## Reglas que no cambian

- "Óptimo" no aparece nunca. Se muestra "Mejor solución encontrada en X s" y la cota.
- El objetivo mostrado es Σ `desglose[].puntos` (22.68), no `resultado.objetivo`
  (24.20, el del solver).
- TS estricto, sin `any`.

## Stack visual y animación

- Tailwind v4 (tokens en `@theme`, claro/oscuro con variables CSS) + shadcn/ui.
- Grilla semanal en HTML/CSS. ECharts (renderer Canvas) solo para gráficos:
  el desglose y, como opcional, un heatmap de ocupación.
- View Transitions (CSS + `document.startViewTransition`) para cambiar de vista.
  Motion con `LazyMotion` + `m` para entradas y hover. Sin GSAP.
- Respetar `prefers-reduced-motion`, animar solo `transform`/`opacity`, como
  máximo ~30 elementos animados a la vez.

## Datos en el navegador

`scripts/copiar-datos.mjs` (en `predev` y `prebuild`) copia
`../data/escenarios/*.json` a `public/escenarios/`, `../data/*.csv` a
`public/data/` y, desde el tramo 6, `../data/escenarios/*.csv` (solución en CSV)
también a `public/data/`. La página los lee con `fetch`. Para probar el
build se sirve `out/` con `npx serve out` (abriendo `index.html` desde el disco
el `fetch` falla).

## Diseño

- **Tono**: instrumento de medición / cuaderno de laboratorio. Sobrio, con los
  números en primer plano. Textos en castellano rioplatense.
- **Color** (tokens CSS): neutros cálidos (papel / grafito), un solo acento
  `--acento` (índigo, se puede cambiar a un azul institucional), estados ok /
  error / aviso y una paleta categórica de 8 tonos para materias, cíclica.
- **Tipografía**: Inter (una sola familia) con `next/font`, `tabular-nums` en
  números, horarios y tablas. Dos escalas que no se mezclan:
  - Editorial (portada y títulos de pantalla): display
    `clamp(3.5rem, 9vw, 8rem)` / 800 / interlineado 0.95 / tracking -0.035em;
    título de sección `clamp(2rem, 4.5vw, 3.5rem)` / 700; apoyo 1.25–1.5rem / 400.
  - Instrumento (dentro de paneles): etiqueta 0.75rem MAYÚSCULAS +0.08em / 600;
    cifra 2.5–3.5rem / 600 tabular; UI 0.875–0.9375rem; tablas 0.8125rem.
- **Forma**: radios de 6 px, bordes de 1 px, sombras casi nulas.

## Pantallas (rutas del export estático)

- `/` **Portada**: "Mil clases, un solo horario" + subtítulo + botón
  "Explorar". De fondo, una grilla semanal generativa en canvas 2D (bloques
  con la paleta de materias, baja opacidad) que se va acomodando. Tope de
  ~30 fps, se pausa con la pestaña oculta o fuera de pantalla, se queda en un
  cuadro fijo con reduced-motion y tiene un degradado encima para que el
  contraste sea ≥ 4.5:1.
- `/panel`: resumen, desglose, re-ponderar, grilla semanal y (más adelante)
  editor.
- `/analisis`: capacidad ociosa, presión horaria y calidad del encaje de la
  solución base (ver tramo 6).
- `/datos`: una pestaña por CSV con los mismos nombres, columnas, orden y
  formato. Búsqueda, orden y paginación.
- Navegación compartida con View Transitions al cambiar de ruta.

## Tramos (parar después de cada uno)

### Tramo 1: sistema de diseño, navegación, portada, esqueletos
1. `create-next-app` (TS, Tailwind v4, App Router, `src/`), `output: "export"`,
   shadcn init, script de copia (JSON a `public/escenarios/`, CSV a
   `public/data/`).
2. Tokens de color (claro/oscuro, toggle de tema) y de tipografía (las dos
   escalas) en `globals.css`.
3. Navegación compartida + View Transitions entre rutas.
4. Portada con el fondo generativo y entrada con Motion (LazyMotion + `m`).
5. Esqueletos de `/panel` y `/datos`.
6. Sección "Diseño" en CLAUDE.md (sin commitear).
- **Validar**: `npm run build` genera `out/` con las 3 rutas. Capturas en claro
  y en oscuro. Con reduced-motion el fondo queda fijo. Medir el contraste del
  título sobre el degradado. `grep -ri "óptim" web/src` no encuentra nada.

### Tramo 2: /panel I, resumen, desglose y re-ponderar
1. `src/lib/escenario.ts`: tipos del contrato, `cargarEscenario()` y chequeo de
   claves.
2. Resumen (objetivo 22.68, tiempo, cota, verificación) y desglose: tabla +
   ECharts (Canvas, import dinámico solo en el cliente).
3. Sliders de pesos B1–B6 (suman 100) y "Restaurar pesos". Puntos =
   peso × valor / máximo con los datos del JSON. Aviso en la UI: re-pondera
   esta misma solución y no vuelve a optimizar.
- **Validar**: con los pesos originales da 22.68. Test vitest de la
  re-ponderación.

### Tramo 3: /panel II, grilla y exploración
1. "Ver por" (Cohorte / Profesor / Aula) con View Transition y buscador
   (combobox; 134 / 287 / 116 opciones).
2. `GrillaSemanal` en HTML/CSS: LUN–VIE × 08–22, color por materia.
3. Hover con un resumen; clic con el detalle de la clase; resaltar por materia
   o por profesor.
- **Validar**: capturas de las tres vistas; la cantidad de clases coincide con
  el JSON.

### Tramo 4: /datos, explorador de tablas
1. Pestañas por archivo, esquema (filas × columnas, columnas en orden),
   búsqueda, orden por columna y paginación. Parseo en un Web Worker si hace
   falta.
2. Opcional: ver el CSV crudo; clic en profesor_id / aula_id / cohorte para ir
   a `/panel` con ese filtro.
- **Validar**: las cantidades de filas coinciden con los CSV (200 aulas, 1003
  clases, 15 franjas, 287 profesores, 1378 filas de disponibilidad).

### Tramo 5 (opcional, HECHO): editor
Hecho en `web/src/lib/modelo.ts` (port de `preparar_datos` y `verificacion.py`),
`components/panel/use-edicion.ts`, `editor-clase.tsx` y `cambios.tsx`. Los CSV
se leen de `public/data/` (no `public/datos/`). Diferencia con lo planeado: el
peor caso de B5 no se puede recalcular en TS (las aulas candidatas de Python salen
de un sort no estable); el evaluador toma los peores casos del `desglose` del
JSON. B1–B4 y B6 sí coinciden con el recálculo.

Plan original:
1. Copiar los CSV sintéticos a `public/datos/` y parsearlos (sin comillas ni
   comas internas; si no alcanza, `papaparse`).
2. `src/lib/modelo.ts`: port de `preparar_datos` (lo necesario) y de
   `verificacion.py` (`verificarSolucion`, `valoresBlandas`, `maximosBlandas`,
   `evaluarBlandas`).
3. UI: desde el detalle de una clase, elegir día, inicio y aula; "Aplicar",
   "Deshacer" y "Restaurar". Las asignaciones se reemplazan sin mutarlas. Se
   muestran los problemas D1–D7 y la variación de cada B_i y del total.
- **Validar** (vitest): con `referencia.json` y los CSV, `verificarSolucion` da
  `[]`, los máximos coinciden con CLAUDE.md (50563, 16080, 1922, 421, 587, 800),
  `evaluarBlandas` da los puntos del `desglose` del JSON (Python) y mover una
  clase al aula y horario de otra da un problema D4.

### Tramo 6: /analisis (HECHO)
Para quien organiza las clases: cuánta capacidad sobra, cuándo hay presión y
dónde se podría reorganizar.
- **Fuente**: `data/escenarios/referencia.csv`, misma corrida que
  `referencia.json` (exportada con `generar_escenario --desde-json … --csv`,
  sin volver a resolver), más los 5 CSV de entrada. `copiar-datos.mjs` la lleva a
  `public/data/`. Si el CSV no trae Materia, Profesor, Cohorte o Fin, se derivan
  de `clases.csv`. Refleja la solución base, no las ediciones del editor.
- **Cálculo**: funciones puras en `web/src/lib/analisis.ts`. B1–B6 salen del
  evaluador de `modelo.ts` (no se reimplementan) y se muestra si coinciden con
  el desglose del JSON.
- **Definiciones** (en notas junto a cada gráfico): aula libre un día = sin
  ninguna clase ese día, dentro de las franjas; laboratorio libre = lo mismo
  para es_laboratorio = 1; docente sin clases = disponible (holgura real) o no
  disponible ese día; aula ocupada en una hora = tiene clase en algún momento de
  esa hora.
- **Gráficos** (ECharts en Canvas, LUN–VIE): a) aulas sin clases, b) laboratorios
  sin clases, c) docentes sin clases apilado disponibles/no disponibles; d) mapa
  de calor día × hora (% ocupadas o aulas libres, escala de 0 al máximo
  observado); e) asientos vacíos por día (B1) + top 10 clases; f) huecos por día
  (B2) + top cohortes; g) docentes por días de trabajo (B4) y cuántos superan
  360 min seguidos (B3); h) laboratorios usados sin necesitarlos (B5).
- **Tests** (`analisis.test.ts`): dataset diminuto (3 aulas con 1 laboratorio,
  3 docentes, 5 clases) con conteos conocidos para a)–d); con los archivos
  reales, 1003 clases, misma corrida que el JSON, B1–B6 iguales al desglose y
  parciales por día que suman el total.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El port TS de B1–B6 se desvía del Python | Test cruzado contra el `desglose` del JSON y los máximos de CLAUDE.md |
| Recalcular bloquea el hilo principal | Calcular los máximos una sola vez; medir. Si pasa de ~50 ms, Web Worker |
| ECharts con export estático / SSR | Import dinámico con `ssr: false` en un componente cliente |
| View Transitions no disponibles en algún navegador | Detectar `startViewTransition` y, si no está, cambiar sin animación |
| Demasiadas animaciones (aula con 25 bloques) | Escalonar solo la entrada y como máximo ~30 elementos; con reduced-motion no se anima nada |
| 163 materias no tienen colores distinguibles | Paleta categórica corta cíclica, más resaltado por materia para distinguir |

## Fuera de alcance

Backend, agente Claude, subir CSV, selector de varios escenarios y deploy a
Cloudflare Pages.
