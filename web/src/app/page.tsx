import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Entrada } from "@/components/entrada";
import { FondoGrilla } from "@/components/fondo-grilla";
import { TransicionPagina } from "@/components/transicion-pagina";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Portada() {
  return (
    <TransicionPagina>
      {/* 3.5rem de la navegación + 1px de su borde */}
      <main className="relative isolate flex min-h-[calc(100svh-3.5rem-1px)] items-center overflow-hidden">
        <FondoGrilla className="absolute inset-0 -z-20 size-full" />
        <div aria-hidden="true" className="velo-portada absolute inset-0 -z-10" />

        <div className="mx-auto w-full max-w-7xl px-5 py-24">
          <Entrada>
            <h1 className="text-ed-display">
              Mil clases,
              <br />
              un solo horario
            </h1>
          </Entrada>
          <Entrada orden={1}>
            <p className="mt-8 max-w-[38ch] text-ed-apoyo text-pretty text-tinta-2">
              Explorá cómo un modelo de optimización acomoda <span data-numero>1003</span> clases,{" "}
              <span data-numero>200</span> aulas y <span data-numero>287</span> docentes en una semana.
            </p>
          </Entrada>
          <Entrada orden={2} className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/panel"
              className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-6 text-base motion-safe:hover:-translate-y-px")}
            >
              Explorar
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href="/datos"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6 text-base")}
            >
              Ver los datos
            </Link>
          </Entrada>
        </div>
      </main>
    </TransicionPagina>
  );
}
