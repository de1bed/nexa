"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PassCard } from "./visitor/pass-card";
import { SavePassButton } from "./visitor/save-pass";
import { CopyField, ShareButton } from "./ui-client";
import { Callout } from "./ui";
import { passValidityWindow } from "@/lib/pass-window";

/**
 * Pase QR en el panel del anfitrión o admin: visible, descargable y
 * compartible por WhatsApp/enlace. El correo es opcional.
 */
export function StaffPassPanel({
  visitId,
  visitorName,
  organizationName,
  hostName,
  location,
  startsAt,
  endsAt,
}: {
  visitId: string;
  visitorName: string;
  organizationName: string;
  hostName: string;
  location: string;
  startsAt: string;
  endsAt?: string;
}) {
  const [pass, setPass] = useState<{
    passToken: string;
    passUrl: string;
    expiresAt?: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/visits/${visitId}/pass`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          passToken?: string;
          passUrl?: string;
          expiresAt?: string;
          error?: string;
        };
        if (!response.ok || !payload.passToken || !payload.passUrl)
          throw new Error(payload.error ?? "No fue posible abrir el pase");
        if (active)
          setPass({
            passToken: payload.passToken,
            passUrl: payload.passUrl,
            expiresAt: payload.expiresAt,
          });
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "No fue posible abrir el pase",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [visitId]);

  if (error)
    return (
      <Callout tone="danger" className="mt-4">
        {error}
      </Callout>
    );

  if (!pass)
    return (
      <div className="mt-4 grid place-items-center rounded-[26px] border border-slate-200 bg-white py-12">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
      <PassCard
        token={pass.passToken}
        visitorName={visitorName}
        organizationName={organizationName}
        hostName={hostName}
        location={location}
        startsAt={startsAt}
        expiresAt={
          pass.expiresAt ??
          (endsAt
            ? passValidityWindow({ startsAt, endsAt }).expires_at
            : undefined)
        }
      />
      <div className="space-y-3 rounded-[26px] border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Pase QR</h2>
        <p className="text-sm leading-6 text-slate-500">
          Descárgalo o compártelo por WhatsApp. El código ya sirve desde que
          se emite; en caseta pueden pedirle esperar si llega antes del
          horario.
        </p>
        <SavePassButton
          token={pass.passToken}
          visitorName={visitorName}
          organizationName={organizationName}
          hostName={hostName}
          location={location}
          startsAt={startsAt}
        />
        <CopyField value={pass.passUrl} label="Enlace del pase" />
        <ShareButton
          url={pass.passUrl}
          title="Pase de acceso"
          text={`Hola ${visitorName}, este es tu pase QR:`}
          className="w-full"
        >
          Compartir pase
        </ShareButton>
      </div>
    </div>
  );
}
