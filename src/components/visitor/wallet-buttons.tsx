"use client";

import { Wallet } from "lucide-react";
import { cn } from "../ui";

/**
 * Accesos para guardar el pase en la cartera del teléfono.
 *
 * Solo aparecen si el servidor tiene configuradas las credenciales
 * correspondientes, así que una instalación sin ellas no muestra botones
 * muertos.
 *
 * Nota de marca: Apple y Google exigen usar sus insignias oficiales
 * («Add to Apple Wallet» / «Save to Google Wallet») en producción. Estos
 * botones son un marcador de posición funcional; hay que sustituirlos por los
 * recursos oficiales antes de publicar. Ver docs/INTEGRACIONES.md.
 */
export function WalletButtons({
  token,
  available,
  className,
}: {
  token: string;
  available?: { apple?: boolean; google?: boolean };
  className?: string;
}) {
  if (!available?.apple && !available?.google) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="text-center text-xs font-medium text-slate-400">
        Guárdalo para tenerlo a la mano al llegar
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {available.apple && (
          <a
            href={`/api/public/passes/${encodeURIComponent(token)}/apple`}
            className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-black px-5 text-[15px] font-semibold text-white transition active:scale-[.985]"
          >
            <Wallet size={19} />
            Apple Wallet
          </a>
        )}
        {available.google && (
          <a
            href={`/api/public/passes/${encodeURIComponent(token)}/google`}
            className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold text-[#3c4043] ring-1 ring-slate-300 transition active:scale-[.985]"
          >
            <Wallet size={19} />
            Google Wallet
          </a>
        )}
      </div>
    </div>
  );
}
