"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "./ui";
import { formatDuration } from "@/lib/domain";
import { getClock, getServerClock, subscribeClock } from "@/lib/clock";

/** Primitivas con estado o efectos de navegador. */

/**
 * Instante actual, leído del reloj compartido. Devuelve `null` durante el
 * render del servidor para que nada dependa de una hora que el cliente no
 * pueda reproducir.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, getClock, getServerClock);
}

/**
 * Contador vivo del tiempo transcurrido. Se suscribe al reloj compartido en vez
 * de mantener su propio intervalo, de modo que veinte tarjetas en pantalla
 * siguen costando un solo temporizador.
 */
export function LiveDuration({
  since,
  until,
  className,
  prefix,
}: {
  since?: string;
  until?: string;
  className?: string;
  prefix?: string;
}) {
  const now = useSyncExternalStore(subscribeClock, getClock, getServerClock);

  if (!since) return null;
  const end = until ? new Date(until).getTime() : now;
  // Durante el render del servidor no hay reloj: evita desajustes de hidratación.
  if (!end) return <span className={className}>—</span>;

  const elapsed = Math.max(0, end - new Date(since).getTime());
  return (
    <span className={className}>
      {prefix}
      {formatDuration(elapsed)}
    </span>
  );
}

/** Hoja inferior: el patrón de diálogo natural en móvil. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-rise safe-bottom relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-[0_-20px_60px_-30px_rgba(7,20,38,.5)] outline-none sm:max-w-md sm:rounded-[28px]"
      >
        <div className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-.02em]">{title}</h2>
            {description && (
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-xl p-2 text-slate-400 active:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  dark,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition",
        dark
          ? "border-white/12 bg-white/[.06]"
          : "border-slate-200 bg-white active:bg-slate-50",
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-semibold",
            dark ? "text-white" : "text-[#071426]",
          )}
        >
          {label}
        </span>
        {description && (
          <span
            className={cn(
              "mt-1 block text-xs leading-5",
              dark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {description}
          </span>
        )}
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-[#10cfc9]" : dark ? "bg-white/20" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow transition-all",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

/** Copia al portapapeles con respaldo para navegadores sin permiso. */
export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  }
}

export function CopyField({
  value,
  label = "Enlace de invitación",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 pl-4">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-600 outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            toast.success("Enlace copiado");
            setTimeout(() => setCopied(false), 1800);
          }
        }}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#071426] px-4 text-sm font-semibold text-white active:scale-[.97]"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/** Compartir nativo del sistema; en escritorio copia el enlace. */
export function ShareButton({
  url,
  title,
  text,
  className,
  children,
}: {
  url: string;
  title: string;
  text?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        if (typeof navigator !== "undefined" && navigator.share) {
          try {
            await navigator.share({ title, text, url });
            return;
          } catch {
            // El usuario canceló el diálogo del sistema: no es un error.
            return;
          }
        }
        if (await copyText(url)) toast.success("Enlace copiado");
      }}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#10cfc9] px-5 text-[15px] font-semibold text-[#043b39] active:scale-[.985]",
        className,
      )}
    >
      <Share2 size={18} />
      {children ?? "Compartir enlace"}
    </button>
  );
}
