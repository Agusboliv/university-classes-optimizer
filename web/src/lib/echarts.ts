// ECharts sobre Canvas: solo las piezas que se usan, cargadas bajo demanda en el cliente.
// Colores tomados de los tokens CSS (globals.css), así siguen al tema claro/oscuro.

export type Echarts = typeof import("echarts/core");

let carga: Promise<Echarts> | null = null;

export function cargarEcharts(): Promise<Echarts> {
  carga ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers"),
  ]).then(([core, charts, componentes, renderers]) => {
    core.use([
      charts.BarChart, charts.ScatterChart, charts.HeatmapChart,
      componentes.GridComponent, componentes.TooltipComponent, componentes.LegendComponent,
      componentes.AriaComponent, componentes.VisualMapComponent, renderers.CanvasRenderer,
    ]);
    return core;
  });
  return carga;
}

export interface Colores {
  readonly acento: string;
  readonly tinta: string;
  readonly tinta2: string;
  readonly borde: string;
  readonly superficie: string;
  readonly fuente: string;
  readonly materias: readonly string[]; // --materia-1..8, orden fijo
}

export function leerColores(): Colores {
  const estilo = getComputedStyle(document.documentElement);
  const v = (n: string) => estilo.getPropertyValue(n).trim();
  return {
    acento: v("--acento"),
    tinta: v("--tinta"),
    tinta2: v("--tinta-2"),
    borde: v("--borde"),
    superficie: v("--superficie"),
    fuente: getComputedStyle(document.body).fontFamily,
    materias: Array.from({ length: 8 }, (_, i) => v(`--materia-${i + 1}`)),
  };
}

export const movimientoReducido = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
