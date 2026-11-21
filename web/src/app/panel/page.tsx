import type { Metadata } from "next";

import { Entrada } from "@/components/entrada";
import { EncabezadoPantalla } from "@/components/esqueleto";
import { PanelCliente } from "@/components/panel/panel-cliente";
import { TransicionPagina } from "@/components/transicion-pagina";

export const metadata: Metadata = { title: "Panel · Mil clases, un solo horario" };

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
        <div className="mt-12">
          <PanelCliente />
        </div>
      </main>
    </TransicionPagina>
  );
}
