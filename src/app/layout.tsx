import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DemoProvider } from "@/components/demo-provider";
import { OfflineBanner } from "@/components/offline-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEXA VISIT — Control inteligente de visitantes",
  description: "Preregistro, pases QR y control de acceso empresarial en una experiencia segura y sin fricción.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><DemoProvider><OfflineBanner/>{children}</DemoProvider></body>
    </html>
  );
}
