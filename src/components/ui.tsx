import type { ComponentProps, ReactNode } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LucideIcon } from "lucide-react";
import { statusLabels, type VisitStatus } from "@/lib/domain";

/** Primitivas sin estado: utilizables desde Server y Client Components. */

export function cn(...values: Parameters<typeof clsx>) {
  return twMerge(clsx(values));
}

/* -------------------------------------------------------------------------- */
/* Botones                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "light";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[#071426] text-white active:bg-[#12294a] disabled:bg-slate-300",
  accent:
    "bg-[#10cfc9] text-[#043b39] shadow-[0_16px_36px_-18px_#10cfc9] active:bg-[#0dbdb7] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  outline:
    "border border-slate-200 bg-white text-[#071426] active:bg-slate-50 disabled:text-slate-300",
  ghost: "text-slate-600 active:bg-slate-100",
  danger:
    "bg-red-600 text-white active:bg-red-700 disabled:bg-red-200",
  light: "bg-white/10 text-white active:bg-white/20 border border-white/15",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm gap-1.5 rounded-xl",
  md: "h-12 px-5 text-[15px] gap-2 rounded-2xl",
  lg: "h-14 px-6 text-base gap-2.5 rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition active:scale-[.985] disabled:pointer-events-none disabled:opacity-70",
        buttonVariants[variant],
        buttonSizes[size],
        block && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Superficies                                                                 */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div {...props} className={cn("card-surface p-5", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[13px] font-semibold text-[#0d9d99]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-.03em] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[15px] leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Callout({
  tone = "info",
  icon: Icon,
  children,
  className,
}: {
  tone?: "info" | "warning" | "success" | "danger" | "neutral";
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-blue-50 text-blue-900 border-blue-100",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    danger: "bg-red-50 text-red-900 border-red-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  } as const;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border p-4 text-sm leading-6",
        tones[tone],
        className,
      )}
    >
      {Icon && <Icon size={19} className="mt-0.5 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  dark,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl px-6 py-14 text-center",
        dark ? "bg-white/5" : "border border-slate-200 bg-white",
      )}
    >
      <span
        className={cn(
          "mx-auto grid size-14 place-items-center rounded-2xl",
          dark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-400",
        )}
      >
        <Icon size={26} />
      </span>
      <p className={cn("mt-4 font-semibold", dark && "text-white")}>{title}</p>
      {description && (
        <p
          className={cn(
            "mx-auto mt-1.5 max-w-xs text-sm leading-6",
            dark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Formulario                                                                  */
/* -------------------------------------------------------------------------- */

export const fieldClass =
  "h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[16px] text-[#071426] outline-none transition placeholder:text-slate-400 focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15";

export const fieldDarkClass =
  "h-13 w-full rounded-2xl border border-white/15 bg-white/[.07] px-4 text-[16px] text-white outline-none transition placeholder:text-slate-500 focus:border-[#10cfc9] focus:ring-4 focus:ring-[#10cfc9]/15";

export function Field({
  label,
  hint,
  error,
  optional,
  warning,
  dark,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  warning?: boolean;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", warning && "rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200")}>
      <span className="mb-2 flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-sm font-medium",
            dark ? "text-slate-200" : "text-[#071426]",
          )}
        >
          {label}
        </span>
        {optional && (
          <span className="text-xs text-slate-400">Opcional</span>
        )}
        {warning && (
          <span className="text-xs font-medium text-amber-700">Revisar</span>
        )}
      </span>
      {children}
      {hint && !error && (
        <span
          className={cn(
            "mt-1.5 block text-xs leading-5",
            dark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1.5 block text-xs font-medium text-red-500">
          {error}
        </span>
      )}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Identidad y estado                                                          */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  size = 44,
  tone = "light",
}: {
  name: string;
  size?: number;
  tone?: "light" | "dark" | "accent";
}) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tones = {
    light: "bg-slate-100 text-slate-600",
    dark: "bg-[#071426] text-white",
    accent: "bg-[#10cfc9]/15 text-[#0d9d99]",
  } as const;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        tones[tone],
      )}
    >
      {letters || "?"}
    </span>
  );
}

const statusStyles: Record<VisitStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  invited: "bg-blue-50 text-blue-700",
  pre_registered: "bg-cyan-50 text-cyan-800",
  approved: "bg-indigo-50 text-indigo-700",
  checked_in: "bg-emerald-50 text-emerald-700",
  checked_out: "bg-slate-100 text-slate-600",
  denied: "bg-red-50 text-red-700",
  cancelled: "bg-amber-50 text-amber-800",
  expired: "bg-zinc-100 text-zinc-600",
};

export function StatusPill({
  status,
  className,
}: {
  status: VisitStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        statusStyles[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  hint?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    accent: "bg-[#10cfc9]/15 text-[#0d9d99]",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    info: "bg-blue-50 text-blue-600",
  } as const;
  return (
    <div className="card-surface p-4">
      <span
        className={cn("grid size-10 place-items-center rounded-xl", tones[tone])}
      >
        <Icon size={18} />
      </span>
      <p className="mt-3.5 text-2xl font-semibold leading-none tracking-[-.02em]">
        {value}
      </p>
      <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-2xl", className)} />;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div
        className="h-full rounded-full bg-[#10cfc9] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
