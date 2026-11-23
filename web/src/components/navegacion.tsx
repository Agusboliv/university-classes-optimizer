"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SelectorTema } from "@/components/selector-tema";

const ENLACES = [
  { href: "/", texto: "Inicio" },
  { href: "/panel", texto: "Panel" },
  { href: "/analisis", texto: "Análisis" },
  { href: "/datos", texto: "Datos" },
] as const;

/** Navegación compartida. Queda fija durante las View Transitions (view-transition-name). */
export function Navegacion() {
  const ruta = usePathname();
  return (
    <header
      style={{ viewTransitionName: "navegacion" }}
      className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md"
    >
      <nav aria-label="Principal" className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-5">
        <Link href="/" className="whitespace-nowrap text-in-ui font-semibold tracking-tight">
          Horarios <span className="hidden font-normal text-tinta-2 sm:inline">· CP-SAT</span>
        </Link>
        <ul className="ml-auto flex items-center sm:gap-1">
          {ENLACES.map(({ href, texto }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={ruta === href ? "page" : undefined}
                className="rounded-md px-2 py-1.5 text-in-ui-sm sm:px-3 text-tinta-2 transition-colors hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
              >
                {texto}
              </Link>
            </li>
          ))}
        </ul>
        <SelectorTema />
      </nav>
    </header>
  );
}
