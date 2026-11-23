"use client";

import { estiloMateria, type Resaltado } from "@/components/panel/grilla-semanal";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Asignacion } from "@/lib/escenario";
import { campoResaltable, NOMBRE_CAMPO, valoresDe, type Campo, type Vista } from "@/lib/grilla";
import { cn } from "@/lib/utils";

interface ResaltadoProps {
  clases: readonly Asignacion[];
  vista: Vista;
  campo: Campo;
  colores: ReadonlyMap<string, number | null>;
  activo: Resaltado | null;
  onCampo: (campo: Campo) => void;
  onActivo: (r: Resaltado | null) => void;
  onPrevisualizar: (r: Resaltado | null) => void;
}

/** Chips para resaltar por materia (también es la leyenda de colores) o por profesor/cohorte. */
export function ControlResaltado(props: ResaltadoProps) {
  const { clases, vista, campo, colores, activo, onCampo, onActivo, onPrevisualizar } = props;
  const secundario = campoResaltable(vista);
  const valores = campo === "materia" ? [...colores.keys()] : valoresDe(clases, campo);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="etiqueta-panel">Resaltar por</span>
      <ToggleGroup
        size="sm"
        variant="outline"
        value={[campo]}
        onValueChange={(v: string[]) => v[0] && onCampo(v[0] as Campo)}
        aria-label="Resaltar por"
      >
        <ToggleGroupItem value="materia">Materia</ToggleGroupItem>
        <ToggleGroupItem value={secundario}>{NOMBRE_CAMPO[secundario]}</ToggleGroupItem>
      </ToggleGroup>

      <ul className="flex basis-full flex-wrap gap-1.5" aria-label={`${NOMBRE_CAMPO[campo]}s de esta semana`}>
        {valores.map((valor) => {
          const presionado = activo?.campo === campo && activo.valor === valor;
          return (
            <li key={valor}>
              <button
                type="button"
                aria-pressed={presionado}
                onClick={() => onActivo(presionado ? null : { campo, valor })}
                onMouseEnter={() => onPrevisualizar({ campo, valor })}
                onMouseLeave={() => onPrevisualizar(null)}
                onFocus={() => onPrevisualizar({ campo, valor })}
                onBlur={() => onPrevisualizar(null)}
                className={cn(
                  "flex max-w-60 items-center gap-1.5 rounded-sm border px-2 py-1 text-in-tabla transition-colors hover:bg-secondary",
                  presionado && "border-acento bg-secondary",
                )}
              >
                {campo === "materia" && (
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px] border-l-[3px]" style={estiloMateria(colores.get(valor))} />
                )}
                <span className="truncate">{valor}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
