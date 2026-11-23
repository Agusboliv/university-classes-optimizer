"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Entrada } from "@/components/entrada";
import { Barra } from "@/components/esqueleto";
import { Desglose } from "@/components/panel/desglose";
import { Exploracion } from "@/components/panel/exploracion";
import { Marco } from "@/components/panel/marco";
import { Pesos } from "@/components/panel/pesos";
import { Resumen } from "@/components/panel/resumen";
import { cargarEscenario, objetivoReal, type Escenario, type IdBlanda } from "@/lib/escenario";
import { mismosPesos, pesosDe, repartirPesos, reponderar } from "@/lib/ponderacion";

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
    <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
      <div className="lg:col-span-3"><Marco etiqueta="Resumen"><Barra className="h-24" /></Marco></div>
      <div className="lg:col-span-2"><Marco etiqueta="Desglose del objetivo · B1–B6"><Barra className="h-72" /></Marco></div>
      <Marco etiqueta="Re-ponderar"><Barra className="h-72" /></Marco>
    </div>
  );
}

function PanelListo({ escenario }: { escenario: Escenario }) {
  const originales = useMemo(() => pesosDe(escenario.desglose), [escenario]);
  const [pesos, setPesos] = useState(originales);
  const filas = useMemo(() => reponderar(escenario.desglose, pesos), [escenario, pesos]);
  const cambiado = !mismosPesos(pesos, originales);
  const total = filas.reduce((s, f) => s + f.puntos, 0);
  const totalOriginal = objetivoReal(escenario.desglose);
  const cambiarPeso = (id: IdBlanda, valor: number) => setPesos((actual) => repartirPesos(actual, id, valor));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Entrada orden={1} className="lg:col-span-3">
        <Resumen escenario={escenario} />
      </Entrada>
      <Entrada orden={2} className="lg:col-span-2">
        <Desglose filas={filas} total={total} totalOriginal={totalOriginal} cambiado={cambiado} />
      </Entrada>
      <Entrada orden={3}>
        <Pesos
          pesos={pesos}
          cambiado={cambiado}
          total={total}
          totalOriginal={totalOriginal}
          onCambiar={cambiarPeso}
          onRestaurar={() => setPesos(originales)}
        />
      </Entrada>
      <Entrada orden={4} className="lg:col-span-3">
        <Exploracion asignaciones={escenario.asignaciones} />
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
