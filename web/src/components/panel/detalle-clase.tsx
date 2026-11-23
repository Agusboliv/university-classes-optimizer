"use client";

import { ArrowRight, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Asignacion } from "@/lib/escenario";
import { numero } from "@/lib/formato";
import { minutos, NOMBRE_CAMPO, NOMBRE_DIA, VISTAS, type ResumenEntidad, type Vista } from "@/lib/grilla";

interface DetalleClaseProps {
  clase: Asignacion | null;
  fijada: boolean;
  vista: Vista;
  entidad: string;
  resumen: ResumenEntidad;
  /** Editor para mover la clase (solo se muestra con la clase fijada). */
  editor?: ReactNode;
  onIrA: (vista: Vista, id: string) => void;
  onCerrar: () => void;
}

/** Detalle de la clase en hover (vista previa) o fijada con clic; si no hay, resumen de la entidad. */
export function DetalleClase({ clase, fijada, vista, entidad, resumen, editor, onIrA, onCerrar }: DetalleClaseProps) {
  if (!clase) {
    return (
      <aside aria-live="polite" className="self-start rounded-md bg-secondary p-4 text-in-ui-sm">
        <p className="etiqueta-panel">{NOMBRE_CAMPO[vista]}</p>
        <p className="mt-1 text-in-ui font-semibold">{entidad}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Clases", numero(resumen.clases)],
            ["Horas", numero(resumen.minutos / 60, 1)],
            ["Días", numero(resumen.dias)],
          ].map(([t, v]) => (
            <div key={t}>
              <dt className="text-tinta-2">{t}</dt>
              <dd className="text-in-ui font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-tinta-2">Pasá el mouse o tocá una clase para ver el detalle.</p>
      </aside>
    );
  }

  const duracion = minutos(clase.fin) - minutos(clase.inicio);
  return (
    <aside aria-live="polite" className="self-start rounded-md border p-4 text-in-ui-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="etiqueta-panel">{fijada ? "Clase seleccionada" : "Vista previa"} · {clase.clase}</p>
        {fijada && (
          <Button variant="ghost" size="icon-xs" aria-label="Cerrar el detalle" onClick={onCerrar}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <p className="mt-1 text-in-ui font-semibold text-balance">{clase.materia}</p>
      <p className="mt-1 text-tinta-2 tabular-nums">
        {NOMBRE_DIA[clase.dia] ?? clase.dia} · <time>{clase.inicio}</time>–<time>{clase.fin}</time> ·{" "}
        {numero(duracion)} min
      </p>

      <dl className="mt-4 space-y-2">
        {VISTAS.map((v) => (
          <div key={v} className="flex items-center justify-between gap-2">
            <dt className="text-tinta-2">{NOMBRE_CAMPO[v]}</dt>
            <dd className="flex items-center gap-1">
              <span className="font-medium">{clase[v]}</span>
              {v !== vista && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Ver la semana de ${NOMBRE_CAMPO[v].toLowerCase()} ${clase[v]}`}
                  title={`Ver la semana de ${clase[v]}`}
                  onClick={() => onIrA(v, clase[v])}
                >
                  <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {fijada && editor}
    </aside>
  );
}
