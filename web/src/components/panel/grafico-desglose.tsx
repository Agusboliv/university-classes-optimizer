"use client";

import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { ETIQUETAS } from "@/lib/escenario";
import { numero, porcentaje, puntos } from "@/lib/formato";
import type { TerminoReponderado } from "@/lib/ponderacion";

type Echarts = typeof import("echarts/core");

let cargaEcharts: Promise<Echarts> | null = null;

/** Carga solo las piezas de ECharts que se usan (Canvas, barras, puntos, tooltip, leyenda). */
function cargarEcharts(): Promise<Echarts> {
  cargaEcharts ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers"),
  ]).then(([core, charts, componentes, renderers]) => {
    core.use([
      charts.BarChart, charts.ScatterChart, componentes.GridComponent, componentes.TooltipComponent,
      componentes.LegendComponent, componentes.AriaComponent, renderers.CanvasRenderer,
    ]);
    return core;
  });
  return cargaEcharts;
}

interface Colores {
  acento: string;
  tinta: string;
  tinta2: string;
  borde: string;
  superficie: string;
  fuente: string;
}

function leerColores(): Colores {
  const estilo = getComputedStyle(document.documentElement);
  const v = (n: string) => estilo.getPropertyValue(n).trim();
  return {
    acento: v("--acento"), tinta: v("--tinta"), tinta2: v("--tinta-2"), borde: v("--borde"),
    superficie: v("--superficie"), fuente: getComputedStyle(document.body).fontFamily,
  };
}

function textoTooltip(f: TerminoReponderado, cambiado: boolean): string {
  const { id, valor, maximo, puntos: original } = f.termino;
  const { nombre, unidad } = ETIQUETAS[id];
  const lineas = [
    `<strong>${id} · ${nombre}</strong>`,
    `Valor: ${numero(valor)} de ${numero(maximo)} ${unidad}`,
    `Peso: ${porcentaje(f.peso)}`,
    `Puntos: ${puntos(f.puntos)}${cambiado ? ` (original ${puntos(original)})` : ""}`,
  ];
  return lineas.join("<br/>");
}

function opciones(filas: readonly TerminoReponderado[], cambiado: boolean, c: Colores, reducido: boolean): EChartsOption {
  return {
    animation: !reducido,
    animationDurationUpdate: 300,
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      label: {
        description: `Puntos por penalización: ${filas
          .map((f) => `${f.termino.id} ${ETIQUETAS[f.termino.id].nombre} ${puntos(f.puntos)}`)
          .join("; ")}.`,
      },
    },
    textStyle: { fontFamily: c.fuente, color: c.tinta2 },
    grid: { left: 0, right: 56, top: cambiado ? 32 : 4, bottom: 0, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    legend: {
      show: cambiado, top: 0, right: 0, itemWidth: 12, itemHeight: 8,
      textStyle: { color: c.tinta2, fontSize: 12 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: c.borde, opacity: 0.4 } },
      backgroundColor: c.superficie,
      borderColor: c.borde,
      textStyle: { color: c.tinta, fontSize: 13, fontFamily: c.fuente },
      formatter: (params) => {
        const i = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0;
        return textoTooltip(filas[i], cambiado);
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
      data: filas.map((f) => `${f.termino.id}  ${ETIQUETAS[f.termino.id].nombre}`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.borde } },
      axisLabel: { color: c.tinta, fontSize: 13 },
    },
    series: [
      {
        name: "Con estos pesos",
        type: "bar",
        data: filas.map((f) => f.puntos),
        barWidth: 14,
        itemStyle: { color: c.acento, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: c.tinta, fontSize: 12, formatter: (p) => puntos(Number(p.value)) },
      },
      ...(cambiado
        ? [{
            name: "Pesos originales",
            type: "scatter" as const,
            data: filas.map((f) => f.termino.puntos),
            symbol: "rect",
            symbolSize: [3, 22],
            itemStyle: { color: c.tinta2 },
            z: 3,
          }]
        : []),
    ],
  };
}

interface GraficoDesgloseProps {
  filas: readonly TerminoReponderado[];
  cambiado: boolean;
}

/** Barras horizontales de puntos por B_i (ECharts en Canvas). La tabla de al lado tiene los mismos datos. */
export function GraficoDesglose({ filas, cambiado }: GraficoDesgloseProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const grafico = useRef<EChartsType | null>(null);
  const [listo, setListo] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let vivo = true;
    let observador: ResizeObserver | undefined;
    cargarEcharts().then((echarts) => {
      if (!vivo || !contenedor.current) return;
      grafico.current = echarts.init(contenedor.current, undefined, { renderer: "canvas" });
      observador = new ResizeObserver(() => grafico.current?.resize());
      observador.observe(contenedor.current);
      setListo(true);
    });
    return () => {
      vivo = false;
      observador?.disconnect();
      grafico.current?.dispose();
      grafico.current = null;
    };
  }, []);

  useEffect(() => {
    if (!listo || !grafico.current) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    grafico.current.setOption(opciones(filas, cambiado, leerColores(), reducido), { replaceMerge: ["series"] });
  }, [listo, filas, cambiado, resolvedTheme]);

  return (
    <div
      ref={contenedor}
      className="h-72 w-full"
      role="img"
      aria-label="Gráfico de barras con los puntos de cada penalización B1 a B6. Los valores están en la tabla."
    />
  );
}
