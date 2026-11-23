# Optimizador de clases de universidad
Integrantes:
- Bolivar, Agustin
- Degiussepe, Gonzalo
- Guerrero, Brian
- Moreno, Mateo

Prototipo para planificar horarios y aulas universitarias (University Course
Timetabling Problem) con programación por restricciones y el solver CP-SAT de
Google OR-Tools. Trabajo de Aplicación Final, cátedra de Optimización
(2026, 2.º cuatrimestre).

## Qué hace

Asigna cada clase a un día, un horario (bloques de 30 min entre 8:00 y 22:00)
y un aula compatible.

- **Restricciones duras (D1–D7):** una asignación por clase, capacidad y
  equipamiento del aula (proyector, laboratorio), sin superposición de aulas,
  docentes ni cohortes, disponibilidad docente y tope diario por docente.
- **Restricciones blandas (B1–B6):** minimiza una función objetivo de 0 a 100 que
  penaliza asientos vacíos, huecos de cohorte, rachas docentes de más de 6 h,
  días extra de trabajo docente, laboratorios usados sin necesitarlos y días con
  una sola materia.

El detalle formal está en [`restricciones.md`](restricciones.md).

## Resultados (instancia sintética)

1.003 clases, 200 aulas, 287 docentes y 134 cohortes:

- 100 % de las clases asignadas, cumpliendo todas las restricciones duras.
- Función objetivo: 22,68 / 100 con límite de 120 s (mejor solución encontrada;
  no se garantiza que sea óptima).
- Aulas usadas y ocupación media: ver `data/escenarios/referencia.json`.
- Análisis de sensibilidad (en el notebook): se mantiene la factibilidad hasta
  130 aulas (65 %) o 273 docentes (95 %).

## Estructura

```text
data/       CSV sintéticos de entrada y escenarios generados (data/escenarios/)
docs/       Informe y planes de trabajo
solver/     Paquete Python: carga y validación, modelo CP-SAT, verificación y CLI
web/        Web interactiva (Next.js): grillas por cohorte, profesor y aula
notebook.ipynb    Notebook original de Colab (modelo y análisis de sensibilidad)
restricciones.md  Restricciones duras y blandas
```

## Cómo ejecutarlo

### 1. Modelo

**Opción A: Google Colab.** Abrí `notebook.ipynb`, cargá los CSV de `data/` y
ejecutá todas las celdas.

**Opción B: local** (Python 3.12):

```bash
cd solver
pip install -e ".[dev]"
python -m solver.generar_escenario --data ../data --tiempo 120
```

Genera `data/escenarios/referencia.json`, que usa la web.

### 2. Web

Requiere Node.js 18 o superior.

```bash
cd web
npm install
npm run dev
```

Abrí http://localhost:3000. La web tiene portada, panel de resultados con las
grillas, vista previa de las tablas de entrada y un análisis de capacidad ociosa.

### Tests

```bash
cd solver && pytest
cd web && npm test
```
