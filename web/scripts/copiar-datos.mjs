// Copia los datos sintéticos del repo a public/ para que el export estático los sirva.
//   ../data/escenarios/*.json -> public/escenarios/
//   ../data/*.csv             -> public/data/  (los usan /analisis y el editor de /panel)
//   vista previa para /datos  -> public/data/<tabla>.head.csv + public/data/manifest.json
// Corre en predev y prebuild. Las copias no se versionan (ver .gitignore).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const datos = join(web, "..", "data");

function copiar(origen, destino, extension) {
  if (!existsSync(origen)) {
    throw new Error(`No existe ${origen}: generá los datos antes (ver CLAUDE.md, Comandos).`);
  }
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  const archivos = readdirSync(origen).filter((n) => n.endsWith(extension));
  for (const nombre of archivos) {
    copyFileSync(join(origen, nombre), join(destino, nombre));
  }
  return archivos;
}

const escenarios = copiar(join(datos, "escenarios"), join(web, "public", "escenarios"), ".json");
// En la copia, `resultado` conserva solo los campos que usa la web (el original no cambia)
for (const nombre of escenarios) {
  const ruta = join(web, "public", "escenarios", nombre);
  const escenario = JSON.parse(readFileSync(ruta, "utf-8"));
  const { estado, objetivo, cota_inferior, tiempo_s } = escenario.resultado ?? {};
  escenario.resultado = { estado, objetivo, cota_inferior, tiempo_s };
  writeFileSync(ruta, JSON.stringify(escenario, null, 1), "utf-8");
}
const csv = copiar(datos, join(web, "public", "data"), ".csv");

// Soluciones en CSV (ej. referencia.csv, misma corrida que referencia.json) -> public/data/
// Se agregan después de los 5 CSV de entrada (copiar() vació la carpeta antes).
const soluciones = readdirSync(join(datos, "escenarios")).filter((n) => n.endsWith(".csv"));
for (const nombre of soluciones) {
  copyFileSync(join(datos, "escenarios", nombre), join(web, "public", "data", nombre));
}
// Vista previa de /datos: encabezado + 10 primeras filas tal cual (mismos bytes) y un manifest
// con columnas y total de filas. Así /datos no descarga los CSV completos.
const TABLAS = ["aulas", "clases", "franjas", "profesores", "disponibilidad_profesores"];
const FILAS_HEAD = 10;

/** Texto desde el inicio hasta el fin de la línea n (0 = encabezado), sin tocar los saltos de línea. */
function primerasLineas(texto, cantidad) {
  let fin = 0;
  for (let i = 0; i < cantidad; i++) {
    const salto = texto.indexOf("\n", fin);
    if (salto < 0) return texto;
    fin = salto + 1;
  }
  return texto.slice(0, fin);
}

const manifest = {};
for (const tabla of TABLAS) {
  const texto = readFileSync(join(datos, `${tabla}.csv`), "utf-8");
  const lineas = texto.split(/\r?\n/).filter((l) => l.length > 0);
  const head = `${tabla}.head.csv`;
  writeFileSync(join(web, "public", "data", head), primerasLineas(texto, FILAS_HEAD + 1), "utf-8");
  manifest[`${tabla}.csv`] = { columnas: lineas[0].replace(/^﻿/, "").split(","), filas: lineas.length - 1, head };
}
writeFileSync(join(web, "public", "data", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

console.log(
  `copiar-datos: ${escenarios.length} escenario(s), ${csv.length} CSV de entrada, ${soluciones.length} solución(es) en CSV, ` +
    `${TABLAS.length} vistas previas + manifest`,
);
