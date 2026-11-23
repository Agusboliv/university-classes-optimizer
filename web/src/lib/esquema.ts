// Esquema de los CSV de entrada: mismo nombre de archivo, columnas y orden que
// ESQUEMA en solver/solver/datos.py. Si cambia una columna, cambiar los dos.

export const ESQUEMA = {
  "aulas.csv": ["aula_id", "nombre", "edificio", "capacidad", "tiene_proyector", "es_laboratorio"],
  "clases.csv": [
    "clase_id", "materia", "cohorte", "carrera", "anio", "tipo", "cantidad_alumnos",
    "franja", "duracion_min", "profesor_id", "requiere_proyector", "requiere_laboratorio",
  ],
  "franjas.csv": ["dia", "franja", "hora_inicio", "hora_fin"],
  "profesores.csv": ["profesor_id", "nombre", "dedicacion", "max_min_por_dia"],
  "disponibilidad_profesores.csv": ["profesor_id", "dia", "hora_desde", "hora_hasta"],
} as const satisfies Record<string, readonly string[]>;

export type ArchivoCsv = keyof typeof ESQUEMA;

export const ARCHIVOS = Object.keys(ESQUEMA) as ArchivoCsv[];

export const DESCRIPCION: Readonly<Record<ArchivoCsv, string>> = {
  "aulas.csv": "Aulas disponibles: capacidad, proyector y si son laboratorio.",
  "clases.csv": "Clases a programar: materia, cohorte, alumnos, franja, duración y docente.",
  "franjas.csv": "Bloques horarios de cada día: mañana, tarde y noche.",
  "profesores.csv": "Docentes y su tope de minutos por día.",
  "disponibilidad_profesores.csv": "Intervalos en los que cada docente puede dar clase.",
};

/** Columnas cuyos valores llevan a la grilla del panel filtrada por esa entidad. */
export const ENLACE_A_VISTA: Readonly<Record<string, "cohorte" | "profesor" | "aula">> = {
  profesor_id: "profesor",
  aula_id: "aula",
  cohorte: "cohorte",
};
