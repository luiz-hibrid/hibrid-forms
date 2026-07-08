import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonte proprietária da marca (self-hosted)
const brFirma = localFont({
  src: [
    { path: "./fonts/BRFirma-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/BRFirma-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/BRFirma-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/BRFirma-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/BRFirma-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/BRFirma-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hibrid Forms",
  description: "Formulários inteligentes de captação",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={brFirma.variable}>
      <body>{children}</body>
    </html>
  );
}
