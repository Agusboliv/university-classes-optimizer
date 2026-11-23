"use client";

import { Info } from "lucide-react";
import { startTransition, useEffect, useMemo, useState, ViewTransition } from "react";

import { BuscadorEntidad } from "@/components/panel/buscador-entidad";
import { DetalleClase } from "@/components/panel/detalle-clase";
import { EditorClase } from "@/components/panel/editor-clase";
import { GrillaSemanal, type Resaltado } from "@/components/panel/grilla-semanal";
import { Marco } from "@/components/panel/marco";
import { ControlResaltado } from "@/components/panel/resaltado";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Asignacion } from "@/lib/escenario";
import type { Datos, Movimiento } from "@/lib/modelo";
import { numero } from "@/lib/formato";
import {
  clasesDe, coloresPorMateria, diasDe, entidades, esVista, NOMBRE_CAMPO, rangoHorario, resumenDe, VISTAS,
  type Campo, type Vista,
} from "@/lib/grilla";

interface Seleccion {
  readonly vista: Vista;
  readonly entidad: string;
}

/**
 * Vista y entidad iniciales desde ?ver=&id= (validados contra los datos). Solo corre en el cliente.
 * Si el id no tiene clases en la solución (ej. un aula que no se usa), avisa y muestra la primera.
 */
function seleccionInicial(asignaciones: readonly Asignacion[]): { seleccion: Seleccion; aviso: string | null } {
  const params = new URLSearchParams(window.location.search);
  const ver = params.get("ver");
  const vista: Vista = esVista(ver) ? ver : "cohorte";
  const lista = entidades(asignaciones, vista);
  const id = params.get("id");
  if (id && lista.includes(id)) return { seleccion: { vista, entidad: id }, aviso: null };
  const aviso = id ? `${NOMBRE_CAMPO[vista]} ${id} no tiene clases en esta solución; se muestra ${lista[0]}.` : null;
  return { seleccion: { vista, entidad: lista[0] }, aviso };
}

interface EdicionGrilla {
  /** null mientras se cargan los CSV. */
  readonly datos: Datos | null;
  readonly movidas: ReadonlySet<string>;
  readonly onMover: (claseId: string, m: Movimiento) => void;
  /** Se llama al fijar una clase: recién ahí se piden los CSV para editar. */
  readonly onIniciar: () => void;
}

interface ExploracionProps {
  asignaciones: readonly Asignacion[];
  edicion?: EdicionGrilla;
}

/** Grilla semanal con exploración: ver por, buscador, detalle de la clase, resaltado y (opcional) editor. */
export function Exploracion({ asignaciones, edicion }: ExploracionProps) {
  const [inicio] = useState(() => seleccionInicial(asignaciones));
  const [actual, setActual] = useState<Seleccion>(inicio.seleccion);
  const [aviso, setAviso] = useState<string | null>(inicio.aviso);
  // Se guarda el id (no el objeto) para seguir a la clase cuando se la mueve
  const [elegidaId, setElegida] = useState<string | null>(null);
  const porId = useMemo(() => new Map(asignaciones.map((a) => [a.clase, a])), [asignaciones]);
  const elegida = elegidaId ? (porId.get(elegidaId) ?? null) : null;
  const [previa, setPrevia] = useState<Asignacion | null>(null);
  const [campo, setCampo] = useState<Campo>("materia");
  const [resaltado, setResaltado] = useState<Resaltado | null>(null);
  const [resaltadoPrevio, setResaltadoPrevio] = useState<Resaltado | null>(null);

  const dias = useMemo(() => diasDe(asignaciones), [asignaciones]);
  const rango = useMemo(() => rangoHorario(asignaciones), [asignaciones]);
  const listas = useMemo(
    () => Object.fromEntries(VISTAS.map((v) => [v, entidades(asignaciones, v)])) as Record<Vista, string[]>,
    [asignaciones],
  );
  const clases = useMemo(() => clasesDe(asignaciones, actual.vista, actual.entidad), [asignaciones, actual]);
  const colores = useMemo(() => coloresPorMateria(clases), [clases]);
  const resumen = resumenDe(clases);

  // La URL refleja lo que se ve (se puede compartir o volver con ese filtro)
  useEffect(() => {
    const url = `?ver=${actual.vista}&id=${encodeURIComponent(actual.entidad)}`;
    window.history.replaceState(null, "", url);
  }, [actual]);

  /** Cambia de semana con View Transition (crossfade: mismo lugar, otro contenido). */
  const irA = (vista: Vista, entidad: string) =>
    startTransition(() => {
      setActual({ vista, entidad });
      setAviso(null);
      setElegida(null);
      setPrevia(null);
      setResaltado(null);
      if (campo !== "materia") setCampo("materia");
    });

  const cambiarVista = (vista: Vista) => {
    const entidad = elegida ? elegida[vista] : listas[vista][0];
    irA(vista, entidad);
  };

  return (
    <Marco
      estatico
      etiqueta="Grilla semanal"
      extra={
        <p className="text-in-ui-sm text-tinta-2" data-numero>
          {numero(resumen.clases)} clases · {numero(resumen.minutos / 60, 1)} h por semana
        </p>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          value={[actual.vista]}
          onValueChange={(v: string[]) => esVista(v[0]) && cambiarVista(v[0])}
          aria-label="Ver por"
        >
          {VISTAS.map((v) => (
            <ToggleGroupItem key={v} value={v}>
              {NOMBRE_CAMPO[v]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <BuscadorEntidad
          etiqueta={`Buscar ${NOMBRE_CAMPO[actual.vista].toLowerCase()}`}
          opciones={listas[actual.vista]}
          valor={actual.entidad}
          onElegir={(id) => irA(actual.vista, id)}
        />
        <span className="text-in-ui-sm text-tinta-2" data-numero>
          {numero(listas[actual.vista].length)} en total
        </span>
      </div>

      {aviso && (
        <p role="status" className="mt-3 flex items-center gap-2 text-in-ui-sm text-tinta-2">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {aviso}
        </p>
      )}

      <div className="mt-4">
        <ControlResaltado
          clases={clases}
          vista={actual.vista}
          campo={campo}
          colores={colores}
          activo={resaltado}
          onCampo={(c) => {
            setCampo(c);
            setResaltado(null);
          }}
          onActivo={setResaltado}
          onPrevisualizar={setResaltadoPrevio}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <ViewTransition key={`${actual.vista}:${actual.entidad}`} enter="grilla-entra" exit="grilla-sale" default="none">
          <GrillaSemanal
            clases={clases}
            dias={dias}
            rango={rango}
            vista={actual.vista}
            colores={colores}
            seleccion={elegida?.clase ?? null}
            movidas={edicion?.movidas}
            resaltado={resaltadoPrevio ?? resaltado}
            onSeleccionar={(c) => {
              edicion?.onIniciar();
              setElegida((e) => (e === c.clase ? null : c.clase));
            }}
            onPrevisualizar={setPrevia}
          />
        </ViewTransition>
        <DetalleClase
          clase={previa ?? elegida}
          fijada={previa === null || previa.clase === elegida?.clase}
          vista={actual.vista}
          entidad={actual.entidad}
          resumen={resumen}
          editor={
            elegida && edicion ? (
              edicion.datos ? (
                <EditorClase
                  key={`${elegida.clase}-${elegida.dia}-${elegida.inicio}-${elegida.aula}`}
                  clase={elegida}
                  datos={edicion.datos}
                  onAplicar={(m) => edicion.onMover(elegida.clase, m)}
                />
              ) : (
                <p className="mt-4 border-t pt-4 text-tinta-2">Cargando los CSV para poder mover la clase…</p>
              )
            ) : null
          }
          onIrA={irA}
          onCerrar={() => setElegida(null)}
        />
      </div>
    </Marco>
  );
}
