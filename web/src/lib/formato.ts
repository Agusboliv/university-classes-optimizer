// Números en castellano rioplatense (coma decimal, punto de miles).

const formateadores = new Map<number, Intl.NumberFormat>();

function formateador(decimales: number): Intl.NumberFormat {
  let f = formateadores.get(decimales);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    formateadores.set(decimales, f);
  }
  return f;
}

export const numero = (n: number, decimales = 0): string => formateador(decimales).format(n);
export const puntos = (n: number): string => numero(n, 2);
export const segundos = (n: number): string => `${numero(n, 1)} s`;
export const porcentaje = (n: number, decimales = 1): string => `${numero(n, decimales)} %`;
