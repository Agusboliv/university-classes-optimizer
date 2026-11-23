"use client";

import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList,
} from "@/components/ui/combobox";

interface BuscadorEntidadProps {
  etiqueta: string;
  opciones: readonly string[];
  valor: string;
  onElegir: (id: string) => void;
}

/** Combobox con filtro para elegir la cohorte, el profesor o el aula. */
export function BuscadorEntidad({ etiqueta, opciones, valor, onElegir }: BuscadorEntidadProps) {
  return (
    <Combobox
      items={opciones as string[]}
      value={valor}
      onValueChange={(v) => {
        if (typeof v === "string" && v) onElegir(v);
      }}
    >
      <ComboboxInput aria-label={etiqueta} placeholder={etiqueta} className="w-56" />
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
