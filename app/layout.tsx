import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agenda SM",
  description: "Agenda privada de SM Soluciones",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-sm-soluciones.png",
    apple: "/logo-sm-soluciones.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#104080",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <script src="/pwa-register.js" async />
      </body>
    </html>
  );
}
