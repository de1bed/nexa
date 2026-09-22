"use client";

import Link from "next/link";
import type { Route } from "next";
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
      <img
        src={dark ? "/brand/logo-on-dark.png" : "/brand/logo.png"}
        alt="NEXA VISIT"
        width={810}
        height={324}
        className="h-12 w-auto"
      />
    </Link>
  );
}
