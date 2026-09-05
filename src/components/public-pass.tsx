"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Clock3,
  Loader2,
  LockKeyhole,
  LogIn,
} from "lucide-react";
import { Brand } from "./brand";
import { PassCard } from "./visitor/pass-card";
import { SavePassButton } from "./visitor/save-pass";
import { WalletButtons } from "./visitor/wallet-buttons";
import { Callout, cn } from "./ui";
import { LiveDuration } from "./ui-client";
import { isLiveMode } from "@/lib/config";
import {
  getShowcaseServerSnapshot,
  getShowcaseSnapshot,
  subscribeShowcase,
} from "@/lib/showcase-store";
import { showcaseOrganization } from "@/lib/demo-data";

type PassState = "valid" | "used" | "expired" | "revoked";

type Pass = {
  state: PassState;
  status: string;
  organizationName: string;
  visitorName: string;
  hostName: string;
  location: string;
  locationAddress: string;
  startsAt: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  purpose: string;
  accessRequirements: string;
  wallet?: { apple?: boolean; google?: boolean };
};

export function PublicPass({ token }: { token: string }) {
  const live = isLiveMode();

  /* En vitrina el pase refleja en vivo lo que hace el guardia en otra pestaña. */
  const showcaseState = useSyncExternalStore(
    subscribeShowcase,
    getShowcaseSnapshot,
    getShowcaseServerSnapshot,
  );
  const showcaseVisit = live
    ? undefined
    : showcaseState.visits.find((visit) => visit.qrToken === token);

  const [remotePass, setRemotePass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(live);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(
          `/api/public/passes/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("invalid");
        const data = (await response.json()) as Pass;
        if (active) setRemotePass(data);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live, token]);

  const pass: Pass | null = useMemo(() => {
    if (live) return remotePass;
    if (!showcaseVisit) return null;
    return {
      state:
        showcaseVisit.status === "cancelled" || showcaseVisit.status === "denied"
          ? "revoked"
          : showcaseVisit.status === "checked_out"
            ? "used"
            : "valid",
      status: showcaseVisit.status,
      organizationName: showcaseOrganization.name,
      visitorName: showcaseVisit.visitorName,
      hostName: showcaseVisit.hostName,
      location: showcaseVisit.location,
      locationAddress: showcaseVisit.locationAddress ?? "",
      startsAt: showcaseVisit.startsAt,
      checkedInAt: showcaseVisit.checkedInAt,
      checkedOutAt: showcaseVisit.checkedOutAt,
      purpose: showcaseVisit.purpose,
      accessRequirements: showcaseVisit.accessRequirements ?? "",
    };
  }, [live, remotePass, showcaseVisit]);

  if (loading)
    return (
      <Frame>
        <div className="py-24 text-center">
          <Loader2 className="mx-auto animate-spin text-[#10cfc9]" size={36} />
          <p className="mt-4 text-sm text-slate-400">Cargando tu pase…</p>
        </div>
      </Frame>
    );

  if (failed || !pass)
    return (
      <Frame>
        <Message
          icon={AlertTriangle}
          title="Pase no disponible"
          text="El enlace no existe, venció o fue revocado. Pide a tu anfitrión que te reenvíe el pase."
        />
      </Frame>
    );

  if (pass.state !== "valid")
    return (
      <Frame>
        <Message
          icon={pass.state === "used" ? BadgeCheck : Clock3}
          tone={pass.state === "used" ? "success" : "warning"}
          title={
            pass.state === "used"
              ? "Visita finalizada"
              : pass.state === "expired"
                ? "Pase vencido"
                : "Pase revocado"
          }
          text={
            pass.state === "used"
              ? "Tu salida ya quedó registrada. Gracias por tu visita."
              : "Contacta a tu anfitrión si necesitas un pase nuevo."
          }
        />
      </Frame>
    );

  const inside = pass.status === "checked_in";

  return (
    <Frame>
      {inside && (
        <div className="animate-rise mx-auto mb-5 flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/20 text-emerald-200">
            <LogIn size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Entrada registrada</p>
            <p className="text-xs text-emerald-200/90">
              <LiveDuration
                since={pass.checkedInAt ?? undefined}
                until={pass.checkedOutAt ?? undefined}
                prefix="Llevas "
              />{" "}
              dentro de las instalaciones
            </p>
          </div>
        </div>
      )}

      <PassCard
        token={token}
        visitorName={pass.visitorName}
        organizationName={pass.organizationName}
        hostName={pass.hostName}
        location={pass.location}
        startsAt={pass.startsAt}
        accessRequirements={pass.accessRequirements || undefined}
      />

      <div className="mx-auto mt-6 max-w-sm space-y-4">
        <SavePassButton
          token={token}
          visitorName={pass.visitorName}
          organizationName={pass.organizationName}
          hostName={pass.hostName}
          location={pass.location}
          startsAt={pass.startsAt}
          promptOnMount
        />
        <WalletButtons token={token} available={pass.wallet} />

        {pass.locationAddress && (
          <Callout
            tone="neutral"
            icon={Building2}
            className="border-white/10 bg-white/5 text-slate-300"
          >
            {pass.locationAddress}
          </Callout>
        )}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <LockKeyhole size={13} />
          El código contiene solo un token aleatorio, sin datos personales.
        </p>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark-panel min-h-screen text-white">
      <header className="safe-top border-b border-white/10">
        <div className="mx-auto flex h-15 max-w-2xl items-center justify-between px-5">
          <Brand dark href="#" />
          <span className="text-[11px] font-medium text-slate-400">
            Pase privado
          </span>
        </div>
      </header>
      <div className="safe-bottom mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </div>
    </main>
  );
}

function Message({
  icon: Icon,
  title,
  text,
  tone = "warning",
}: {
  icon: typeof AlertTriangle;
  title: string;
  text: string;
  tone?: "warning" | "success";
}) {
  return (
    <div className="py-16 text-center">
      <span
        className={cn(
          "mx-auto grid size-16 place-items-center rounded-full",
          tone === "success"
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-amber-500/15 text-amber-300",
        )}
      >
        <Icon size={30} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2.5 max-w-sm text-[15px] leading-6 text-slate-400">
        {text}
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex h-12 items-center rounded-2xl bg-white/10 px-5 text-sm font-semibold text-white"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
