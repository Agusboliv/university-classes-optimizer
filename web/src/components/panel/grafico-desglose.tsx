"use client";

import type { EChartsOption } from "echarts";
import { useCallback } from "react";

import { Grafico } from "@/components/grafico";
import type { Colores } from "@/lib/echarts";
import { ETIQUETAS, type TerminoDesglose } from "@/lib/escenario";
import { numero, porcentaje, puntos } from "@/lib/formato";

function textoTooltip(t: TerminoDesglose): string {
  const { nombre, unidad } = ETIQUETAS[t.id];
  return [
    `<strong>${t.id} · ${nombre}</strong>`,
    `Valor: ${numero(t.valor)} de ${numero(t.maximo)} ${unidad}`,
    `Peso: ${porcentaje(t.peso)}`,
    `Puntos: ${puntos(t.puntos)}`,
  ].join("<br/>");
}

function opciones(desglose: readonly TerminoDesglose[], c: Colores): EChartsOption {
  return {
    aria: {
      enabled: true,
      label: {
        description: `Puntos por penalización: ${desglose
          .map((t) => `${t.id} ${ETIQUETAS[t.id].nombre} ${puntos(t.puntos)}`)
          .join("; ")}.`,
      },
    },
    grid: { left: 0, right: 56, top: 4, bottom: 0, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: c.borde, opacity: 0.4 } },
      backgroundColor: c.superficie,
      borderColor: c.borde,
      textStyle: { color: c.tinta, fontSize: 13, fontFamily: c.fuente },
      formatter: (params) => {
        const i = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0;
        return textoTooltip(desglose[i]);
      },
    },
    xAxis: {
      type: "value", // máximo automático (ECharts redondea); grid.right deja lugar a las etiquetas
      splitLine: { lineStyle: { color: c.borde } },
      axisLabel: { color: c.tinta2, formatter: (v: number) => numero(v) },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: desglose.map((t) => `${t.id}  ${ETIQUETAS[t.id].nombre}`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.borde } },
      axisLabel: { color: c.tinta, fontSize: 13 },
    },
    series: [
      {
        name: "Puntos",
        type: "bar",
        data: desglose.map((t) => t.puntos),
        barWidth: 14,
        itemStyle: { color: c.acento, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: c.tinta, fontSize: 12, formatter: (p) => puntos(Number(p.value)) },
      },
    ],
  };
}

/** Barras horizontales de puntos por B_i (ECharts en Canvas). La tabla de al lado tiene los mismos datos. */
export function GraficoDesglose({ desglose }: { desglose: readonly TerminoDesglose[] }) {
  const armar = useCallback((c: Colores) => opciones(desglose, c), [desglose]);
  return (
    <Grafico
      opciones={armar}
      className="h-72"
      etiqueta="Gráfico de barras con los puntos de cada penalización B1 a B6. Los valores están en la tabla."
    />
  );
}
