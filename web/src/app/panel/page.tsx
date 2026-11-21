import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Entrada, PanelInteractivo } from "@/components/entrada";
import { Barra, EncabezadoPantalla } from "@/components/esqueleto";
import { TransicionPagina } from "@/components/transicion-pagina";

export const metadata: Metadata = { title: "Panel · Mil clases, un solo horario" };

const CIFRAS = ["Objetivo", "Tiempo de búsqueda", "Cota inferior", "Verificación D1–D7"];
const ANCHOS_DESGLOSE = [72, 18, 6, 64, 10, 40];

function Panel({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <PanelInteractivo className="h-full rounded-lg border bg-card p-5">
      <h2 className="etiqueta-panel">{etiqueta}</h2>
      <div className="mt-4" aria-busy="true">
        {children}
      </div>
    </PanelInteractivo>
  );
}

export default function PaginaPanel() {
  return (
    <TransicionPagina>
      <main className="mx-auto w-full max-w-7xl px-5 py-14">
        <Entrada>
          <EncabezadoPantalla
            titulo="Panel"
            apoyo="La mejor solución encontrada para el caso de referencia: cuánto cuesta cada penalización, qué pasa si cambiás los pesos y cómo queda la semana."
          />
        </Entrada>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <Entrada orden={1} className="lg:col-span-3">
            <Panel etiqueta="Resumen">
              <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
                {CIFRAS.map((c) => (
                  <div key={c}>
                    <dt className="text-in-ui-sm text-tinta-2">{c}</dt>
                    <dd className="mt-2">
                      <Barra className="h-10 w-28" />
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </Entrada>

          <Entrada orden={2} className="lg:col-span-2">
            <Panel etiqueta="Desglose del objetivo · B1–B6">
              <div className="space-y-3">
                {ANCHOS_DESGLOSE.map((ancho, i) => (
                  <Barra key={i} className="h-5" style={{ width: `${ancho}%` }} />
                ))}
              </div>
            </Panel>
          </Entrada>

          <Entrada orden={3}>
            <Panel etiqueta="Pesos">
              <div className="space-y-5">
                {ANCHOS_DESGLOSE.map((_, i) => (
                  <Barra key={i} className="h-2" />
                ))}
              </div>
            </Panel>
          </Entrada>

          <Entrada orden={4} className="lg:col-span-3">
            <Panel etiqueta="Grilla semanal">
              <Barra className="h-72 w-full" />
            </Panel>
          </Entrada>
        </div>
      </main>
    </TransicionPagina>
  );
}
