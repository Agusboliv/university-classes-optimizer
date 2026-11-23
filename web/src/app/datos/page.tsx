import type { Metadata } from "next";

import { ExploradorDatos } from "@/components/datos/explorador-datos";
import { Entrada } from "@/components/entrada";
import { EncabezadoPantalla } from "@/components/esqueleto";
import { TransicionPagina } from "@/components/transicion-pagina";

export const metadata: Metadata = { title: "Datos · Mil clases, un solo horario" };

export default function PaginaDatos() {
  return (
    <TransicionPagina>
      <main className="mx-auto w-full max-w-7xl px-5 py-14">
        <Entrada>
          <EncabezadoPantalla
            titulo="Datos de entrada"
            apoyo="Las cinco tablas que recibe el modelo, tal como están en los CSV: mismos nombres, columnas y formato."
          />
        </Entrada>
        <Entrada orden={1} className="mt-12">
          <ExploradorDatos />
        </Entrada>
      </main>
    </TransicionPagina>
  );
}
