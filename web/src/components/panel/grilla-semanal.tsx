"use client";

import { m } from "motion/react";
import type { CSSProperties } from "react";

import type { Asignacion } from "@/lib/escenario";
import {
  camposSecundarios, minutos, NOMBRE_CAMPO, NOMBRE_DIA, posicion, type Campo, type RangoHorario, type Vista,
} from "@/lib/grilla";
import { cn } from "@/lib/utils";

const ALTO_HORA_PX = 44;

export interface Resaltado {
  readonly campo: Campo;
  readonly valor: string;
}

/** Estilo del bloque según el color de su materia (null = "otras", gris neutro). */
export function estiloMateria(color: number | null | undefined): CSSProperties {
  const tono = color == null ? "var(--tinta-2)" : `var(--materia-${color + 1})`;
  return {
    backgroundColor: `color-mix(in srgb, ${tono} ${color == null ? 10 : 15}%, var(--superficie))`,
    borderLeftColor: tono,
  };
}

interface GrillaSemanalProps {
  clases: readonly Asignacion[];
  dias: readonly string[];
  rango: RangoHorario;
  vista: Vista;
  colores: ReadonlyMap<string, number | null>;
  seleccion: string | null;
  /** Clases movidas a mano (borde punteado). */
  movidas?: ReadonlySet<string>;
  resaltado: Resaltado | null;
  onSeleccionar: (clase: Asignacion) => void;
  onPrevisualizar: (clase: Asignacion | null) => void;
}

/** Semana de una cohorte, profesor o aula: columnas por día, bloques posicionados por minuto. */
export function GrillaSemanal(props: GrillaSemanalProps) {
  const { clases, dias, rango, vista, colores, seleccion, movidas, resaltado, onSeleccionar, onPrevisualizar } = props;
  const horas = (rango.fin - rango.inicio) / 60;
  const [campoA, campoB] = camposSecundarios(vista);
  const alto = horas * ALTO_HORA_PX;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[40rem]">
        <div className="grid grid-cols-[3rem_repeat(var(--dias),minmax(0,1fr))]" style={{ "--dias": dias.length } as CSSProperties}>
          <div />
          {dias.map((d) => (
            <div key={d} className="pb-2 text-center text-in-ui-sm font-semibold">
              <abbr title={NOMBRE_DIA[d]} className="no-underline">{d}</abbr>
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-[3rem_repeat(var(--dias),minmax(0,1fr))]"
          style={{ "--dias": dias.length, height: alto } as CSSProperties}
          onMouseLeave={() => onPrevisualizar(null)}
        >
          <div className="relative" aria-hidden="true">
            {Array.from({ length: horas }, (_, i) => (
              <span
                key={i}
                className="absolute -translate-y-1/2 pr-2 text-in-tabla text-tinta-2 tabular-nums"
                style={{ top: i * ALTO_HORA_PX }}
              >
                {String(rango.inicio / 60 + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {dias.map((dia) => (
            <div
              key={dia}
              role="list"
              aria-label={NOMBRE_DIA[dia] ?? dia}
              className="relative border-l"
              style={{
                backgroundImage: "linear-gradient(to bottom, var(--borde) 1px, transparent 1px)",
                backgroundSize: `100% ${ALTO_HORA_PX}px`,
              }}
            >
              {clases
                .filter((c) => c.dia === dia)
                .map((c) => {
                  const { top, alto: altoBloque } = posicion(c, rango);
                  const atenuado = resaltado !== null && c[resaltado.campo] !== resaltado.valor;
                  const elegido = seleccion === c.clase;
                  const duracion = minutos(c.fin) - minutos(c.inicio);
                  return (
                    <div key={c.clase} role="listitem" className="absolute inset-x-0.5" style={{ top: `${top}%`, height: `${altoBloque}%` }}>
                      <m.button
                        type="button"
                        aria-pressed={elegido}
                        aria-label={`${c.materia}, ${NOMBRE_DIA[dia] ?? dia} de ${c.inicio} a ${c.fin}. ${NOMBRE_CAMPO[campoA]} ${c[campoA]}, ${NOMBRE_CAMPO[campoB]} ${c[campoB]}`}
                        onClick={() => onSeleccionar(c)}
                        onMouseEnter={() => onPrevisualizar(c)}
                        onFocus={() => onPrevisualizar(c)}
                        whileHover={{ y: -1 }}
                        transition={{ duration: 0.15 }}
                        style={estiloMateria(colores.get(c.materia))}
                        className={cn(
                          "flex size-full flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-in-tabla",
                          "transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          atenuado && "opacity-25",
                          movidas?.has(c.clase) && !elegido && "outline-1 outline-offset-1 outline-dashed outline-tinta-2",
                          elegido && "outline-2 outline-offset-1 outline-acento",
                        )}
                      >
                        <span className={cn("font-semibold", duracion <= 90 ? "line-clamp-1" : "line-clamp-2")}>{c.materia}</span>
                        <span className="text-tinta-2 tabular-nums">
                          <time>{c.inicio}</time>–<time>{c.fin}</time>
                        </span>
                        <span className="truncate text-tinta-2">
                          {c[campoA]} · {c[campoB]}
                        </span>
                      </m.button>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
