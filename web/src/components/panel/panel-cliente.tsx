"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Entrada } from "@/components/entrada";
import { Barra } from "@/components/esqueleto";
import { Cambios } from "@/components/panel/cambios";
import { Desglose } from "@/components/panel/desglose";
import { Exploracion } from "@/components/panel/exploracion";
import { Marco } from "@/components/panel/marco";
import { Resumen } from "@/components/panel/resumen";
import { useEdicion } from "@/components/panel/use-edicion";
import { cargarEscenario, type Escenario } from "@/lib/escenario";

type EstadoCarga =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; escenario: Escenario };

function useEscenario(nombre: string): EstadoCarga {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: "cargando" });
  useEffect(() => {
    const control = new AbortController();
    cargarEscenario(nombre, control.signal)
      .then((escenario) => setEstado({ tipo: "listo", escenario }))
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        setEstado({ tipo: "error", mensaje: error instanceof Error ? error.message : "error desconocido" });
      });
    return () => control.abort();
  }, [nombre]);
  return estado;
}

function PanelCargando() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Marco etiqueta="Resumen"><Barra className="h-24" /></Marco>
      <Marco etiqueta="Desglose del objetivo · B1–B6"><Barra className="h-72" /></Marco>
    </div>
  );
}

function PanelListo({ escenario }: { escenario: Escenario }) {
  const edicion = useEdicion(escenario);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <Entrada orden={1}>
        <Resumen escenario={escenario} />
      </Entrada>
      <Entrada orden={2}>
        <Desglose desglose={escenario.desglose} />
      </Entrada>
      <Entrada orden={3}>
        <Exploracion
          asignaciones={edicion.actuales}
          edicion={{
            datos: edicion.modelo.tipo === "listo" ? edicion.modelo.datos : null,
            movidas: edicion.movidas,
            onMover: edicion.mover,
            onIniciar: edicion.iniciar,
          }}
        />
      </Entrada>
      <Entrada orden={4}>
        <Cambios edicion={edicion} />
      </Entrada>
    </div>
  );
}

/** Carga el escenario de referencia y arma el panel interactivo. */
export function PanelCliente() {
  const estado = useEscenario("referencia");
  if (estado.tipo === "cargando") return <PanelCargando />;
  if (estado.tipo === "error") {
    return (
      <Marco etiqueta="No se pudo cargar el escenario">
        <p role="alert" className="flex gap-2 text-in-ui">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-estado-error" aria-hidden="true" />
          <span>
            {estado.mensaje}. Revisá que exista <code>data/escenarios/referencia.json</code> y volvé a correr{" "}
            <code>npm run dev</code> o <code>npm run build</code>.
          </span>
        </p>
      </Marco>
    );
  }
  return <PanelListo escenario={estado.escenario} />;
}
