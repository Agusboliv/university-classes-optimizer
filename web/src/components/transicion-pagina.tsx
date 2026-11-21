import { ViewTransition, type ReactNode } from "react";

/**
 * Envuelve el contenido de cada page.tsx (no el layout: el layout persiste y ahí
 * enter/exit no se disparan). La animación está en globals.css (.pagina-entra/.pagina-sale).
 */
export function TransicionPagina({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="pagina-entra" exit="pagina-sale" default="none">
      {children}
    </ViewTransition>
  );
}
