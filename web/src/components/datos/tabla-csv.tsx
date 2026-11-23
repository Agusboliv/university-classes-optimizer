import type { TablaCsv } from "@/lib/csv";
import { DESCRIPCION, ESQUEMA, type ArchivoCsv } from "@/lib/esquema";
import { numero } from "@/lib/formato";

interface TablaHeadProps {
  archivo: ArchivoCsv;
  /** Encabezado + primeras filas, tal cual están en el CSV. */
  tabla: TablaCsv;
  /** Total de filas del archivo completo (del manifest). */
  total: number;
}

/** Vista previa de una tabla de entrada: columnas en su orden original y las primeras filas sin convertir. */
export function TablaHead({ archivo, tabla, total }: TablaHeadProps) {
  const { columnas, filas } = tabla;
  const esperado: readonly string[] = ESQUEMA[archivo];
  const coincideEsquema = columnas.length === esperado.length && columnas.every((c, i) => c === esperado[i]);

  return (
    <div>
      <h2 className="etiqueta-panel">
        {archivo} · <span data-numero>{numero(filas.length)} de {numero(total)}</span> filas
      </h2>
      <p className="mt-1 text-in-ui-sm text-tinta-2">{DESCRIPCION[archivo]}</p>

      <p className="etiqueta-panel mt-4">Esquema</p>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {columnas.map((col) => (
          <li key={col} className="rounded-sm border px-2 py-1 text-in-tabla">{col}</li>
        ))}
      </ol>
      {!coincideEsquema && (
        <p role="alert" className="mt-2 text-in-ui-sm text-estado-error">
          Las columnas no coinciden con el esquema esperado: {esperado.join(", ")}.
        </p>
      )}

      <div className="mt-5 overflow-x-auto rounded-md border">
        <table className="w-full text-in-tabla">
          <caption className="sr-only">{archivo}: primeras {filas.length} filas</caption>
          <thead className="bg-secondary text-tinta-2">
            <tr>
              {columnas.map((col) => (
                <th key={col} scope="col" className="px-3 py-1.5 text-left font-medium whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, j) => (
              <tr key={j} className="border-t">
                {fila.map((valor, i) => (
                  <td key={columnas[i] ?? i} className="px-3 py-1.5 whitespace-nowrap">{valor}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
