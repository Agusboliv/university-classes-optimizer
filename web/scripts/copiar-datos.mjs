// Copia los datos sintéticos del repo a public/ para que el export estático los sirva.
//   ../data/escenarios/*.json -> public/escenarios/
//   ../data/*.csv             -> public/data/
// Corre en predev y prebuild. Las copias no se versionan (ver .gitignore).
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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
const csv = copiar(datos, join(web, "public", "data"), ".csv");

// Soluciones en CSV (ej. referencia.csv, misma corrida que referencia.json) -> public/data/
// Se agregan después de los 5 CSV de entrada (copiar() vació la carpeta antes).
const soluciones = readdirSync(join(datos, "escenarios")).filter((n) => n.endsWith(".csv"));
for (const nombre of soluciones) {
  copyFileSync(join(datos, "escenarios", nombre), join(web, "public", "data", nombre));
}
console.log(`copiar-datos: ${escenarios.length} escenario(s), ${csv.length} CSV de entrada, ${soluciones.length} solución(es) en CSV`);
