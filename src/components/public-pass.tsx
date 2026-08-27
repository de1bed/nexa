/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Check,
  Download,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { Brand } from "./brand";
type Pass = {
  state: string;
  status: string;
  visitorName: string;
  hostName: string;
  location: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
};
export function PublicPass({ token }: { token: string }) {
  const [pass, setPass] = useState<Pass | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(`/api/public/passes/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Pass>;
      })
      .then((data) => {
        setPass(data);
        return QRCode.toDataURL(token, {
          width: 360,
          margin: 2,
          color: { dark: "#071426", light: "#ffffff" },
        });
      })
      .then(setQr)
      .catch(() => setError(true));
  }, [token]);
  if (error)
    return (
      <Frame>
        <State
          icon={<AlertTriangle />}
          title="Pase no disponible"
          text="El enlace es inválido, venció o fue revocado."
        />
      </Frame>
    );
  if (!pass)
    return (
      <Frame>
        <div className="py-16 text-center">
          <LoaderCircle className="mx-auto animate-spin text-[#10aaa5]" />
          <p className="mt-3 text-sm text-slate-500">Cargando pase…</p>
        </div>
      </Frame>
    );
  if (pass.state !== "valid")
    return (
      <Frame>
        <State
          icon={pass.state === "used" ? <Check /> : <AlertTriangle />}
          title={
            pass.state === "used"
              ? "Pase utilizado"
              : pass.state === "expired"
                ? "Pase vencido"
                : "Pase revocado"
          }
          text={
            pass.state === "used"
              ? "La salida de esta visita ya fue registrada."
              : "Contacta a tu anfitrión si necesitas ayuda."
          }
        />
      </Frame>
    );
  const date = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(pass.startsAt));
  return (
    <Frame>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Check />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Tu pase está listo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Muéstralo al personal de seguridad.
        </p>
        <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-slate-200 p-5 shadow-lg">
          <p className="text-xs font-semibold tracking-widest text-slate-400">
            NEXA VISIT PASS
          </p>
          {qr && (
            <img
              src={qr}
              alt="Código QR de acceso"
              className="mx-auto my-4 w-64"
            />
          )}
          <p className="font-semibold">{pass.visitorName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {pass.hostName} · {pass.location}
          </p>
          <p className="mt-1 text-xs text-slate-400">{date}</p>
        </div>
        {qr && (
          <a
            download="nexa-visit-pass.png"
            href={qr}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white"
          >
            <Download size={17} />
            Descargar pase
          </a>
        )}
        <p className="mt-5 text-xs text-slate-400">
          <LockKeyhole className="mr-1 inline" size={12} />
          El QR no contiene datos personales.
        </p>
      </div>
    </Frame>
  );
}
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Brand />
          <span className="text-xs text-slate-500">Pase privado</span>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-3xl border bg-white p-7 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
function State({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="py-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50 text-amber-600">
        {icon}
      </span>
      <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}
