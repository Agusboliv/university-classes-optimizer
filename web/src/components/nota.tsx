import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Nota de definición o aclaración (escala de instrumento, con ícono). */
export function Nota({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex gap-2 text-in-ui-sm text-tinta-2", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
