"use client";

import dynamic from "next/dynamic";

import { Barra } from "@/components/esqueleto";
import { Marco } from "@/components/panel/marco";
import { ETIQUETAS, objetivoReal, type TerminoDesglose } from "@/lib/escenario";
import { numero, porcentaje, puntos } from "@/lib/formato";

const GraficoDesglose = dynamic(() => import("@/components/panel/grafico-desglose").then((m) => m.GraficoDesglose), {
  ssr: false,
  loading: () => <Barra className="h-72" />,
});

const celdaNumero = "px-2 py-2 text-right tabular-nums";

/** Desglose B1–B6 con los pesos fijos del escenario (JSON): gráfico + tabla. */
export function Desglose({ desglose }: { desglose: readonly TerminoDesglose[] }) {
  const total = objetivoReal(desglose);
  return (
    <Marco
      etiqueta="Desglose del objetivo · B1–B6"
      extra={
        <p className="text-in-ui-sm text-tinta-2" data-numero>
          Total {puntos(total)}
        </p>
      }
    >
      <GraficoDesglose desglose={desglose} />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-in-tabla">
          <caption className="sr-only">Desglose del objetivo por penalización blanda</caption>
          <thead className="text-tinta-2">
            <tr className="border-b">
              <th scope="col" className="px-2 py-2 text-left font-medium">Penalización</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Valor</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Peor caso</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">% del peor</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Peso</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {desglose.map((t) => (
              <tr key={t.id} className="border-b last:border-b-0">
                <th scope="row" className="px-2 py-2 text-left font-normal">
                  <span className="font-semibold">{t.id}</span> {ETIQUETAS[t.id].nombre}
                  <span className="text-tinta-2"> · {ETIQUETAS[t.id].unidad}</span>
                </th>
                <td className={celdaNumero}>{numero(t.valor)}</td>
                <td className={celdaNumero}>{numero(t.maximo)}</td>
                <td className={celdaNumero}>{porcentaje(t.maximo > 0 ? (100 * t.valor) / t.maximo : 0)}</td>
                <td className={celdaNumero}>{porcentaje(t.peso)}</td>
                <td className={`${celdaNumero} font-semibold`}>{puntos(t.puntos)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <th scope="row" colSpan={5} className="px-2 py-2 text-left font-semibold">Objetivo (de 100)</th>
              <td className={`${celdaNumero} font-semibold`}>{puntos(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Marco>
  );
}
