import Link from "next/link";
import type { Route } from "next";
import { ShieldCheck } from "lucide-react";
import { cn } from "./ui";

export function Brand({
  dark = false,
  href = "/" as Route,
  className,
}: {
  dark?: boolean;
  href?: Route;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5",
        dark ? "text-white" : "text-[#071426]",
        className,
      )}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-[#10cfc9] text-[#043b39]">
        <ShieldCheck size={19} />
      </span>
      <span className="text-[13px] font-semibold tracking-[.16em]">
        NEXA VISIT
      </span>
    </Link>
  );
}
