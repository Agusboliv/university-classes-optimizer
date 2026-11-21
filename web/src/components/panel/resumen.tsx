import { CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";

import { Marco } from "@/components/panel/marco";
import { objetivoReal, type Escenario } from "@/lib/escenario";
import { numero, puntos, segundos } from "@/lib/formato";

function Cifra({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota: string }) {
  return (
    <div>
      <dt className="text-in-ui-sm text-tinta-2">{titulo}</dt>
      <dd className="cifra mt-2 flex items-center gap-2">{valor}</dd>
      <dd className="mt-2 text-in-ui-sm text-tinta-2">{nota}</dd>
    </div>
  );
}

/** Cifras de la solución. El objetivo es el real (suma del desglose), no el del solver. */
export function Resumen({ escenario }: { escenario: Escenario }) {
  const { resultado, verificacion, desglose, asignaciones } = escenario;
  const objetivo = objetivoReal(desglose);
  const difiereDelSolver = resultado.objetivo !== null && Math.abs(resultado.objetivo - objetivo) >= 0.005;
  const problemas = verificacion.problemas.length;

  return (
    <Marco
      etiqueta="Resumen"
      extra={<p className="text-in-ui-sm text-tinta-2">Mejor solución encontrada en {segundos(resultado.tiempo_s)}</p>}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        <Cifra titulo="Objetivo" valor={puntos(objetivo)} nota="de 100 · cuanto más bajo, mejor" />
        <Cifra
          titulo="Tiempo de búsqueda"
          valor={segundos(resultado.tiempo_s)}
          nota={`límite ${segundos(resultado.tiempo_limite_s)} · ${resultado.workers} workers`}
        />
        <Cifra
          titulo="Cota inferior"
          valor={puntos(resultado.cota_inferior ?? 0)}
          nota="ninguna solución puede quedar por debajo"
        />
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
          nota={
            verificacion.ok
              ? `${numero(asignaciones.length)} clases sin conflictos`
              : `${numero(problemas)} restricciones duras sin cumplir`
          }
        />
      </dl>
      {difiereDelSolver && resultado.objetivo !== null && (
        <p className="mt-6 border-t pt-4 text-in-ui-sm text-tinta-2">
          El solver reporta {puntos(resultado.objetivo)}; recalculado sobre la grilla, el objetivo real es{" "}
          {puntos(objetivo)}.
        </p>
      )}
    </Marco>
  );
}
