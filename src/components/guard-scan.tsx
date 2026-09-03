"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Car,
  CheckCircle2,
  Clock3,
  FileWarning,
  Keyboard,
  LogIn,
  LogOut,
  ScanLine,
  ShieldX,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, Callout, EmptyState, StatusPill, cn } from "./ui";
import { LiveDuration, Sheet } from "./ui-client";
import { accessWindow, type Visit } from "@/lib/domain";
import { findShowcaseVisit } from "@/lib/showcase-store";

type Mode = "home" | "camera" | "result" | "done";
type Decision = "checked_in" | "checked_out" | "denied";

/** Vibración corta: confirma la lectura sin mirar la pantalla. */
function haptic(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate(pattern);
}

export function GuardScan() {
  const { live, visits, decide, settings, reload } = useWorkspace();
  const [mode, setMode] = useState<Mode>("home");
  const [manualToken, setManualToken] = useState("");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [tokenState, setTokenState] = useState<string>("valid");
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [overrideWindow, setOverrideWindow] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null,
  );
  const resolvingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      // El lector ya estaba detenido.
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => () => void stopScanner(), [stopScanner]);

  const resolve = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token || resolvingRef.current) return;
      resolvingRef.current = true;
      setResolving(true);
      setDecisionError("");
      setOverrideWindow(false);

      try {
        if (live) {
          const response = await fetch("/api/guard/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const payload = (await response.json()) as {
            visit?: Visit;
            tokenState?: string;
            error?: string;
          };
          if (!response.ok || !payload.visit) {
            haptic([80, 60, 80]);
            setVisit(null);
            setTokenState("invalid");
            setMode("result");
            return;
          }
          haptic(45);
          setVisit(payload.visit);
          setTokenState(payload.tokenState ?? "valid");
          setMode("result");
          return;
        }

        const found = findShowcaseVisit((item) => item.qrToken === token);
        if (!found) {
          haptic([80, 60, 80]);
          setVisit(null);
          setTokenState("invalid");
          setMode("result");
          return;
        }
        haptic(45);
        setVisit(found);
        setTokenState(
          found.status === "cancelled"
            ? "cancelled"
            : found.status === "checked_out"
              ? "used"
              : "valid",
        );
        setMode("result");
      } finally {
        resolvingRef.current = false;
        setResolving(false);
      }
    },
    [live],
  );

  async function startCamera() {
    setCameraError("");
    setMode("camera");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("reader", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 250, height: 250 } },
        async (decoded) => {
          await stopScanner();
          void resolve(decoded);
        },
        () => {
          // Cada fotograma sin código llega aquí: no es un error.
        },
      );
    } catch (reason) {
      setCameraError(
        reason instanceof Error && reason.name === "NotAllowedError"
          ? "No hay permiso de cámara. Actívalo en el navegador o escribe el código."
          : "No encontramos una cámara disponible. Escribe el código manualmente.",
      );
    }
  }

  const window_ = visit
    ? accessWindow(visit, {
        earlyMinutes: settings.earlyEntryMinutes,
        lateMinutes: settings.lateEntryMinutes,
      })
    : "valid";
  // A quien ya está dentro solo se le registra la salida: la ventana de entrada
  // ya no aplica y avisar de ella solo confundiría al guardia.
  const insideNow = visit?.status === "checked_in";
  const outsideWindow = window_ !== "valid" && !insideNow;
  const blocked = ["revoked", "cancelled", "expired", "invalid"].includes(
    tokenState,
  );

  async function applyDecision(decision: Decision, denialReason?: string) {
    if (!visit) return;
    setBusy(true);
    setDecisionError("");
    try {
      await decide(visit.id, decision, {
        denialReason,
        allowOutsideWindow: overrideWindow,
      });
      haptic(decision === "denied" ? [60, 40, 60] : 60);
      setLastDecision(decision);
      setDenyOpen(false);
      setReason("");
      setMode("done");
      if (live) void reload();
    } catch (reason) {
      haptic([90, 50, 90]);
      setDecisionError(
        reason instanceof Error
          ? reason.message
          : "No fue posible registrar la decisión",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setVisit(null);
    setManualToken("");
    setLastDecision(null);
    setDecisionError("");
    setMode("home");
  }

  /* ------------------------------------------------------------------ */
  if (mode === "camera")
    return (
      <div className="animate-rise">
        <button
          onClick={async () => {
            await stopScanner();
            setMode("home");
          }}
          className="mb-5 inline-flex items-center gap-2 text-sm text-slate-300"
        >
          <ArrowLeft size={17} />
          Volver
        </button>

        <h1 className="text-2xl font-semibold">Centra el código</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Se valida solo en cuanto lo detecte.
        </p>

        <div className="relative mt-6 overflow-hidden rounded-3xl bg-black">
          <div id="reader" className="min-h-[320px] w-full" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative size-60">
              <span className="absolute -left-1 -top-1 size-10 rounded-tl-2xl border-l-4 border-t-4 border-[#10cfc9]" />
              <span className="absolute -right-1 -top-1 size-10 rounded-tr-2xl border-r-4 border-t-4 border-[#10cfc9]" />
              <span className="absolute -bottom-1 -left-1 size-10 rounded-bl-2xl border-b-4 border-l-4 border-[#10cfc9]" />
              <span className="absolute -bottom-1 -right-1 size-10 rounded-br-2xl border-b-4 border-r-4 border-[#10cfc9]" />
              <span className="animate-sweep absolute inset-x-1 top-1/2 h-0.5 rounded-full bg-[#10cfc9] shadow-[0_0_16px_4px_rgba(16,207,201,.5)]" />
            </div>
          </div>
        </div>

        {resolving && (
          <p className="mt-4 text-center text-sm text-slate-300">Validando…</p>
        )}

        {cameraError && (
          <div className="mt-4 rounded-2xl bg-amber-500/15 p-4 text-sm leading-6 text-amber-200">
            <AlertTriangle className="mr-2 inline" size={17} />
            {cameraError}
            <button
              onClick={() => setMode("home")}
              className="mt-3 block font-semibold text-white"
            >
              Escribir el código
            </button>
          </div>
        )}
      </div>
    );

  if (mode === "done")
    return (
      <ResultScreen
        decision={lastDecision}
        visit={visit}
        onContinue={reset}
      />
    );

  if (mode === "result")
    return (
      <div className="animate-rise">
        <button
          onClick={reset}
          className="mb-5 inline-flex items-center gap-2 text-sm text-slate-300"
        >
          <ArrowLeft size={17} />
          Escanear otro
        </button>

        {!visit ? (
          <div className="rounded-3xl bg-red-500/12 p-8 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-red-500/20 text-red-300">
              <X size={38} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold">Pase no válido</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              El código no existe en esta organización, venció o fue revocado.
              Registra la entrada de forma manual si la persona está autorizada.
            </p>
            <div className="mt-7 space-y-3">
              <Link
                href="/guard/manual"
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-[#071426]"
              >
                <Keyboard size={18} />
                Registro manual
              </Link>
              <Button variant="light" size="lg" block onClick={reset}>
                Escanear otro
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl bg-white text-[#071426]">
              <div
                className={cn(
                  "flex items-center justify-between px-5 py-4",
                  blocked
                    ? "bg-red-50"
                    : outsideWindow
                      ? "bg-amber-50"
                      : "bg-emerald-50",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold",
                    blocked
                      ? "text-red-700"
                      : outsideWindow
                        ? "text-amber-700"
                        : "text-emerald-700",
                  )}
                >
                  {blocked ? (
                    <ShieldX size={19} />
                  ) : outsideWindow ? (
                    <Clock3 size={19} />
                  ) : (
                    <CheckCircle2 size={19} />
                  )}
                  {blocked
                    ? "Pase bloqueado"
                    : outsideWindow
                      ? window_ === "early"
                        ? "Llegó antes de tiempo"
                        : "Fuera de horario"
                      : insideNow
                        ? "Visita en curso"
                        : "Pase válido"}
                </span>
                <StatusPill status={visit.status} />
              </div>

              <div className="p-5">
                <div className="flex items-center gap-4">
                  <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#071426] text-xl font-semibold text-white">
                    {visit.visitorName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-[22px] font-semibold leading-tight">
                      {visit.visitorName}
                    </h1>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {visit.company || "Sin empresa"}
                    </p>
                  </div>
                </div>

                {visit.status === "checked_in" && visit.checkedInAt && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    <Clock3 size={17} />
                    <LiveDuration since={visit.checkedInAt} prefix="Dentro desde hace " />
                  </div>
                )}

                <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
                  <Row label="Anfitrión" value={visit.hostName} icon={UserRoundCheck} />
                  <Row label="Ubicación" value={visit.location} icon={Building2} />
                  <Row label="Motivo" value={visit.purpose} icon={Sparkles} />
                  <Row
                    label="Horario"
                    value={new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(visit.startsAt))}
                    icon={Clock3}
                  />
                  {visit.vehiclePlate && (
                    <Row label="Placas" value={visit.vehiclePlate} icon={Car} />
                  )}
                  <Row
                    label="Identificación"
                    value={
                      visit.documentCaptured
                        ? "Capturada · vista restringida"
                        : "No capturada"
                    }
                    icon={visit.documentCaptured ? BadgeCheck : FileWarning}
                  />
                </dl>

                {visit.visitorNotes && (
                  <Callout tone="info" className="mt-4">
                    <b>Nota del visitante:</b> {visit.visitorNotes}
                  </Callout>
                )}
                {visit.accessRequirements && (
                  <Callout tone="warning" icon={AlertTriangle} className="mt-3">
                    <b>Requisitos:</b> {visit.accessRequirements}
                  </Callout>
                )}
              </div>
            </div>

            {outsideWindow && visit.status !== "checked_in" && !blocked && (
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                <input
                  type="checkbox"
                  checked={overrideWindow}
                  onChange={(event) => setOverrideWindow(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-amber-400"
                />
                Autorizo explícitamente esta entrada fuera de la ventana
                programada. Quedará registrado en la bitácora.
              </label>
            )}

            {decisionError && (
              <div
                role="alert"
                className="mt-4 rounded-2xl bg-red-500/15 p-4 text-sm text-red-200"
              >
                {decisionError}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {visit.status === "checked_in" ? (
                <Button
                  variant="accent"
                  size="lg"
                  block
                  disabled={busy}
                  onClick={() => applyDecision("checked_out")}
                  className="h-16 text-lg"
                >
                  <LogOut size={22} />
                  Registrar salida
                </Button>
              ) : (
                <Button
                  variant="accent"
                  size="lg"
                  block
                  disabled={busy || blocked || (outsideWindow && !overrideWindow)}
                  onClick={() => applyDecision("checked_in")}
                  className="h-16 text-lg"
                >
                  <LogIn size={22} />
                  Autorizar entrada
                </Button>
              )}

              {visit.status !== "checked_out" && (
                <Button
                  variant="light"
                  size="lg"
                  block
                  disabled={busy}
                  onClick={() => setDenyOpen(true)}
                  className="border-red-400/30 bg-red-500/10 text-red-200"
                >
                  <ShieldX size={19} />
                  Denegar acceso
                </Button>
              )}
            </div>
          </>
        )}

        <Sheet
          open={denyOpen}
          onClose={() => setDenyOpen(false)}
          title="Motivo del rechazo"
          description="Queda registrado en la bitácora y se notifica al anfitrión."
        >
          <textarea
            autoFocus
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej. No presentó identificación oficial"
            className="w-full rounded-2xl border border-slate-200 p-4 text-[16px] outline-none focus:border-red-400"
          />
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setDenyOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              disabled={reason.trim().length < 2 || busy}
              onClick={() => applyDecision("denied", reason.trim())}
            >
              Denegar
            </Button>
          </div>
        </Sheet>
      </div>
    );

  /* ------------------------------------------------------------------ */
  const inside = visits.filter((item) => item.status === "checked_in");

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#10cfc9]">
          Control de acceso
        </p>
        <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-.03em]">
          ¿Quién llega?
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-400">
          Escanea el pase o escribe su código.
        </p>
      </header>

      <button
        onClick={startCamera}
        className="flex min-h-52 w-full flex-col items-center justify-center rounded-[28px] bg-[#10cfc9] text-[#043b39] shadow-[0_24px_60px_-24px_#10cfc9] transition active:scale-[.985]"
      >
        <span className="relative grid size-20 place-items-center rounded-full bg-white/45">
          <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-white/70" />
          <ScanLine size={42} />
        </span>
        <span className="mt-5 text-xl font-semibold">Escanear QR</span>
        <span className="mt-1 text-sm opacity-70">Abrir la cámara</span>
      </button>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium tracking-wider text-slate-500">
        <span className="h-px flex-1 bg-white/10" />O ESCRIBE EL CÓDIGO
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!manualToken.trim()) {
            toast.error("Escribe el código del pase");
            return;
          }
          void resolve(manualToken);
        }}
        className="flex gap-2"
      >
        <input
          value={manualToken}
          onChange={(event) => setManualToken(event.target.value)}
          aria-label="Código del pase"
          placeholder="Código del pase"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-14 min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/[.07] px-4 text-[16px] text-white outline-none placeholder:text-slate-500 focus:border-[#10cfc9]"
        />
        <Button
          type="submit"
          size="lg"
          disabled={resolving}
          className="h-14 shrink-0 bg-white text-[#071426]"
        >
          {resolving ? "…" : "Validar"}
        </Button>
      </form>

      <Link
        href="/guard/manual"
        className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 text-[15px] font-semibold"
      >
        <Keyboard size={19} />
        Registro manual sin pase
      </Link>

      <section className="mt-9">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Actualmente dentro</h2>
          <Link href="/guard/inside" className="text-sm font-medium text-[#10cfc9]">
            Ver {inside.length}
          </Link>
        </div>

        {inside.length === 0 ? (
          <EmptyState
            dark
            icon={UserRoundCheck}
            title="Nadie dentro"
            description="Las entradas aparecerán aquí en cuanto valides un pase."
          />
        ) : (
          <div className="space-y-2">
            {inside.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl bg-white/[.06] p-3.5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">
                  {item.visitorName
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {item.visitorName}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {item.hostName}
                  </p>
                </div>
                <LiveDuration
                  since={item.checkedInAt}
                  className="shrink-0 text-xs font-medium text-slate-400"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-medium leading-5">{value}</dd>
      </div>
    </div>
  );
}

function ResultScreen({
  decision,
  visit,
  onContinue,
}: {
  decision: Decision | null;
  visit: Visit | null;
  onContinue: () => void;
}) {
  const config = {
    checked_in: {
      icon: LogIn,
      tone: "bg-emerald-500/15 text-emerald-300",
      title: "Entrada autorizada",
    },
    checked_out: {
      icon: LogOut,
      tone: "bg-blue-500/15 text-blue-300",
      title: "Salida registrada",
    },
    denied: {
      icon: ShieldX,
      tone: "bg-red-500/15 text-red-300",
      title: "Acceso denegado",
    },
  } as const;
  const current = config[decision ?? "checked_in"];
  const Icon = current.icon;

  return (
    <div className="animate-rise py-16 text-center">
      <span
        className={cn(
          "animate-pop mx-auto grid size-24 place-items-center rounded-full",
          current.tone,
        )}
      >
        <Icon size={44} />
      </span>
      <h1 className="mt-7 text-3xl font-semibold tracking-[-.02em]">
        {current.title}
      </h1>
      <p className="mt-3 text-slate-400">
        {visit?.visitorName} ·{" "}
        {new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(
          new Date(),
        )}
      </p>
      {decision === "checked_in" && (
        <p className="mt-1.5 text-sm text-slate-500">
          Se notificó a {visit?.hostName}.
        </p>
      )}
      <Button
        size="lg"
        block
        onClick={onContinue}
        className="mt-10 bg-white text-[#071426]"
      >
        Escanear siguiente
      </Button>
    </div>
  );
}
