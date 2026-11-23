"use client";

import { CircleAlert, CircleCheck, Info, RotateCcw, Undo2 } from "lucide-react";

import { Marco } from "@/components/panel/marco";
import type { Edicion } from "@/components/panel/use-edicion";
import { Button } from "@/components/ui/button";
import { ETIQUETAS, objetivoReal } from "@/lib/escenario";
import { numero, puntos } from "@/lib/formato";

const MAX_PROBLEMAS = 8;

function delta(n: number): string {
  if (Math.abs(n) < 0.005) return puntos(0);
  return `${n > 0 ? "+" : "−"}${puntos(Math.abs(n))}`;
}

const celda = "px-2 py-1.5 text-right tabular-nums";

/** Resultado de las ediciones manuales: verificación D1–D7 y variación de B1–B6 y del total. */
export function Cambios({ edicion }: { edicion: Edicion }) {
  const { modelo, cambios, movidas, problemas, desglose, desgloseBase, deshacer, restaurar } = edicion;
  const totalBase = objetivoReal(desgloseBase);
  const total = desglose ? objetivoReal(desglose) : totalBase;
  // Igual que en Python, un choque se reporta una vez por slot de 30 min: acá se agrupan
  const agrupados = [...(problemas ?? []).reduce((m, p) => m.set(p, (m.get(p) ?? 0) + 1), new Map<string, number>())];

  return (
    <Marco
      estatico
      etiqueta="Cambios manuales"
      extra={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={deshacer} disabled={cambios === 0}>
            <Undo2 aria-hidden="true" /> Deshacer
          </Button>
          <Button variant="outline" size="sm" onClick={restaurar} disabled={cambios === 0}>
            <RotateCcw aria-hidden="true" /> Restaurar
          </Button>
        </div>
      }
    >
      <p className="flex gap-2 text-in-ui-sm text-tinta-2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Tocá una clase en la grilla y movela desde su detalle. Se verifica D1–D7 y se recalcula B1–B6 en el navegador,
          con las mismas fórmulas del solver; no vuelve a optimizar.
        </span>
      </p>

      {modelo.tipo === "cargando" && <p className="mt-4 text-in-ui-sm text-tinta-2">Cargando los CSV para verificar…</p>}
      {modelo.tipo === "error" && (
        <p role="alert" className="mt-4 text-in-ui-sm">No se pudieron cargar los CSV: {modelo.mensaje}.</p>
      )}

      {modelo.tipo === "listo" && problemas && desglose && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2" aria-live="polite">
          <div>
            <p className="text-in-ui-sm text-tinta-2" data-numero>
              {cambios === 0
                ? "Sin cambios: es la solución del solver."
                : `${numero(cambios)} movimiento${cambios === 1 ? "" : "s"} · ${numero(movidas.size)} clase${movidas.size === 1 ? "" : "s"} en otro lugar`}
            </p>
            <p className="mt-3 flex items-center gap-2 text-in-ui font-semibold">
              {problemas.length === 0 ? (
                <>
                  <CircleCheck className="size-5 text-estado-ok" aria-hidden="true" /> Restricciones duras D1–D7: OK
                </>
              ) : (
                <>
                  <CircleAlert className="size-5 text-estado-error" aria-hidden="true" /> D1–D7:{" "}
                  {numero(problemas.length)} problema{problemas.length === 1 ? "" : "s"}
                </>
              )}
            </p>
            {agrupados.length > 0 && (
              <ul className="mt-2 space-y-1 text-in-tabla">
                {agrupados.slice(0, MAX_PROBLEMAS).map(([p, veces]) => (
                  <li key={p}>
                    {p}
                    {veces > 1 && <span className="text-tinta-2 tabular-nums"> · ×{veces}</span>}
                  </li>
                ))}
                {agrupados.length > MAX_PROBLEMAS && (
                  <li className="text-tinta-2">y {numero(agrupados.length - MAX_PROBLEMAS)} más</li>
                )}
              </ul>
            )}
          </div>

          <table className="w-full text-in-tabla">
            <caption className="sr-only">Variación de las penalizaciones blandas por los cambios manuales</caption>
            <thead className="text-tinta-2">
              <tr className="border-b">
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Penalización</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Solver</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Ahora</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Δ puntos</th>
              </tr>
            </thead>
            <tbody>
              {desglose.map((t, i) => (
                <tr key={t.id} className="border-b">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">
                    <span className="font-semibold">{t.id}</span> {ETIQUETAS[t.id].nombre}
                  </th>
                  <td className={celda}>{puntos(desgloseBase[i].puntos)}</td>
                  <td className={celda}>{puntos(t.puntos)}</td>
                  <td className={celda}>{delta(t.puntos - desgloseBase[i].puntos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="px-2 py-1.5 text-left font-semibold">Objetivo (de 100)</th>
                <td className={celda}>{puntos(totalBase)}</td>
                <td className={`${celda} font-semibold`}>{puntos(total)}</td>
                <td className={`${celda} font-semibold`}>{delta(total - totalBase)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Marco>
  );
}
