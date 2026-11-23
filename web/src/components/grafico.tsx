"use client";

import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { cargarEcharts, leerColores, movimientoReducido, type Colores } from "@/lib/echarts";
import { cn } from "@/lib/utils";

interface GraficoProps {
  /** Arma las opciones con los colores del tema. Memorizarla con useCallback (si cambia, se redibuja). */
  opciones: (colores: Colores) => EChartsOption;
  /** Descripción para lectores de pantalla (el canvas no tiene texto). */
  etiqueta: string;
  className?: string;
}

/** Gráfico ECharts genérico en Canvas: tema claro/oscuro, redimensionado y animación nativa (off con reduced-motion). */
export function Grafico({ opciones, etiqueta, className }: GraficoProps) {
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
    const c = leerColores();
    grafico.current.setOption(
      { textStyle: { fontFamily: c.fuente, color: c.tinta2 }, ...opciones(c), animation: !movimientoReducido() },
      { notMerge: true },
    );
  }, [listo, opciones, resolvedTheme]);

  return <div ref={contenedor} role="img" aria-label={etiqueta} className={cn("h-64 w-full", className)} />;
}
