import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SM Content Studio",
  description: "Estudio privado para producir y administrar contenido de GPC, SM Soluciones y LEM",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#202733",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
