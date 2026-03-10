import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "GRIXI — La interconexión inteligente de toda la empresa",
    template: "%s | GRIXI",
  },
  description:
    "Plataforma enterprise que conecta, visualiza y gestiona la información de tu empresa de manera inteligente. Multi-tenant, IA integrada, visualización 3D.",
  keywords: [
    "enterprise",
    "SaaS",
    "multi-tenant",
    "warehouse",
    "3D",
    "inteligencia artificial",
    "tiempo real",
    "interconexión",
  ],
  authors: [{ name: "GRIXI" }],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://grixi.vercel.app",
    siteName: "GRIXI",
    title: "GRIXI — La interconexión inteligente de toda la empresa",
    description:
      "Plataforma enterprise que conecta, visualiza y gestiona la información de tu empresa de manera inteligente.",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "GRIXI Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GRIXI — La interconexión inteligente",
    description:
      "Plataforma enterprise multi-tenant con IA, visualización 3D de almacenes, y auditoría inteligente.",
    images: ["/brand/og-image.png"],
  },
  icons: {
    icon: "/brand/icon.png",
    apple: "/brand/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
