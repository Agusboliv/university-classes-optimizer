"use client";

import { MoveRight } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Asignacion } from "@/lib/escenario";
import { numero } from "@/lib/formato";
import { NOMBRE_DIA } from "@/lib/grilla";
import { iniciosDeGrilla, type Datos, type Movimiento } from "@/lib/modelo";

const comparar = new Intl.Collator("es", { numeric: true }).compare;
const estiloSelect = "h-8 w-full rounded-md border bg-background px-2 text-in-ui-sm tabular-nums";

interface EditorClaseProps {
  clase: Asignacion;
  datos: Datos;
  onAplicar: (m: Movimiento) => void;
}

/** Elegir día, inicio y aula para la clase fijada. La verificación D1–D7 se ve en "Cambios manuales". */
export function EditorClase({ clase, datos, onAplicar }: EditorClaseProps) {
  const [dia, setDia] = useState(clase.dia);
  const [inicio, setInicio] = useState(clase.inicio);
  const [aula, setAula] = useState(clase.aula);
  const id = useId();
  const info = datos.clases.get(clase.clase);
  const aulas = [...datos.aulas.values()].sort((a, b) => comparar(a.id, b.id));
  const sinCambios = dia === clase.dia && inicio === clase.inicio && aula === clase.aula;

  if (!info) return null;
  const requisitos = [info.requiereProyector && "proyector", info.requiereLaboratorio && "laboratorio"].filter(Boolean);

  return (
    <form
      className="mt-4 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onAplicar({ dia, inicio, aula });
      }}
    >
      <p className="etiqueta-panel">Mover la clase</p>
      <p className="mt-1 text-tinta-2">
        {numero(info.alumnos)} alumnos · franja {info.franja}
        {requisitos.length > 0 && ` · requiere ${requisitos.join(" y ")}`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-dia`} className="text-tinta-2">Día</label>
        <select id={`${id}-dia`} className={estiloSelect} value={dia} onChange={(e) => setDia(e.target.value)}>
          {datos.dias.map((d) => (
            <option key={d} value={d}>{NOMBRE_DIA[d] ?? d}</option>
          ))}
        </select>
        <label htmlFor={`${id}-inicio`} className="text-tinta-2">Inicio</label>
        <select id={`${id}-inicio`} className={estiloSelect} value={inicio} onChange={(e) => setInicio(e.target.value)}>
          {iniciosDeGrilla(datos, info.duracion).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <label htmlFor={`${id}-aula`} className="text-tinta-2">Aula</label>
        <select id={`${id}-aula`} className={estiloSelect} value={aula} onChange={(e) => setAula(e.target.value)}>
          {aulas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.id} · {a.capacidad}
              {a.laboratorio ? " · lab" : ""}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" className="mt-3 w-full" disabled={sinCambios}>
        <MoveRight aria-hidden="true" /> Aplicar
      </Button>
    </form>
  );
}
