"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

const CURVA_SALIDA = [0.22, 1, 0.36, 1] as const;
const ESCALON_S = 0.06;

interface EntradaProps {
  children: ReactNode;
  /** Posición en la secuencia: cada paso agrega 60 ms de retraso. */
  orden?: number;
  className?: string;
}

/** Entrada escalonada: opacidad + 8 px hacia arriba (solo transform y opacity). */
export function Entrada({ children, orden = 0, className }: EntradaProps) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: CURVA_SALIDA, delay: orden * ESCALON_S }}
    >
      {children}
    </m.div>
  );
}

/** Panel con hover sutil: se eleva 2 px. */
export function PanelInteractivo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.section className={className} whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: CURVA_SALIDA }}>
      {children}
    </m.section>
  );
}
