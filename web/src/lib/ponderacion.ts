// Re-ponderar: recalcula los puntos de ESTA solución con otros pesos.
// No vuelve a optimizar (con otros pesos el solver podría elegir otro horario).

import { IDS_BLANDAS, type IdBlanda, type TerminoDesglose } from "@/lib/escenario";

export type Pesos = Readonly<Record<IdBlanda, number>>;

export const TOTAL_PESOS = 100;

export function pesosDe(desglose: readonly TerminoDesglose[]): Pesos {
  return Object.fromEntries(desglose.map((t) => [t.id, t.peso])) as Pesos;
}

/**
 * Fija el peso de `id` y reescala los demás en proporción para que sigan sumando 100.
 * Si los demás estaban todos en 0, el resto se reparte en partes iguales.
 */
export function repartirPesos(pesos: Pesos, id: IdBlanda, nuevo: number): Pesos {
  const valor = Math.min(TOTAL_PESOS, Math.max(0, nuevo));
  const resto = TOTAL_PESOS - valor;
  const otros = IDS_BLANDAS.filter((i) => i !== id);
  const sumaOtros = otros.reduce((s, i) => s + pesos[i], 0);
  return Object.fromEntries(
    IDS_BLANDAS.map((i) => {
      if (i === id) return [i, valor];
      return [i, sumaOtros > 0 ? (pesos[i] * resto) / sumaOtros : resto / otros.length];
    }),
  ) as Pesos;
}

/** puntos = peso × valor / peor caso (0 si la blanda nunca se puede violar). */
export function puntosCon(termino: TerminoDesglose, peso: number): number {
  return termino.maximo > 0 ? (peso * termino.valor) / termino.maximo : 0;
}

export interface TerminoReponderado {
  readonly termino: TerminoDesglose;
  readonly peso: number;
  readonly puntos: number;
}

export function reponderar(desglose: readonly TerminoDesglose[], pesos: Pesos): TerminoReponderado[] {
  return desglose.map((t) => ({ termino: t, peso: pesos[t.id], puntos: puntosCon(t, pesos[t.id]) }));
}

export function mismosPesos(a: Pesos, b: Pesos, tolerancia = 1e-9): boolean {
  return IDS_BLANDAS.every((i) => Math.abs(a[i] - b[i]) <= tolerancia);
}
