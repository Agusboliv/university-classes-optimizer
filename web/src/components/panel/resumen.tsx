import { CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";

import { Marco } from "@/components/panel/marco";
import { objetivoReal, type Escenario } from "@/lib/escenario";
import { numero, puntos, segundos } from "@/lib/formato";

function Cifra({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota?: string }) {
  return (
    <div>
      <dt className="text-in-ui-sm text-tinta-2">{titulo}</dt>
      <dd className="cifra mt-2 flex items-center gap-2">{valor}</dd>
      {nota && <dd className="mt-2 text-in-ui-sm text-tinta-2">{nota}</dd>}
    </div>
  );
}

/** Cifras de la solución. El objetivo es el real (suma del desglose), no el del solver. */
export function Resumen({ escenario }: { escenario: Escenario }) {
  const { resultado, verificacion, desglose } = escenario;
  const problemas = verificacion.problemas.length;

  return (
    <Marco
      etiqueta="Resumen"
      extra={<p className="text-in-ui-sm text-tinta-2">Mejor solución encontrada en {segundos(resultado.tiempo_s)}</p>}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        <Cifra titulo="Objetivo" valor={puntos(objetivoReal(desglose))} nota="de 100 · cuanto más bajo, mejor" />
        <Cifra titulo="Tiempo de búsqueda" valor={segundos(resultado.tiempo_s)} />
        <Cifra titulo="Cota inferior" valor={puntos(resultado.cota_inferior ?? 0)} />
        <Cifra
          titulo="Verificación D1–D7"
          valor={
            verificacion.ok ? (
              <>
                <CircleCheck className="size-[0.8em] text-estado-ok" aria-hidden="true" /> OK
              </>
            ) : (
              <>
                <CircleX className="size-[0.8em] text-estado-error" aria-hidden="true" /> {numero(problemas)}
              </>
            )
          }
          nota={verificacion.ok ? undefined : `${numero(problemas)} restricciones duras sin cumplir`}
        />
      </dl>
    </Marco>
  );
}
