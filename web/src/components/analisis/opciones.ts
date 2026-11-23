// Opciones de ECharts para los gráficos de /analisis (barras por categoría y mapa de calor).

import type { EChartsOption } from "echarts";

import type { Colores } from "@/lib/echarts";
import { numero } from "@/lib/formato";

export interface SerieBarras {
  readonly nombre: string;
  readonly valores: readonly number[];
  readonly color: string;
}

interface OpcionesBarras {
  readonly categorias: readonly string[];
  readonly series: readonly SerieBarras[];
  readonly colores: Colores;
  readonly apilado?: boolean;
  readonly maximo?: number;
  /** Texto del tooltip por categoría (i = índice de la categoría). */
  readonly tooltip?: (i: number) => string;
}

/** Barras verticales finas; con 2+ series, leyenda y apiladas con 2 px de separación. */
export function opcionesBarras({ categorias, series, colores: c, apilado = false, maximo, tooltip }: OpcionesBarras): EChartsOption {
  const variasSeries = series.length > 1;
  return {
    aria: {
      enabled: true,
      label: {
        description: series
          .map((s) => `${s.nombre}: ${categorias.map((cat, i) => `${cat} ${numero(s.valores[i])}`).join(", ")}`)
          .join(". "),
      },
    },
    grid: { left: 0, right: 8, top: variasSeries ? 36 : 24, bottom: 0, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    legend: { show: variasSeries, top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: c.tinta2, fontSize: 12 } },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: c.borde, opacity: 0.4 } },
      backgroundColor: c.superficie,
      borderColor: c.borde,
      textStyle: { color: c.tinta, fontSize: 13, fontFamily: c.fuente },
      formatter: (params) => {
        const i = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0;
        if (tooltip) return tooltip(i);
        return [`<strong>${categorias[i]}</strong>`, ...series.map((s) => `${s.nombre}: ${numero(s.valores[i])}`)].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: [...categorias],
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.borde } },
      axisLabel: { color: c.tinta, fontSize: 12 },
    },
    yAxis: {
      type: "value",
      max: maximo,
      splitLine: { lineStyle: { color: c.borde } },
      axisLabel: { color: c.tinta2, formatter: (v: number) => numero(v) },
    },
    series: series.map((s, k) => ({
      name: s.nombre,
      type: "bar" as const,
      stack: apilado ? "total" : undefined,
      data: [...s.valores],
      barMaxWidth: 36,
      itemStyle: {
        color: s.color,
        // extremo redondeado solo arriba de todo; 2 px de superficie entre segmentos apilados
        borderRadius: !apilado || k === series.length - 1 ? [4, 4, 0, 0] : 0,
        borderColor: c.superficie,
        borderWidth: apilado ? 1 : 0,
      },
      label: {
        show: !variasSeries,
        position: "top" as const,
        color: c.tinta,
        fontSize: 12,
        formatter: (p: { value?: unknown }) => numero(Number(p.value)),
      },
    })),
  };
}

interface OpcionesMapaCalor {
  readonly filas: readonly string[]; // días
  readonly columnas: readonly string[]; // horas
  readonly valores: readonly (readonly (number | null)[])[]; // [fila][columna]
  readonly maximo: number;
  /** Unidad para las etiquetas de la escala (ej. " %"). */
  readonly sufijo?: string;
  readonly colores: Colores;
  readonly tooltip: (fila: number, columna: number) => string;
  readonly descripcion: string;
}

/** Mapa de calor día × hora, un solo tono (superficie → acento). Celdas null = fuera de franja (vacías). */
export function opcionesMapaCalor(
  { filas, columnas, valores, maximo, sufijo = "", colores: c, tooltip, descripcion }: OpcionesMapaCalor,
): EChartsOption {
  const datos = valores.flatMap((fila, y) => fila.map((v, x) => [x, y, v === null ? "-" : v]));
  return {
    aria: { enabled: true, label: { description: descripcion } },
    grid: { left: 0, right: 8, top: 4, bottom: 48, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    tooltip: {
      backgroundColor: c.superficie,
      borderColor: c.borde,
      textStyle: { color: c.tinta, fontSize: 13, fontFamily: c.fuente },
      formatter: (p) => {
        const valor = (Array.isArray(p) ? p[0] : p)?.value;
        return Array.isArray(valor) ? tooltip(Number(valor[1]), Number(valor[0])) : "";
      },
    },
    xAxis: {
      type: "category",
      data: [...columnas],
      splitArea: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: c.tinta2, fontSize: 12 },
    },
    yAxis: {
      type: "category",
      data: [...filas],
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: c.tinta, fontSize: 12 },
    },
    visualMap: {
      min: 0,
      max: maximo,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemHeight: 160,
      itemWidth: 10,
      text: [`${numero(maximo)}${sufijo}`, `0${sufijo}`],
      inRange: { color: [c.superficie, c.acento] },
      textStyle: { color: c.tinta2, fontSize: 12 },
    },
    series: [
      {
        type: "heatmap",
        data: datos,
        itemStyle: { borderColor: c.superficie, borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: c.tinta, borderWidth: 1 } },
      },
    ],
  };
}
