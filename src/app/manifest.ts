import type { MetadataRoute } from "next";

/**
 * Manifiesto de aplicación instalable.
 *
 * En la caseta y en recepción el equipo abre la plataforma decenas de veces al
 * día: instalarla en la pantalla de inicio elimina la barra del navegador, gana
 * altura útil y permite atajos directos al escáner y a la invitación.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEXA VISIT — Control de visitantes",
    short_name: "NEXA VISIT",
    description:
      "Preregistro desde el teléfono, pases QR y control de acceso en tiempo real.",
    lang: "es-MX",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#071426",
    theme_color: "#071426",
    categories: ["business", "productivity", "security"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      {
        name: "Escanear un pase",
        short_name: "Escanear",
        description: "Abrir el escáner de la caseta",
        url: "/guard/scan",
      },
      {
        name: "Nueva invitación",
        short_name: "Invitar",
        description: "Crear una invitación de visita",
        url: "/app/visits/new",
      },
    ],
  };
}
