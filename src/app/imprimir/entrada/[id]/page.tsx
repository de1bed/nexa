/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { isLiveMode } from "@/lib/config";
import { getSessionContext, requirePortalRole } from "@/lib/server/session";
import { logoPublicUrl, walkinUrl } from "@/lib/server/walkin";
import { PrintButton } from "@/components/print-button";
import { showcaseLocations, showcaseOrganization } from "@/lib/demo-data";

export const metadata = { title: "QR de recepción" };
export const dynamic = "force-dynamic";

/**
 * Hoja imprimible del QR de recepción: logo de NEXA, logo de la empresa, el QR
 * y el código de 4 dígitos. Solo administración la abre; el QR y el código se
 * leen con su sesión (RLS).
 */
export default async function Page(props: PageProps<"/imprimir/entrada/[id]">) {
  const portal = await requirePortalRole(["superadmin", "admin"]);
  const { id } = await props.params;
  const sheet = isLiveMode() ? await liveSheet(id, portal.organizationId) : demoSheet(id);
  if (!sheet) notFound();
  const { organization, location, url, code, active, logo } = sheet;
  const qr = await QRCode.toDataURL(url, {
    width: 900,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#071426", light: "#ffffff" },
  });

  return (
    <main className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <style>{`@page { size: letter; margin: 12mm; }`}</style>

      <div className="mx-auto mb-6 flex max-w-[8.5in] items-center justify-between gap-4 px-4 print:hidden">
        <p className="text-sm text-slate-600">
          {active
            ? "Imprime esta hoja y colócala en la entrada de la sede."
            : "Este QR está en pausa: no aceptará registros hasta reanudarlo."}
        </p>
        <PrintButton />
      </div>

      <article className="mx-auto flex max-w-[8.5in] flex-col items-center bg-white px-12 py-12 text-center text-[#071426] shadow-xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex w-full items-center justify-between gap-6">
          <img src="/brand/logo.png" alt="NEXA VISIT" className="h-14 w-auto" />
          {logo ? (
            <img
              src={logo}
              alt={organization}
              className="h-20 max-w-[45%] object-contain"
            />
          ) : (
            <span className="text-right text-xl font-semibold">
              {organization}
            </span>
          )}
        </header>

        <h1 className="mt-10 text-5xl font-semibold tracking-[-.03em]">
          Registra tu visita
        </h1>
        <p className="mt-2 text-xl text-slate-500">Register your visit</p>
        <p className="mt-4 text-lg font-medium">
          {organization}
          {location ? ` · ${location}` : ""}
        </p>

        <img
          src={qr}
          alt={`QR de registro: ${url}`}
          className="mt-8 size-[4.2in] rounded-3xl border-4 border-[#071426] p-3"
        />

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[.25em] text-slate-500">
            Código de acceso · Access code
          </p>
          <p className="mt-2 font-mono text-[88px] font-bold leading-none tracking-[.35em]">
            {code}
          </p>
        </div>

        <ol className="mt-10 grid w-full grid-cols-3 gap-4 text-left text-sm leading-6">
          <li className="rounded-2xl bg-slate-100 p-4 print:border print:border-slate-300 print:bg-white">
            <b className="block text-base">1. Escanea el QR</b>
            Con la cámara de tu teléfono.
            <span className="block text-slate-500">Scan with your phone camera.</span>
          </li>
          <li className="rounded-2xl bg-slate-100 p-4 print:border print:border-slate-300 print:bg-white">
            <b className="block text-base">2. Escribe el código</b>
            Los 4 dígitos de esta hoja.
            <span className="block text-slate-500">Enter the 4-digit code.</span>
          </li>
          <li className="rounded-2xl bg-slate-100 p-4 print:border print:border-slate-300 print:bg-white">
            <b className="block text-base">3. Completa tu registro</b>
            Elige a quién visitas y recibe tu pase.
            <span className="block text-slate-500">Get your pass.</span>
          </li>
        </ol>

        <footer className="mt-10 text-xs text-slate-400">
          Control de accesos con NEXA VISIT
        </footer>
      </article>
    </main>
  );
}

type Sheet = {
  organization: string;
  location: string;
  url: string;
  code: string;
  active: boolean;
  logo: string | null;
};

async function liveSheet(id: string, organizationId: string): Promise<Sheet | null> {
  const { db } = await getSessionContext();
  const { data: point } = await db
    .from("walkin_points")
    .select("public_token,access_code,active,location:locations(name)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!point) return null;

  const { data: organization } = await db
    .from("organizations")
    .select("name,logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  return {
    organization: (organization?.name as string) ?? "",
    location:
      (point.location as unknown as { name?: string } | null)?.name ?? "",
    url: walkinUrl(point.public_token as string),
    code: String(point.access_code),
    active: Boolean(point.active),
    logo: logoPublicUrl(organization?.logo_path as string | null),
  };
}

/** Vitrina: hoja de ejemplo con el código de prueba 1234. */
function demoSheet(id: string): Sheet | null {
  const location = showcaseLocations.find((item) => `demo-${item.id}` === id);
  if (!location) return null;
  return {
    organization: showcaseOrganization.name,
    location: location.name,
    url: walkinUrl(id),
    code: "1234",
    active: true,
    logo: null,
  };
}
