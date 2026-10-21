"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Tablet } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { useI18n } from "./i18n-provider";
import { InfoTip } from "./info-tip";
import { Button, Callout, Card, Field, fieldClass } from "./ui";
import { CopyField } from "./ui-client";
import {
  DEMO_COMPANY_CODE,
  DEMO_STATIONS,
  listDemoStations,
  saveExtraStation,
} from "@/lib/demo-stations";
import { usernameFromBooth } from "@/lib/station-access";

type StationRow = {
  id: string;
  username: string;
  boothId: string;
  boothName: string;
  active?: boolean;
};

export function TabletAccounts() {
  const { live, booths, locations } = useWorkspace();
  const { t } = useI18n();
  const activeBooths = booths.filter((booth) => booth.active);
  const [companyCode, setCompanyCode] = useState(live ? "" : DEMO_COMPANY_CODE);
  const [stations, setStations] = useState<StationRow[]>(live ? [] : DEMO_STATIONS);
  const [boothId, setBoothId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) {
      setStations(listDemoStations());
      return;
    }
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/team/stations", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          companyCode: string;
          stations: StationRow[];
        };
        if (!active) return;
        setCompanyCode(payload.companyCode);
        setStations(payload.stations);
      } catch {
        // La tarjeta sigue visible para reintentar al crear.
      }
    })();
    return () => {
      active = false;
    };
  }, [live]);

  const taken = new Set(stations.map((station) => station.boothId));
  const available = activeBooths.filter((booth) => !taken.has(booth.id));
  const selected = activeBooths.find((booth) => booth.id === boothId);
  const nextUsername = selected ? usernameFromBooth(selected.name) : "";

  function placeOf(boothIdValue: string, fallback: string) {
    const booth = booths.find((item) => item.id === boothIdValue);
    const site = locations.find((item) => item.id === booth?.locationId);
    const boothName = booth?.name || fallback;
    return site ? `${site.name} · ${boothName}` : boothName;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      toast.error(t("team.tabletNeedBooth"));
      return;
    }
    if (taken.has(selected.id)) {
      toast.error(t("team.boothTaken"));
      return;
    }
    const name = usernameFromBooth(selected.name);
    if (stations.some((item) => item.username === name)) {
      toast.error(t("team.tabletUserExists"));
      return;
    }
    setBusy(true);
    try {
      if (live) {
        const response = await fetch("/api/team/stations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: name, boothId: selected.id }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          station?: StationRow;
        };
        if (!response.ok || !payload.station)
          throw new Error(payload.error ?? t("team.tabletCreateFail"));
        setStations((current) => [...current, payload.station as StationRow]);
      } else {
        const station: StationRow = {
          id: crypto.randomUUID(),
          username: name,
          boothId: selected.id,
          boothName: selected.name,
        };
        saveExtraStation(station);
        setStations((current) => [...current, station]);
      }
      setBoothId("");
      toast.success(t("team.tabletCreated"));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("team.tabletCreateFail"));
    } finally {
      setBusy(false);
    }
  }

  const steps = ["tabletStep1", "tabletStep2", "tabletStep3"] as const;

  return (
    <Card className="h-full p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
          <Tablet size={18} />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {t("team.tabletsTitle")}
            <InfoTip label={t("team.tabletsAbout")}>{t("team.tabletsAboutBody")}</InfoTip>
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{t("team.tabletsLead")}</p>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-5 text-slate-600">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-[#071426]">
              {index + 1}
            </span>
            <span>{t(`team.${step}`)}</span>
          </li>
        ))}
      </ol>

      {companyCode && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            {t("login.tabletCompany")}
            <InfoTip label={t("team.tabletKeyAbout")}>{t("team.tabletKeyInfo")}</InfoTip>
          </p>
          <CopyField value={companyCode} label={t("login.tabletCompany")} />
        </div>
      )}

      {stations.length > 0 ? (
        <>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("team.stationUsersTitle")}
          </p>
          <ul className="space-y-2">
            {stations.map((station) => (
              <StationUserRow
                key={station.id}
                username={station.username}
                location={placeOf(station.boothId, station.boothName)}
              />
            ))}
          </ul>
        </>
      ) : (
        <Callout tone="warning" className="mt-4">
          {t("team.noStationUsers")}
        </Callout>
      )}

      <form onSubmit={create} className="mt-4 space-y-3">
        <Field
          label={t("guard.station")}
          info={<InfoTip label={t("guard.station")}>{t("team.tabletBoothInfo")}</InfoTip>}
          hint={nextUsername ? t("team.userWillBe", { name: nextUsername }) : undefined}
        >
          <select
            className={fieldClass}
            value={boothId}
            onChange={(event) => setBoothId(event.target.value)}
          >
            <option value="">{t("team.tabletPickBooth")}</option>
            {locations.map((site) => {
              const siteBooths = available.filter((booth) => booth.locationId === site.id);
              if (siteBooths.length === 0) return null;
              return (
                <optgroup key={site.id} label={site.name}>
                  {siteBooths.map((booth) => (
                    <option key={booth.id} value={booth.id}>
                      {site.name} · {booth.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </Field>
        {available.length === 0 ? (
          <p className="text-sm leading-5 text-slate-500">{t("team.noBoothLeft")}</p>
        ) : (
          <Button type="submit" disabled={busy || !boothId}>
            {t("team.createBoothUser")}
          </Button>
        )}
      </form>
    </Card>
  );
}

function StationUserRow({ username, location }: { username: string; location: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  function copyUsername() {
    navigator.clipboard.writeText(username);
    setCopied(true);
    toast.success(t("team.usernameCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0d9d99]">
          {t("team.tabletUserLabel")}
        </p>
        <p className="font-mono font-semibold">{username}</p>
      </div>
      <span className="truncate text-right text-xs text-slate-500">{location}</span>
      <button
        type="button"
        onClick={copyUsername}
        className="grid size-8 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-[#071426]"
        aria-label={t("common.copy")}
      >
        {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
      </button>
    </li>
  );
}
