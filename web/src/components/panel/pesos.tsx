"use client";

import { Info, RotateCcw } from "lucide-react";

import { Marco } from "@/components/panel/marco";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ETIQUETAS, IDS_BLANDAS, type IdBlanda } from "@/lib/escenario";
import { porcentaje, puntos } from "@/lib/formato";
import type { Pesos as PesosB } from "@/lib/ponderacion";

const PASO = 0.5;

interface PesosProps {
  pesos: PesosB;
  cambiado: boolean;
  total: number;
  totalOriginal: number;
  onCambiar: (id: IdBlanda, valor: number) => void;
  onRestaurar: () => void;
}

/** Sliders de pesos B1–B6 (suman 100). Re-pondera esta solución: no vuelve a optimizar. */
export function Pesos({ pesos, cambiado, total, totalOriginal, onCambiar, onRestaurar }: PesosProps) {
  return (
    <Marco
      etiqueta="Re-ponderar"
      extra={
        <Button variant="outline" size="sm" onClick={onRestaurar} disabled={!cambiado}>
          <RotateCcw aria-hidden="true" /> Restaurar pesos
        </Button>
      }
    >
      <p className="flex gap-2 rounded-md bg-secondary p-3 text-in-ui-sm text-tinta-2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          No vuelve a optimizar: recalcula los puntos de <strong className="font-semibold text-foreground">esta misma solución</strong>{" "}
          con otros pesos. Con otros pesos, el solver podría elegir otro horario.
        </span>
      </p>

      <ul className="mt-5 space-y-4">
        {IDS_BLANDAS.map((id) => (
          <li key={id}>
            <div className="flex items-baseline justify-between gap-3 text-in-ui-sm">
              <span>
                <span className="font-semibold">{id}</span> {ETIQUETAS[id].nombre}
              </span>
              <span className="tabular-nums text-tinta-2">{porcentaje(pesos[id])}</span>
            </div>
            <Slider
              className="mt-2"
              etiqueta={`Peso de ${id}, ${ETIQUETAS[id].nombre}`}
              value={[pesos[id]]}
              min={0}
              max={100}
              step={PASO}
              onValueChange={(v) => onCambiar(id, Array.isArray(v) ? v[0] : v)}
            />
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t pt-4">
        <p className="text-in-ui-sm text-tinta-2">Objetivo con estos pesos</p>
        <p className="cifra mt-1">{puntos(total)}</p>
        <p className="mt-1 text-in-ui-sm text-tinta-2">
          {cambiado ? `original ${puntos(totalOriginal)} · ` : ""}los pesos siempre suman 100
        </p>
      </div>
    </Marco>
  );
}
