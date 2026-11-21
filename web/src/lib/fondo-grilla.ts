// Fondo generativo de la portada: una grilla semanal con bloques de clases que
// se van reacomodando. Funciones puras: cada paso devuelve una grilla nueva.

export const DIAS = 5;
export const CARRILES_POR_DIA = 4; // "aulas" por día
export const SLOTS = 28; // 08:00 a 22:00 en bloques de 30 min
const CARRILES = DIAS * CARRILES_POR_DIA;
const CANTIDAD_BLOQUES = 60;
const COLORES_MATERIA = 8;

export interface Bloque {
  readonly carril: number; // destino
  readonly slot: number;
  readonly largo: number; // en slots
  readonly color: number; // índice 0..7 de --materia-*
  readonly x: number; // posición actual (en carriles)
  readonly y: number; // posición actual (en slots)
}

export type Azar = () => number;

/** PRNG determinista (mulberry32): el cuadro fijo es siempre el mismo. */
export function crearAzar(semilla: number): Azar {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entero = (azar: Azar, max: number): number => Math.floor(azar() * max);

function libre(bloques: readonly Bloque[], carril: number, slot: number, largo: number, ignorar?: Bloque): boolean {
  return bloques.every(
    (b) => b === ignorar || b.carril !== carril || slot + largo <= b.slot || b.slot + b.largo <= slot,
  );
}

function destinoLibre(
  bloques: readonly Bloque[], azar: Azar, largo: number, ignorar?: Bloque,
): { carril: number; slot: number } | null {
  for (let intento = 0; intento < 40; intento++) {
    const carril = entero(azar, CARRILES);
    const slot = entero(azar, SLOTS - largo + 1);
    if (libre(bloques, carril, slot, largo, ignorar)) return { carril, slot };
  }
  return null;
}

/** Grilla inicial ya acomodada (sirve como cuadro fijo con reduced-motion). */
export function crearGrilla(azar: Azar): readonly Bloque[] {
  let bloques: readonly Bloque[] = [];
  for (let i = 0; i < CANTIDAD_BLOQUES; i++) {
    const largo = 2 + entero(azar, 5);
    const destino = destinoLibre(bloques, azar, largo);
    if (destino) {
      bloques = [...bloques, { ...destino, largo, color: entero(azar, COLORES_MATERIA), x: destino.carril, y: destino.slot }];
    }
  }
  return bloques;
}

/** Elige unos pocos bloques y les asigna un destino libre nuevo. */
export function reacomodar(bloques: readonly Bloque[], azar: Azar, cuantos = 3): readonly Bloque[] {
  let resultado = bloques;
  for (let i = 0; i < cuantos; i++) {
    const elegido = resultado[entero(azar, resultado.length)];
    const destino = destinoLibre(resultado, azar, elegido.largo, elegido);
    if (destino) resultado = resultado.map((b) => (b === elegido ? { ...b, ...destino } : b));
  }
  return resultado;
}

/** Acerca cada bloque a su destino (suavizado exponencial). */
export function avanzar(bloques: readonly Bloque[], factor = 0.06): readonly Bloque[] {
  return bloques.map((b) => {
    const dx = b.carril - b.x;
    const dy = b.slot - b.y;
    if (dx === 0 && dy === 0) return b;
    if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) return { ...b, x: b.carril, y: b.slot };
    return { ...b, x: b.x + dx * factor, y: b.y + dy * factor };
  });
}

export interface ColoresFondo {
  readonly materias: readonly string[];
  readonly linea: string;
  readonly alfaRelleno: number;
}

export function dibujar(
  ctx: CanvasRenderingContext2D, bloques: readonly Bloque[], ancho: number, alto: number, colores: ColoresFondo,
): void {
  const anchoCarril = ancho / CARRILES;
  const altoSlot = alto / SLOTS;
  ctx.clearRect(0, 0, ancho, alto);

  // Líneas de hora (cada 2 slots) y separadores de día
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = colores.linea;
  for (let s = 0; s <= SLOTS; s += 2) ctx.fillRect(0, Math.round(s * altoSlot), ancho, 1);
  for (let d = 1; d < DIAS; d++) ctx.fillRect(Math.round(d * CARRILES_POR_DIA * anchoCarril), 0, 1, alto);

  for (const b of bloques) {
    const x = b.x * anchoCarril + 3;
    const y = b.y * altoSlot + 2;
    const w = anchoCarril - 6;
    const h = b.largo * altoSlot - 4;
    ctx.fillStyle = colores.materias[b.color];
    ctx.globalAlpha = colores.alfaRelleno;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.globalAlpha = 0.55; // franja izquierda (es el peor caso del cálculo de contraste)
    ctx.fillRect(x, y, 3, h);
  }
  ctx.globalAlpha = 1;
}
