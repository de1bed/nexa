"use client";
import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo-provider";
import type { Visit } from "@/lib/domain";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Keyboard,
  LogIn,
  LogOut,
  ScanLine,
  ShieldX,
  UserRoundCheck,
  X,
} from "lucide-react";
import { StatusPill } from "./status-pill";
type ScanState = "home" | "camera" | "result" | "success" | "invalid";
export function GuardScan() {
  const { state, updateVisit, production } = useDemo();
  const [mode, setMode] = useState<ScanState>("home");
  const [token, setToken] = useState("nexa-demo-pass-2026");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [reason, setReason] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [outsideAuthorized, setOutsideAuthorized] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const scanner = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  async function resolve(value: string) {
    setOutsideAuthorized(false);
    setDecisionError("");
    if (production) {
      const response = await fetch("/api/guard/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const result = (await response.json()) as {
        visit?: Visit;
        tokenState?: string;
      };
      if (
        !response.ok ||
        !result.visit ||
        ["revoked", "expired", "cancelled"].includes(result.tokenState ?? "")
      ) {
        setMode("invalid");
        return;
      }
      setVisit(result.visit);
      setMode("result");
      return;
    }
    const v = state.visits.find((x) => x.qrToken === value);
    if (!v || ["cancelled", "expired"].includes(v.status)) {
      setMode("invalid");
      return;
    }
    setVisit(v);
    setMode("result");
  }
  async function startCamera() {
    setCameraError("");
    setMode("camera");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("reader");
      scanner.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await qr.stop();
          resolve(decoded);
        },
        () => {},
      );
    } catch (e) {
      setCameraError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Habilítalo o introduce el código manualmente."
          : "No encontramos una cámara disponible. Introduce el código manualmente.",
      );
    }
  }
  useEffect(
    () => () => {
      scanner.current?.stop().catch(() => {});
    },
    [],
  );
  async function approve() {
    if (!visit) return;
    const outside =
      new Date() < new Date(new Date(visit.startsAt).getTime() - 15 * 60000) ||
      new Date() > new Date(new Date(visit.endsAt).getTime() + 30 * 60000);
    setDecisionError("");
    try {
      if (visit.status === "checked_in") {
      const patch = {
        status: "checked_out" as const,
        checkedOutAt: new Date().toISOString(),
      };
      await updateVisit(visit.id, patch, {
        type: "check_out",
        actor: "Carlos Mendoza",
      });
      setVisit({ ...visit, ...patch });
      } else {
        if (outside && !outsideAuthorized) return;
      const patch = {
        status: "checked_in" as const,
        checkedInAt: new Date().toISOString(),
      };
      await updateVisit(
        visit.id,
        patch,
        { type: "check_in", actor: "Carlos Mendoza" },
        { allowOutsideWindow: outsideAuthorized },
      );
      setVisit({ ...visit, ...patch });
      }
      setMode("success");
    } catch (error) {
      setDecisionError(
        error instanceof Error ? error.message : "No fue posible registrar la decisión",
      );
    }
  }
  async function deny() {
    if (!visit || !reason.trim()) return;
    await updateVisit(
      visit.id,
      { status: "denied", denialReason: reason },
      { type: "denied", actor: "Carlos Mendoza", detail: reason },
    );
    setVisit({ ...visit, status: "denied", denialReason: reason });
    setShowDeny(false);
    setMode("success");
  }
  if (mode === "home")
    return (
      <>
        <div className="mb-7">
          <p className="text-sm font-medium text-[#10cfc9]">
            Control de acceso
          </p>
          <h1 className="mt-2 text-3xl font-semibold">¿Quién llega?</h1>
          <p className="mt-2 text-slate-400">
            Escanea el pase o introduce su token.
          </p>
        </div>
        <button
          onClick={startCamera}
          className="flex min-h-48 w-full flex-col items-center justify-center rounded-3xl bg-[#10cfc9] text-[#071426] shadow-[0_20px_60px_-20px_#10cfc9]"
        >
          <span className="grid size-20 place-items-center rounded-full bg-white/50">
            <ScanLine size={42} />
          </span>
          <span className="mt-5 text-xl font-semibold">Escanear QR</span>
          <span className="mt-1 text-sm opacity-70">Abrir cámara</span>
        </button>
        <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-white/10" />O INTRODUCE EL TOKEN
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="flex gap-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-label="Token del pase"
            className="h-13 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 outline-none focus:border-[#10cfc9]"
          />
          <button
            onClick={() => resolve(token)}
            className="h-13 rounded-xl bg-white px-5 font-semibold text-[#071426]"
          >
            Validar
          </button>
        </div>
        <a
          href="/guard/manual"
          className="mt-5 flex h-13 items-center justify-center gap-2 rounded-xl border border-white/15 font-medium"
        >
          <Keyboard size={18} />
          Crear acceso manual
        </a>
        <InsidePreview />
      </>
    );
  if (mode === "camera")
    return (
      <>
        <button
          onClick={async () => {
            await scanner.current?.stop().catch(() => {});
            setMode("home");
          }}
          className="mb-5 flex items-center gap-2 text-sm text-slate-300"
        >
          <ArrowLeft size={17} />
          Volver
        </button>
        <h1 className="mb-5 text-2xl font-semibold">Centra el código</h1>
        <div
          id="reader"
          className="min-h-80 overflow-hidden rounded-3xl bg-black"
        />
        {cameraError && (
          <div className="mt-4 rounded-xl bg-amber-500/15 p-4 text-sm leading-6 text-amber-200">
            <AlertTriangle className="mr-2 inline" size={17} />
            {cameraError}
            <button
              onClick={() => setMode("home")}
              className="mt-3 block font-semibold text-white"
            >
              Usar código manual
            </button>
          </div>
        )}
      </>
    );
  if (mode === "invalid")
    return (
      <ResultState
        icon={<X size={34} />}
        color="bg-red-500/15 text-red-300"
        title="Pase inválido"
        text="El código no existe, venció o fue revocado."
        action={() => setMode("home")}
      />
    );
  if (mode === "success")
    return (
      <ResultState
        icon={<CheckCircle2 size={36} />}
        color="bg-emerald-500/15 text-emerald-300"
        title={
          visit?.status === "checked_in"
            ? "Entrada autorizada"
            : visit?.status === "checked_out"
              ? "Salida registrada"
              : "Acceso denegado"
        }
        text={`${visit?.visitorName} · ${new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date())}`}
        action={() => {
          setVisit(null);
          setMode("home");
        }}
      />
    );
  if (!visit) return null;
  const outside =
    new Date() < new Date(new Date(visit.startsAt).getTime() - 15 * 60000) ||
    new Date() > new Date(new Date(visit.endsAt).getTime() + 30 * 60000);
  return (
    <>
      <button
        onClick={() => setMode("home")}
        className="mb-5 flex items-center gap-2 text-sm text-slate-300"
      >
        <ArrowLeft size={17} />
        Escanear otro
      </button>
      <div className="overflow-hidden rounded-3xl bg-white text-[#071426]">
        <div className={`p-5 ${outside ? "bg-amber-50" : "bg-emerald-50"}`}>
          <div className="flex items-center justify-between">
            <span
              className={`flex items-center gap-2 font-semibold ${outside ? "text-amber-700" : "text-emerald-700"}`}
            >
              {outside ? (
                <AlertTriangle size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}{" "}
              {outside ? "Fuera de horario" : "Pase válido"}
            </span>
            <StatusPill status={visit.status} />
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-[#071426] text-xl font-semibold text-white">
              {visit.visitorName
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)}
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{visit.visitorName}</h1>
              <p className="text-slate-500">{visit.company}</p>
            </div>
          </div>
          <div className="mt-7 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm">
            <p>
              <span className="block text-xs text-slate-500">Anfitrión</span>
              <b>{visit.hostName}</b>
            </p>
            <p>
              <span className="block text-xs text-slate-500">Motivo</span>
              {visit.purpose}
            </p>
            <p>
              <span className="block text-xs text-slate-500">Horario</span>
              {new Intl.DateTimeFormat("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(visit.startsAt))}
            </p>
            <p>
              <span className="block text-xs text-slate-500">Documento</span>
              {visit.documentCaptured
                ? "Capturado · vista restringida"
                : "No capturado"}
            </p>
          </div>
          <button
            onClick={approve}
            disabled={outside && visit.status !== "checked_in" && !outsideAuthorized}
            className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#071426] text-lg font-semibold text-white"
          >
            {visit.status === "checked_in" ? (
              <>
                <LogOut />
                Registrar salida
              </>
            ) : (
              <>
                <LogIn />
                Validar entrada
              </>
            )}
          </button>
          {outside && visit.status !== "checked_in" && (
            <label className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={outsideAuthorized}
                onChange={(event) => setOutsideAuthorized(event.target.checked)}
                className="mt-0.5 size-5 accent-amber-600"
              />
              Autorizo explícitamente este acceso fuera de la ventana programada.
            </label>
          )}
          {decisionError && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {decisionError}
            </p>
          )}
          {visit.status !== "checked_in" && (
            <button
              onClick={() => setShowDeny(true)}
              className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-xl border border-red-200 font-semibold text-red-600"
            >
              <ShieldX size={19} />
              Denegar acceso
            </button>
          )}
        </div>
      </div>
      {showDeny && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-[#071426]">
            <h2 className="text-xl font-semibold">Motivo de rechazo</h2>
            <p className="mt-2 text-sm text-slate-500">
              El motivo quedará registrado en la bitácora.
            </p>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="mt-5 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-red-400"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDeny(false)}
                className="h-12 flex-1 rounded-xl border"
              >
                Cancelar
              </button>
              <button
                disabled={!reason.trim()}
                onClick={deny}
                className="h-12 flex-1 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-40"
              >
                Denegar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function InsidePreview() {
  const { state } = useDemo();
  const inside = state.visits.filter((v) => v.status === "checked_in");
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Actualmente dentro</h2>
        <a href="/guard/inside" className="text-sm text-[#10cfc9]">
          Ver {inside.length}
        </a>
      </div>
      {inside.slice(0, 3).map((v) => (
        <div
          key={v.id}
          className="mb-2 flex items-center gap-3 rounded-xl bg-white/7 p-3"
        >
          <span className="grid size-10 place-items-center rounded-full bg-white/10">
            <UserRoundCheck size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{v.visitorName}</p>
            <p className="text-xs text-slate-400">{v.hostName}</p>
          </div>
          <span className="text-xs text-slate-400">
            <Clock3 className="mr-1 inline" size={13} />
            {new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(
              new Date(v.checkedInAt!),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
function ResultState({
  icon,
  color,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <span
        className={`mx-auto grid size-20 place-items-center rounded-full ${color}`}
      >
        {icon}
      </span>
      <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
      <p className="mt-3 text-slate-400">{text}</p>
      <button
        onClick={action}
        className="mt-8 h-13 w-full rounded-xl bg-white font-semibold text-[#071426]"
      >
        Continuar
      </button>
    </div>
  );
}
