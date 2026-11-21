import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Navegacion } from "@/components/navegacion";
import { Proveedores } from "@/components/proveedores";

import "./globals.css";

// Una sola familia (Inter); la jerarquía sale de tamaño y peso (ver globals.css)
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Mil clases, un solo horario",
  description:
    "Explorá cómo un modelo de optimización acomoda 1003 clases, 200 aulas y 287 docentes en una semana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Proveedores>
          <Navegacion />
          {children}
        </Proveedores>
      </body>
    </html>
  );
}
