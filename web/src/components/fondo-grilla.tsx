"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { avanzar, crearAzar, crearGrilla, dibujar, reacomodar, type ColoresFondo } from "@/lib/fondo-grilla";

const FPS_MAX = 30;
const MS_ENTRE_REACOMODOS = 1400;
const SEMILLA = 20261121;

function leerColores(): ColoresFondo {
  const estilo = getComputedStyle(document.documentElement);
  const variable = (nombre: string) => estilo.getPropertyValue(nombre).trim();
  return {
    materias: Array.from({ length: 8 }, (_, i) => variable(`--materia-${i + 1}`)),
    linea: variable("--borde"),
    alfaRelleno: document.documentElement.classList.contains("dark") ? 0.2 : 0.16,
  };
}

/**
 * Grilla semanal generativa en canvas 2D. Tope de 30 fps; se pausa con la pestaña
 * oculta o fuera de pantalla; con prefers-reduced-motion dibuja un solo cuadro.
 */
export function FondoGrilla({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const azar = crearAzar(SEMILLA);
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)");
    const colores = leerColores();
    let bloques = crearGrilla(azar);
    let tam = { ancho: 0, alto: 0 };
    let raf = 0;
    let ultimoCuadro = 0;
    let ultimoReacomodo = 0;
    let enPantalla = true;

    const pintar = () => dibujar(ctx, bloques, tam.ancho, tam.alto, colores);

    const cuadro = (t: number) => {
      raf = requestAnimationFrame(cuadro);
      if (t - ultimoCuadro < 1000 / FPS_MAX) return;
      ultimoCuadro = t;
      if (t - ultimoReacomodo > MS_ENTRE_REACOMODOS) {
        bloques = reacomodar(bloques, azar);
        ultimoReacomodo = t;
      }
      bloques = avanzar(bloques);
      pintar();
    };

    const actualizar = () => {
      const animar = enPantalla && !document.hidden && !reducido.matches;
      if (animar && !raf) raf = requestAnimationFrame(cuadro);
      if (!animar && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tam = { ancho: canvas.clientWidth, alto: canvas.clientHeight };
      canvas.width = Math.round(tam.ancho * dpr);
      canvas.height = Math.round(tam.alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pintar();
    };

    const observadorTam = new ResizeObserver(redimensionar);
    const observadorVista = new IntersectionObserver(([entrada]) => {
      enPantalla = entrada.isIntersecting;
      actualizar();
    });
    observadorTam.observe(canvas);
    observadorVista.observe(canvas);
    document.addEventListener("visibilitychange", actualizar);
    reducido.addEventListener("change", actualizar);
    redimensionar();
    actualizar();

    return () => {
      cancelAnimationFrame(raf);
      observadorTam.disconnect();
      observadorVista.disconnect();
      document.removeEventListener("visibilitychange", actualizar);
      reducido.removeEventListener("change", actualizar);
    };
  }, [resolvedTheme]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
