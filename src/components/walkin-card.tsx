/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ImagePlus,
  Loader2,
  Pause,
  Play,
  Printer,
  QrCode,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, Card, cn } from "./ui";
import { CopyField, Sheet } from "./ui-client";
import { useI18n } from "./i18n-provider";

type Point = {
  id: string;
  locationId: string;
  url: string;
  code: string;
  active: boolean;
  tokenRotatedAt: string;
  codeRotatedAt: string;
};

type Action = "rotate_token" | "rotate_code" | "activate" | "deactivate";

/** En vitrina el punto vive en esta pantalla; el código de prueba es 1234. */
function demoPoint(locationId: string, code = "1234"): Point {
  const now = new Date().toISOString();
  return {
    id: `demo-${locationId}`,
    locationId,
    url: `${window.location.origin}/entrada/demo-${locationId}`,
    code,
    active: true,
    tokenRotatedAt: now,
    codeRotatedAt: now,
  };
}

function randomDemoCode() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * QR de recepción por sede: quien llega sin invitación escanea, escribe el
 * código impreso y se registra. Desde aquí se crea, imprime, regenera y pausa.
 */
export function WalkinCard() {
  const { live, locations } = useWorkspace();
  const { t } = useI18n();
  const [points, setPoints] = useState<Point[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(live);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<{ point: Point; action: Action } | null>(
    null,
  );
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!live) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/walkin", { cache: "no-store" });
        if (!response.ok) throw new Error(await readError(response, t("walkinAdmin.failed")));
        const payload = (await response.json()) as {
          points: Point[];
          logoUrl: string | null;
        };
        if (!active) return;
        setPoints(payload.points);
        setLogoUrl(payload.logoUrl);
      } catch (reason) {
        if (active)
          toast.error(reason instanceof Error ? reason.message : t("walkinAdmin.failed"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [live, t]);

  function replace(point: Point) {
    setPoints((current) =>
      current.some((item) => item.id === point.id)
        ? current.map((item) => (item.id === point.id ? point : item))
        : [...current, point],
    );
  }

  async function create(locationId: string) {
    if (!live) return replace(demoPoint(locationId));
    setBusy(locationId);
    try {
      const response = await fetch("/api/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!response.ok) throw new Error(await readError(response, t("walkinAdmin.failed")));
      const payload = (await response.json()) as { point: Point };
      replace(payload.point);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("walkinAdmin.failed"));
    } finally {
      setBusy("");
    }
  }

  async function act(point: Point, action: Action) {
    if (!live) {
      replace(
        action === "rotate_code"
          ? { ...point, code: randomDemoCode() }
          : action === "rotate_token"
            ? point
            : { ...point, active: action === "activate" },
      );
      toast.success(
        action.startsWith("rotate") ? t("walkinAdmin.rotated") : t("walkinAdmin.updated"),
      );
      setConfirm(null);
      return;
    }
    setBusy(point.id);
    try {
      const response = await fetch(`/api/walkin/${point.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(await readError(response, t("walkinAdmin.failed")));
      const payload = (await response.json()) as { point: Point };
      replace(payload.point);
      toast.success(
        action.startsWith("rotate") ? t("walkinAdmin.rotated") : t("walkinAdmin.updated"),
      );
      setConfirm(null);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("walkinAdmin.failed"));
    } finally {
      setBusy("");
    }
  }

  async function uploadLogo(file: File) {
    if (!live) {
      setLogoUrl(URL.createObjectURL(file));
      return;
    }
    setBusy("logo");
    try {
      const form = new FormData();
      form.set("logo", file);
      const response = await fetch("/api/organization/logo", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response, t("walkinAdmin.failed")));
      const payload = (await response.json()) as { logoUrl: string | null };
      setLogoUrl(payload.logoUrl);
      toast.success(t("walkinAdmin.logoSaved"));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("walkinAdmin.failed"));
    } finally {
      setBusy("");
      if (logoInput.current) logoInput.current.value = "";
    }
  }

  async function removeLogo() {
    if (!live) return setLogoUrl(null);
    setBusy("logo");
    try {
      const response = await fetch("/api/organization/logo", { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response, t("walkinAdmin.failed")));
      setLogoUrl(null);
      toast.success(t("walkinAdmin.logoSaved"));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("walkinAdmin.failed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <QrCode size={18} />
        {t("walkinAdmin.title")}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">{t("walkinAdmin.hint")}</p>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">{t("common.loading")}</p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="size-full object-contain p-1" />
              ) : (
                <ImagePlus size={22} className="text-slate-400" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("walkinAdmin.logo")}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {t("walkinAdmin.logoHint")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === "logo"}
                  onClick={() => logoInput.current?.click()}
                >
                  {busy === "logo" && <Loader2 size={15} className="animate-spin" />}
                  {logoUrl ? t("walkinAdmin.changeLogo") : t("walkinAdmin.uploadLogo")}
                </Button>
                {logoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === "logo"}
                    className="text-red-600"
                    onClick={() => void removeLogo()}
                  >
                    <Trash2 size={15} />
                    {t("walkinAdmin.removeLogo")}
                  </Button>
                )}
              </div>
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {locations.length === 0 && (
              <p className="text-sm text-slate-500">{t("walkinAdmin.noLocations")}</p>
            )}
            {locations.map((location) => {
              const point = points.find((item) => item.locationId === location.id);
              return (
                <div
                  key={location.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-semibold">{location.name}</p>
                    {point ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          point.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {point.active ? t("walkinAdmin.active") : t("walkinAdmin.paused")}
                      </span>
                    ) : (
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={busy === location.id}
                        onClick={() => void create(location.id)}
                      >
                        {busy === location.id && (
                          <Loader2 size={15} className="animate-spin" />
                        )}
                        {t("walkinAdmin.create")}
                      </Button>
                    )}
                  </div>

                  {point && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr]">
                      <QrPreview url={point.url} />
                      <div className="min-w-0 space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t("walkinAdmin.code")}
                          </p>
                          <p className="font-mono text-3xl font-semibold tracking-[.3em]">
                            {point.code}
                          </p>
                        </div>
                        <CopyField value={point.url} />
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/imprimir/entrada/${point.id}`}
                            target="_blank"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#071426] px-3 text-sm font-semibold text-white"
                          >
                            <Printer size={15} />
                            {t("walkinAdmin.print")}
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === point.id}
                            onClick={() => setConfirm({ point, action: "rotate_token" })}
                          >
                            <RefreshCw size={15} />
                            {t("walkinAdmin.rotateToken")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === point.id}
                            onClick={() => setConfirm({ point, action: "rotate_code" })}
                          >
                            <RefreshCw size={15} />
                            {t("walkinAdmin.rotateCode")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === point.id}
                            onClick={() =>
                              void act(point, point.active ? "deactivate" : "activate")
                            }
                          >
                            {point.active ? <Pause size={15} /> : <Play size={15} />}
                            {point.active ? t("walkinAdmin.pause") : t("walkinAdmin.resume")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.action === "rotate_code"
            ? t("walkinAdmin.rotateCodeTitle")
            : t("walkinAdmin.rotateTokenTitle")
        }
        description={
          confirm?.action === "rotate_code"
            ? t("walkinAdmin.rotateCodeHint")
            : t("walkinAdmin.rotateTokenHint")
        }
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setConfirm(null)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            disabled={!confirm || busy === confirm.point.id}
            onClick={() => confirm && void act(confirm.point, confirm.action)}
          >
            {t("walkinAdmin.confirm")}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function QrPreview({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { margin: 1, width: 240 }).then((data) => {
      if (active) setSrc(data);
    });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <span className="grid size-[120px] place-items-center rounded-xl border border-slate-200 bg-white p-1.5">
      {src ? <img src={src} alt="" className="size-full" /> : null}
    </span>
  );
}
