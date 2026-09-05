import { NextResponse } from "next/server";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

/**
 * Autocompletado de direcciones. Photon (OpenStreetMap) no cobra ni pide
 * llave; lo servimos por aquí para no abrir la CSP del navegador.
 */
export async function GET(request: Request) {
  const limit = rateLimit(`places:${requestOrigin(request)}`, 30, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiadas búsquedas" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 4) return NextResponse.json({ places: [] });

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("lang", "es");
    url.searchParams.set("limit", "6");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("photon");

    const body = (await response.json()) as { features?: PhotonFeature[] };
    const places = (body.features ?? [])
      .map((feature, index) => {
        const label = formatPlace(feature.properties ?? {});
        return label ? { id: `${index}-${label}`, label } : null;
      })
      .filter((item): item is { id: string; label: string } => Boolean(item));

    return NextResponse.json(
      { places },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ places: [] });
  }
}

function formatPlace(properties: NonNullable<PhotonFeature["properties"]>) {
  const street = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(" ");
  const locality =
    properties.city || properties.town || properties.village || properties.district;
  const parts = [
    street || properties.name,
    properties.district && properties.district !== locality
      ? properties.district
      : null,
    locality,
    properties.state,
    properties.country,
  ].filter(Boolean);
  return [...new Set(parts)].join(", ");
}
