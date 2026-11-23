import type { Metadata } from "next";

import { AnalisisCliente } from "@/components/analisis/analisis-cliente";
import { Entrada } from "@/components/entrada";
import { EncabezadoPantalla } from "@/components/esqueleto";
import { TransicionPagina } from "@/components/transicion-pagina";

export const metadata: Metadata = { title: "Análisis · Mil clases, un solo horario" };

export default function PaginaAnalisis() {
  return (
    <TransicionPagina>
      <main className="mx-auto w-full max-w-7xl px-5 py-14">
        <Entrada>
          <EncabezadoPantalla titulo="Análisis" />
        </Entrada>
        <div className="mt-12">
          <AnalisisCliente />
        </div>
      </main>
    </TransicionPagina>
  );
}
