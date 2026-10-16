"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Círculo con una i. Al tocarlo explica de qué trata ese dato. */
export function InfoTip({
  label,
  children,
  dark = false,
}: {
  label: string;
  children: ReactNode;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={`grid size-5 place-items-center rounded-full border text-[11px] font-semibold leading-none ${
          dark
            ? "border-white/30 text-slate-300"
            : "border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-[#071426]"
        }`}
      >
        i
      </button>
      {open && (
        <span
          id={panelId}
          role="note"
          className={`absolute top-7 left-1/2 z-50 w-64 -translate-x-1/2 rounded-2xl p-3 text-left text-xs font-normal leading-5 normal-case tracking-normal shadow-lg ${
            dark
              ? "bg-[#102033] text-slate-200"
              : "border border-slate-200 bg-white text-slate-600"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
