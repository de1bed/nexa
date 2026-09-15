import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { OfflineBanner } from "@/components/offline-banner";
import { I18nProvider } from "@/components/i18n-provider";
import { isLocale } from "@/lib/i18n/types";
import { LOCALE_COOKIE } from "@/lib/i18n/types";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "NEXA VISIT — Control inteligente de visitantes",
    template: "%s · NEXA VISIT",
  },
  description:
    "Preregistro desde el teléfono, pases QR y control de acceso en tiempo real para empresas.",
  applicationName: "NEXA VISIT",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NEXA VISIT" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#071426",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const initialLocale = isLocale(raw) ? raw : "es";

  return (
    <html
      lang={initialLocale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider initialLocale={initialLocale}>
          <OfflineBanner />
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{ style: { borderRadius: "16px" } }}
          />
        </I18nProvider>
      </body>
    </html>
  );
}
