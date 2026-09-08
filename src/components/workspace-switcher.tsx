"use client";

import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Avatar, cn } from "./ui";
import { roleLabels } from "@/lib/domain";

/** Abre el selector cuando la cuenta pertenece a más de un espacio. */
export function WorkspaceSwitcher({
  compact = false,
  dark = false,
}: {
  compact?: boolean;
  dark?: boolean;
}) {
  const { organization, viewer } = useWorkspace();

  function forgetStickyOrg() {
    void fetch("/api/session", { method: "DELETE" });
  }

  if (compact) {
    return (
      <Link
        href="/select-organization"
        title="Cambiar de empresa"
        onClick={forgetStickyOrg}
        className="flex min-w-0 items-center gap-3"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#071426] text-white">
          <ChevronsUpDown size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight">
            {organization.name}
          </span>
          <span className="text-[11px] leading-tight text-slate-500">
            {roleLabels[viewer.role]} · tocar para cambiar
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/select-organization"
      onClick={forgetStickyOrg}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-3 transition",
        dark
          ? "bg-white/10 hover:bg-white/15"
          : "bg-slate-50 hover:bg-slate-100",
      )}
    >
      <Avatar name={viewer.name} size={38} tone="dark" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            dark ? "text-white" : "text-[#071426]",
          )}
        >
          {organization.name}
        </span>
        <span
          className={cn(
            "block truncate text-xs",
            dark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {roleLabels[viewer.role]} · cambiar de empresa
        </span>
      </span>
      <ChevronsUpDown size={16} className="shrink-0 text-slate-400" />
    </Link>
  );
}
